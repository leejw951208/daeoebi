# 월별·항목별 수입 설계 (싱글톤 → 월별 다건)

## 1. 배경·목표

현재 수입(`Income`)은 **싱글톤 1건**(`id="singleton"`, 블롭 `{amount}`)이라 모든 달에 같은 값이 적용된다. 사용자는 **달마다 월급·상여·기타 수입을 각각 별도 항목으로** 기입하고 싶어 한다.

목표: 수입을 지출과 동일하게 **월별·다건·E2E 암호화** 항목으로 바꾸고, 대시보드의 "남은 돈 = 그 달 수입 합 − 그 달 지출"로 계산한다.

확정 결정(브레인스토밍):
- **반복 수입 자동생성 없음** — 월급도 매달 직접 입력(고정 지출 같은 템플릿/머티리얼라이즈 미도입).
- **고정 카테고리** — 월급·상여·기타(+색). 지출 카테고리와 동일 패턴이며 **카테고리는 블롭에 암호화** 저장.
- **월 단위만** — `YYYY-MM` 귀속(평문). 특정 날짜·달력 없음.
- **UI: 바텀시트 관리(A안)** — 수입 카드 탭 → 그 달 수입 목록 + 추가/편집/삭제를 시트 안에서 처리. 새 라우트 없음.

## 2. 데이터 모델 (Prisma, 신규 마이그레이션)

`Income` 모델을 싱글톤에서 월별 다건으로 교체한다. 기존 마이그레이션은 수정하지 않고 신규 생성한다.

```prisma
model Income {
  id         String   @id @default(cuid())
  month      String   // "YYYY-MM". 평문 — 월 범위 조회용.
  iv         Bytes
  ciphertext Bytes
  authTag    Bytes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([month])
}
```

변경점: `id` 기본값 `"singleton"` → `cuid()`, `month` 컬럼 추가, `@@index([month])`. 본문 블롭 구조는 `{amount}` → `{item, amount, category}`.

**마이그레이션 주의(데이터 폐기):** 기존 싱글톤 행은 (1) `month` 값이 없고 (2) 블롭 구조가 달라(`{amount}`) 신규 모델로 변환 불가하다. 서버는 E2E라 블롭을 못 읽으므로 자동 이전도 불가능하다. 따라서 **신규 마이그레이션에서 기존 `Income` 행을 삭제**한다(`DELETE FROM "Income"`). 운영엔 보통 테스트용 1건뿐이라 영향이 미미하며, 사용자가 재입력한다. 마이그레이션 생성:

```
pnpm --filter @daeoebi/api exec prisma migrate dev --name income_monthly_entries
```

생성된 SQL에 기존 행 삭제가 포함되는지 확인하고, 없으면 컬럼 추가(NOT NULL) 충돌을 피하기 위해 빈 테이블 전제로 정리한다.

## 3. API (asset 모듈) — 싱글톤 GET/PUT → CRUD

`income.controller.ts`·`income.service.ts`·`dto/income.dto.ts`를 **expense 패턴으로 교체**한다(월 범위 조회 + 생성/수정/삭제). 전역 세션 가드 보호, 본문은 base64url 암호문 패스스루. CSRF는 `asset.module`의 기존 `forRoutes(IncomeController, ...)` 유지.

엔드포인트:
- `GET /income?month=YYYY-MM` → 그 달 수입 목록(블롭 포함, 클라 복호화·집계용). `month` 미지정·형식 오류는 400.
- `POST /income` → 생성(201). 본문 `{ month, iv, ciphertext, authTag }`.
- `PATCH /income/:id` → 본문 갱신. `{ iv, ciphertext, authTag }`(세 필드 동시).
- `DELETE /income/:id` → 삭제(204). 없으면 `INCOME_NOT_FOUND`(404).

DTO(`dto/income.dto.ts`, expense.dto 미러):
```ts
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export class CreateIncomeDto {
  @Matches(MONTH_RE) month!: string
  @IsBase64url() iv!: string
  @IsBase64url() ciphertext!: string
  @IsBase64url() authTag!: string
}
export class UpdateIncomeDto {
  @IsOptional() @IsBase64url() iv?: string
  @IsOptional() @IsBase64url() ciphertext?: string
  @IsOptional() @IsBase64url() authTag?: string
}
```

서비스(`income.service.ts`): `listByMonth(month)`(월 필터, createdAt 오름차순), `create(dto)`(month + prismaBytes), `update(id, dto)`(존재 확인 후 블롭 갱신), `remove(id)`(없으면 `ASSET_ERRORS.INCOME_NOT_FOUND`). `expense.service.ts`의 base64url 패스스루·prismaBytes 헬퍼를 그대로 따른다.

에러코드: `asset.types.ts`에 `INCOME_NOT_FOUND = "INCOME_NOT_FOUND"` 추가. 기존 싱글톤 전용 코드가 있으면 제거.

## 4. 웹 공통

**`lib/vault-client.ts`** — `getIncome`/`putIncome` 제거, 다음으로 교체:
```ts
export interface IncomeView { id: string; month: string; iv: string; ciphertext: string; authTag: string }
export async function listIncomes(month: string): Promise<IncomeView[]>      // GET /income?month=
export async function createIncome(input: { month: string } & SealedBlobDto): Promise<IncomeView>  // POST
export async function updateIncome(id: string, blob: SealedBlobDto): Promise<IncomeView>            // PATCH
export async function deleteIncome(id: string): Promise<void>                                       // DELETE
```

**`asset/_lib/asset-payload.ts`** — `IncomePayload`를 `{ amount }` → `{ item, amount, category }`로 확장. `sealIncome`/`openIncome`을 expense와 동일 형태로(누락 필드 폴백: `item ""`, `amount 0`, `category "기타"`).

**`asset/_lib/asset-categories.ts`** — 수입 카테고리 상수 추가(지출 `CATEGORIES`와 동일 `AssetCategory` 형태):
```ts
export const INCOME_CATEGORIES: AssetCategory[] = [
  { key: "월급", color: "#2f9e6e" },
  { key: "상여", color: "#3d7dd6" },
  { key: "기타", color: "#98a0a8" },
]
export function incomeCategoryColor(key: string): string  // 미일치 시 FALLBACK_COLOR
```
지출 `CATEGORIES`·`categoryColor`는 그대로 둔다.

**`asset/_lib/asset-compute.ts`** — 복호화된 수입 1건 타입과 합계:
```ts
export interface ComputedIncome { id: string; month: string; item: string; amount: number; category: string }
export function totalIncome(items: ComputedIncome[]): number  // amount 합
```
`remaining(income, spent)`는 그대로 쓰되, 호출부에서 `income = totalIncome(incomes)`로 넘긴다.

## 5. 대시보드·UI (A안: 바텀시트 관리)

**로드 변경(`asset/page.tsx`)** — `Promise.all`에 `getIncome()` → `listIncomes(month)`. 받은 수입 뷰들을 `openIncome`으로 복호화(`Promise.allSettled`, 실패분 스킵 — 지출과 동일)해 `ComputedIncome[]`로 만들고 `incomeAmount = totalIncome(incomes)`. `Loaded`에 `incomes: ComputedIncome[]` 추가(대시보드 카드 건수·시트 목록용).

**수입 카드(`IncomeExpenseCards`)** — 값은 `formatWon(총수입)`(0이면 "설정하기"), 부가표시 "N건". 탭 시 `onOpenIncome()`로 수입 관리 시트 오픈(기존과 동일 트리거).

**수입 관리 시트(신규 `IncomeSheet` 재설계)** — 단일 금액 입력 → **목록 + 폼**:
- 헤더 "월 수입" + 월 라벨.
- 그 달 수입 목록: 각 행에 카테고리 색 점·카테고리·항목명·금액 + 편집·삭제. 비어 있으면 안내문.
- "수입 추가" → 같은 시트 내 인라인 폼: 금액(₩ 큰 입력)·항목명·카테고리 칩(`INCOME_CATEGORIES`). 저장 시 `createIncome`(블롭 seal) 후 목록 갱신.
- 편집: 행 탭 → 폼에 채워 `updateIncome`. 삭제: `deleteIncome` + `ConfirmDialog`.
- 모든 변경 후 대시보드 `load()` 재호출로 남은 돈·총수입 갱신.
- 컴포넌트 분해(과대 단일 파일 방지): `IncomeSheet`(조립·목록), `IncomeRow`(행), `IncomeEntryForm`(추가·편집 폼). `asset/_components/income/` 하위.

동작/스타일은 기존 시트·`ExpenseForm` 칩 패턴과 일관되게. 자동잠금·`resetIdle`은 기존대로 입력·버튼 핸들러에서 호출.

## 6. 테스트

- **API 단위**(Prisma 모킹, `income.service.spec.ts` 재작성): `listByMonth` 월 필터, `create` month+블롭 패스스루, `update` 블롭 갱신, `remove` 없는 id → `INCOME_NOT_FOUND`.
- **API e2e**(기존 asset e2e에 추가): `/income` 월 생성→조회→수정→삭제 흐름, `month` 형식 검증(400).
- **웹 단위**: `asset-payload` 수입 seal/open 라운드트립(`{item,amount,category}`), `asset-compute.totalIncome` 합계, `vault-client` 신규 income 함수 계약(axios 모킹).

## 7. 범위 밖 (YAGNI, 후속 가능)

- 반복 수입 자동생성(고정 지출 같은 템플릿/머티리얼라이즈).
- 수입 달력·날짜 단위 기록.
- 대시보드 수입 카테고리별 그래프(현재는 총합·건수만).

## 8. 검증

1. `make typecheck`·`make lint`·`make test` 통과.
2. `make dev-up`(dev DB+마이그레이션) 후 dev 우회 진입:
   - 수입 카드 → 시트에서 월급·상여·기타 추가 → 총수입·남은 돈 갱신 확인.
   - 항목 편집·삭제 반영 확인.
   - 다른 달로 이동 시 그 달 수입만 보이는지(월 귀속) 확인.
   - 새로고침 후 결정적 dev VK로 복호화 정상.
