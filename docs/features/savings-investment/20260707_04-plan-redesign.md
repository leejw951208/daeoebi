# 저축·투자 탭 재설계 Implementation Plan (디자인 v5 싱크)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** 자산 대시보드 "저축·투자" 탭을 디자인 v5(적금 계좌·투자 평가·세이빙 박스·카테고리 관리 시트)에 맞춰 재설계한다.

**Architecture:** 신규 암호화 리소스 3종(SavingsAccount·InvestmentPosition·SavingsBoxTxn)을 Income 패스스루 패턴으로 추가하고, 클라가 복호화해 순수 함수로 집계·표시한다. 기존 파생 단일 SavingsGoal은 대체된다.

**Tech Stack:** NestJS + Prisma(Postgres), Next.js(React), Jest, Playwright. 금액 VK(AES-256-GCM) 암호화.

## Global Constraints

- 커밋은 **사용자 요청 시에만**(CLAUDE.md 5). 각 Commit 스텝은 승인 시 실행, 아니면 스킵.
- `prisma migrate dev` 대화형 차단 → migration.sql 수동 작성 + `prisma migrate deploy` + `prisma generate`. 기존 migration 수정 금지.
- 금액·본문은 클라이언트 E2E 암호문(iv/ciphertext/authTag base64url) 패스스루. 서버 복호화 없음.
- 기존 예산·지출·고정지출 로직 변경 금지(비파괴). "이번 달"(budget) 탭 렌더 불변.
- **저축/투자 식별은 이름이 아니라 `AssetCategory.kind`(`NORMAL`|`SAVINGS`|`INVESTMENT`) 기준**(Unit 0). 이름·코드는 사용자가 바꿀 수 있어 앵커로 쓰지 않는다. 적금 month 매칭: `kind==='SAVINGS'` 지출 중 `item === 계좌.name`.
- 디자인 참고: `scratchpad/design-v5.html`, `scratchpad/v5-savings-tab.txt`(마크업), `scratchpad/v5-compute.txt`(계산). 문구·색(#20a4a4 저축·#7b61ff 투자·#e9b949 박스)·프리셋은 마크업대로.
- 기존 미러 패턴: 서비스=`apps/api/src/asset/savings-goal.service.ts`·`income.service.ts`, 시트=`apps/web/app/(vault)/asset/_components/budget/BudgetSheet.tsx`, 링크행=`.../dashboard/DayDetail.tsx`, 탭=`.../dashboard/SavingsTab.tsx`(현행).

---

## Unit 0 — 카테고리 kind 마커 (선행)

저축/투자 식별을 이름 대신 안정적 시스템 마커 `kind`로 전환한다. 기존(merged) 파생 로직도 kind 기준으로 교체.

### Task 0-1: AssetCategory.kind 추가 + 마이그레이션·시드
**Files:** Modify `apps/api/prisma/schema.prisma`, `apps/api/src/asset/asset-category.service.ts`; Create migration.
- [ ] Step 1: 스키마 — `AssetCategory` 에 `kind String @default("NORMAL")` 추가.
- [ ] Step 2: DB 기동.
- [ ] Step 3: migration.sql:
```sql
-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'NORMAL';
-- 기존 시드 저축/투자 데이터 마커 지정
UPDATE "AssetCategory" SET "kind" = 'SAVINGS' WHERE "name" = '저축';
UPDATE "AssetCategory" SET "kind" = 'INVESTMENT' WHERE "name" = '투자';
```
- [ ] Step 4: deploy + generate.
- [ ] Step 5: 시드 상수(`DEFAULT_CATEGORIES`)에 kind 추가: 저축→`SAVINGS`, 투자→`INVESTMENT`, 그 외 생략(기본 NORMAL). `createMany` data 에 kind 포함. create()는 항상 NORMAL(사용자 생성은 일반). 서비스 spec 의 createMany 기대값·length 갱신.
- [ ] Step 6: `pnpm --filter @daeoebi/api exec jest asset-category` green.
- [ ] Step 7: Commit(승인 시) `feat(asset): 카테고리 kind 마커(SAVINGS·INVESTMENT)`

### Task 0-2: 프론트 kind 반영 + 기존 파생 교체
**Files:** Modify `apps/web/lib/vault-client.ts`(AssetCategory.kind 추가), `apps/web/app/(vault)/asset/_lib/asset-compute.ts`(savingsSummary·filterByMonth 소비부), `apps/web/app/(vault)/asset/page.tsx`, 데모 데이터 타입.
- `AssetCategory` 타입에 `kind: "NORMAL" | "SAVINGS" | "INVESTMENT"` 추가.
- `savingsSummary`(asset-compute.ts:119~): 카테고리 이름 대신 **kind** 로 분기 — `categories` 를 `{id,kind}[]`로 받아 `kind==='SAVINGS'`→saved, `'INVESTMENT'`→invest. 기존 spec(`name:"저축"`)을 kind 기준으로 갱신.
- `page.tsx:225` 저축/투자 카테고리 필터를 `c.kind === "SAVINGS" || c.kind === "INVESTMENT"` 로 교체.
- 데모 `demo-asset-data.ts` 카테고리에 `kind`(저축→SAVINGS·투자→INVESTMENT·그외 NORMAL) 추가.
- [ ] typecheck + web jest green. Commit(승인 시) `refactor(asset): 저축·투자 식별을 kind 기준으로`

> 이후 Unit A~C 의 "저축/투자 카테고리" 식별·적금 item 매칭은 모두 `kind` 기준을 사용한다.

---

## Unit A — 적금 계좌 (SavingsAccount)

### Task A1: SavingsAccount 모델 + 마이그레이션
**Files:** Modify `apps/api/prisma/schema.prisma`; Create `apps/api/prisma/migrations/<TS>_add_savings_account/migration.sql`
**Produces:** `prisma.savingsAccount`.
- [ ] Step 1: 스키마 추가
```prisma
// 적금 계좌(다건). name 평문(item 매칭·식별), color 평문. blob 은 {base, goal} 암호문.
model SavingsAccount {
  id         String   @id @default(cuid())
  name       String
  color      String
  iv         Bytes
  ciphertext Bytes
  authTag    Bytes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```
- [ ] Step 2: DB 기동 `docker compose -f docker-compose.dev.yml --env-file apps/api/.env.development up -d db`
- [ ] Step 3: `TS=$(date +%Y%m%d%H%M%S)` 폴더에 migration.sql:
```sql
-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL,
    "iv" BYTEA NOT NULL, "ciphertext" BYTEA NOT NULL, "authTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);
```
- [ ] Step 4: `pnpm --filter @daeoebi/api exec prisma migrate deploy && pnpm --filter @daeoebi/api exec prisma generate`
- [ ] Step 5: Commit(승인 시) `feat(asset): SavingsAccount 모델·마이그레이션`

### Task A2: SavingsAccount DTO·서비스·컨트롤러 (TDD)
**Files:** Create `dto/savings-account.dto.ts`, `savings-account.service.ts`, `savings-account.service.spec.ts`, `savings-account.controller.ts`; Modify `asset.module.ts`
**Produces:** `list()`, `create(dto)`, `update(id,dto)`, `remove(id)`; routes `GET/POST /savings-accounts`, `PATCH/DELETE /savings-accounts/:id`. View `{id,name,color,iv,ciphertext,authTag}`.
- DTO: `CreateSavingsAccountDto { name(1..40), color(HEX #rrggbb), iv/ciphertext/authTag(base64url) }`; `UpdateSavingsAccountDto { color?(HEX), iv?/ciphertext?/authTag?(base64url, 셋 다 or 없음) }`.
- 서비스: `income.service.ts` 패스스루 패턴 그대로(toView, prismaBytes, P2025→404 NotFound code `SAVINGS_ACCOUNT_NOT_FOUND`). `asset.types.ts` ASSET_ERRORS 에 `SAVINGS_ACCOUNT_NOT_FOUND` 추가. list orderBy createdAt asc.
- [ ] Step 1: spec 작성(TDD) — create→create 호출 인자, update 부분필드, remove P2025→404. `savings-goal.service.spec.ts` 구조 참고.
- [ ] Step 2: 실패 확인 `pnpm --filter @daeoebi/api exec jest savings-account`
- [ ] Step 3: DTO·서비스·컨트롤러 구현 + asset.module 등록(controllers·providers·CsrfMiddleware.forRoutes).
- [ ] Step 4: `pnpm --filter @daeoebi/api run typecheck && pnpm --filter @daeoebi/api exec jest` green
- [ ] Step 5: Commit(승인 시) `feat(asset): 적금 계좌 API`

### Task A3: asset-compute 적금 집계 (TDD)
**Files:** Modify `apps/web/app/(vault)/asset/_lib/asset-compute.ts` + `.spec.ts`
**Produces:**
```ts
export interface SavingsAccountView { name: string; color: string; base: number; goal: number; month: number; total: number; goalPct: number; remain: number }
export function monthSavingsByItem(monthExpenses, categories): Map<string,number>  // 이번 달 '저축' 지출을 item별 합산
export function savingsAccountsView(accounts: {name;color;base;goal}[], monthByItem: Map<string,number>): { rows: SavingsAccountView[]; savedTotal: number; savedMonth: number }
```
- 로직(마크업 v5-compute.txt 대로): month = monthByItem.get(name)??0; total=base+month; goalPct = goal>0? clamp(round(total/goal*100),0,100):0; remain=max(goal-total,0). rows 는 total desc 정렬. savedTotal/ savedMonth = 합.
- monthSavingsByItem: 이번 달 지출 중 카테고리 이름 `저축`인 것의 `item`별 amount 합. (categories 로 categoryId→name 매핑; item 은 복호화된 지출 payload.item — page 가 넘김)
- [ ] Step 1: spec(2케이스: 목표 있는/없는 계좌 진행률·정렬·합계; item 매칭 합산). Step 2: 실패. Step 3: 구현. Step 4: `jest asset-compute` green. Step 5: Commit(승인 시).

### Task A4: payload·vault-client (적금)
**Files:** Modify `asset-payload.ts`, `apps/web/lib/vault-client.ts`
**Produces:** `sealAccount(vk,{base,goal})`/`openAccount`; `SavingsAccountView` type, `listSavingsAccounts()`, `createSavingsAccount(name,color,blob)`, `updateSavingsAccount(id,{color?,...blob})`, `deleteSavingsAccount(id)`. (기존 sealGoal/vault-client 패턴 그대로.)
- [ ] typecheck green. Commit(승인 시).

### Task A5: UI — 적금 계좌 섹션 + 추가/목표 시트
**Files:** Modify `.../dashboard/SavingsTab.tsx`; Create `.../_components/SavingsAccountAddSheet.tsx`, `.../_components/SavingsAccountGoalSheet.tsx`; Modify `asset/page.tsx`
- SavingsTab: 저축/투자 요약 카드 아래에 **적금 계좌 목록**(각 행: 색점·이름·total·이번달(+month)·목표 진행바/`목표 미설정`, 탭→목표시트) + `+ 적금 추가` 버튼. 마크업은 v5-savings-tab.txt 의 적금 관련 구조·문구 사용. props 로 `accounts: SavingsAccountView[]`, `onAddAccount`, `onEditGoal(name)` 받음.
- `SavingsAccountAddSheet`: 이름·현재 저축액(base)·목표 금액 + 프리셋 칩(`addGoalPresets`) → `createSavingsAccount(name,color,sealAccount({base,goal}))` (color 는 ADD_COLORS 순환). BudgetSheet 패턴.
- `SavingsAccountGoalSheet`: 특정 계좌 목표 수정(현재 base 유지, goal 변경) + `적금 삭제`(deleteSavingsAccount). 저장=updateSavingsAccount(id, sealAccount({base,goal})).
- page.tsx: 저축·투자 탭 진입 시 `listSavingsAccounts` 로드·복호화(openAccount, 실패 스킵) → accounts. monthSavingsByItem(이번 달 지출, categories) → savingsAccountsView. 시트 상태·쓰기 후 재로드.
- [ ] typecheck + web jest green. Commit(승인 시) `feat(asset): 적금 계좌 UI`

### Task A6: e2e (적금)
**Files:** Create/extend `apps/web/tests/e2e/savings.spec.ts` — 적금 추가→목록 노출→목표 저장→진행률. dev 서버 필요. Commit(승인 시).

---

## Unit B — 투자 포지션 (InvestmentPosition)

### Task B1: 모델 + 마이그레이션
`InvestmentPosition` 싱글톤: `returnRate String @default("")`(평문 소수 문자열) + iv/ciphertext/authTag(blob `{base}`) + timestamps. 마이그레이션 수동. Commit(승인 시).

### Task B2: DTO·서비스·컨트롤러 (TDD)
싱글톤 upsert(SavingsGoalService 패턴): `get()`→행/null, `upsert({returnRate, iv,ciphertext,authTag})`. routes `GET /investment`, `PUT /investment`. DTO: returnRate(문자열, 소수/빈값 허용 — `@Matches(/^$|^\d+(\.\d+)?$/)`) + base64url 3필드. asset.module 등록. TDD spec(get null/행, upsert create/update). Commit(승인 시).

### Task B3: asset-compute 투자 평가 (TDD)
```ts
export interface InvestmentView { principal: number; rate: number|null; value: number; pnl: number }
export function investmentView(base: number, returnRate: string, investMonth: number): InvestmentView
```
principal=base+investMonth; rate = 유효 소수면 값 else null; value = rate!=null? round(principal*(1+rate/100)) : principal; pnl=value−principal. spec: 수익률 유효/빈값/음수. Commit(승인 시).

### Task B4: payload·client
`sealInvestment(vk,{base})`/`openInvestment`; `getInvestment()`, `saveInvestment(returnRate, blob)`. Commit(승인 시).

### Task B5: UI — 투자 수익률 카드 + 시트
SavingsTab 에 투자 카드(원금·평가금액·평가손익·수익률, 색 investPnl<0 빨강·≥0 보라/검정) → 탭 시 `InvestmentReturnSheet`(수익률 입력·프리셋 `returnPresets`·저장). 투자 요약 카드 값(investTotal)=평가금액. page 배선. typecheck+test. Commit(승인 시).

### Task B6: e2e 투자 수익률 저장→평가손익. Commit(승인 시).

---

## Unit C — 세이빙 박스 (SavingsBoxTxn)

### Task C1: 모델 + 마이그레이션
`SavingsBoxTxn`: `type String`(in|out) · `source String`(cash|savings) · `date String`("YYYY-MM-DD") 평문 + blob `{amount, memo}`. index([date]). 마이그레이션 수동. Commit(승인 시).

### Task C2: DTO·서비스·컨트롤러 (TDD)
`list()`(date desc), `create({type,source,date, blob})`, `remove(id)`. routes `GET/POST /savings-box`, `DELETE /savings-box/:id`. DTO: type(in|out), source(cash|savings), date(YYYY-MM-DD 정규식) + base64url. Income 패턴. TDD. Commit(승인 시).

### Task C3: asset-compute 박스 (TDD)
```ts
export function savingsBoxBalance(txns: {type:'in'|'out'; source:'cash'|'savings'; amount:number}[]): { balance:number; inTotal:number; outTotal:number; fromSavings:number }
```
balance=in−out; fromSavings=in&source==savings 합. spec 2케이스. Commit(승인 시).

### Task C4: payload·client
`sealBoxTxn(vk,{amount,memo})`/`openBoxTxn`; `listSavingsBox()`, `createSavingsBoxTxn(type,source,date,blob)`, `deleteSavingsBoxTxn(id)`. Commit(승인 시).

### Task C5: UI — 세이빙 박스 카드 + 입출금/내역 시트
SavingsTab 세이빙 박스 카드(잔액·N건·입금/출금 버튼·입출금 내역 보기). `SavingsBoxSheet`(입금 시 출처 직접/저축이체 세그먼트+금액+메모; 출금 금액+메모) → createSavingsBoxTxn. `SavingsBoxDetailSheet`(내역 정렬·삭제·더보기). displayedSaved = savedTotal − fromSavings 를 저축 표시에 반영. 마크업 v5-savings-tab.txt. page 배선. typecheck+test. Commit(승인 시).

### Task C6: e2e 박스 입금→잔액. Commit(승인 시).

---

## Unit D — 카테고리 관리 시트 정렬

### Task D1: 카테고리 관리 2모드 시트
디자인 v5 카테고리 관리(목록 ↔ 추가/수정 폼, 코드·색 스와치 팔레트)에 맞춰 기존 `CategoryManager`/`CategoryRow`/`CategoryAddSection` UI를 목록+폼 2모드 바텀시트로 재구성. 기능(이름·코드 고유·색·삭제 미분류) 불변, 구조만 정렬. 마크업 v5-savings-tab.txt 의 `showCatMgr` 블록. 기존 e2e(category-crud) 셀렉터 영향 시 함께 갱신. typecheck+test+e2e. Commit(승인 시).

---

## Self-Review
- **Spec 커버리지:** §2 모델→A1/B1/C1; §3 API→A2/B2/C2; §4 계산→A3/B3/C3; §5 client/UI→A4·A5/B4·B5/C4·C5; §6 카테고리 시트→D1; §8 테스트→각 unit 단위+e2e. 전 항목 대응.
- **Placeholder:** 반복 CRUD/UI 는 미러 패턴 파일·디자인 마크업을 정확히 지목(엔지니어가 참조). 모델·계산·신규 로직은 실제 코드/시그니처 명시.
- **타입 일관성:** SavingsAccountView·InvestmentView·seal/open·client 함수명 unit 간 일치.
- **순서:** A(적금)→B(투자)→C(세이빙박스)→D(카테고리 시트). 각 unit 독립 실행·테스트 가능.
