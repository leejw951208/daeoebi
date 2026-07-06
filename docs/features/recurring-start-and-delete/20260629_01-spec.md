# 고정 지출 시작월·해제·삭제 설계

## 1. 배경·목표

고정 지출(`RecurringExpense`)에 세 가지가 빠져 있다.
- **시작월 개념 없음**: `materializeRecurring`이 보는 달이면 무조건 인스턴스를 만들어, 6월에 만든 고정인데 과거(3월)로 이동하면 소급 생성된다.
- **카드 익월 시작 미반영**: 결제수단과 무관하게 당월부터 잡힌다.
- **비파괴 해제 없음**: `active` 플래그는 있으나 이를 끄는 UI가 없다. 중단=삭제(파괴적)뿐.

목표(브레인스토밍 확정):
- **A. 시작월**: 고정은 **설정한 달부터** 생성. 그 이전 달엔 생성 안 함. 카드는 익월 화면에 첫 등장(= 설정월 구매가 결제 시프트로 다음 달에 표시되므로 **시작월은 카드·비카드 동일**, 익월 효과는 기존 결제월 기능이 담당).
- **B. 고정 해제**: 비파괴 중단. `active=false`로 앞으로 자동 생성만 멈추고 모든 기록 유지.
- **C. 삭제(선택)**: 고정 지출 삭제 시 **"이 고정 전체 삭제" / "이번 달만 삭제"**를 사용자가 고른다.
  - 전체: 규칙 + 모든 달 인스턴스 제거.
  - 이번 달만: 그 한 건만 제거하되 **재생성되지 않음**.

`method`는 암호문이라 서버가 결제월·카드 여부를 모른다 → 시작월·removed 등 평문 메타로만 처리한다.

## 2. 데이터 모델 (Prisma, 신규 마이그레이션)

```prisma
model RecurringExpense {
  id          String    @id @default(cuid())
  dayOfMonth  Int
  startMonth  String    // "YYYY-MM". 평문. 이 달부터 인스턴스 생성(이전 달엔 미생성).
  active      Boolean   @default(true)
  iv          Bytes
  ciphertext  Bytes
  authTag     Bytes
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  instances   Expense[]
  @@index([active])
}

model Expense {
  id          String            @id @default(cuid())
  date        DateTime          @db.Date
  recurringId String?
  recurring   RecurringExpense? @relation(fields: [recurringId], references: [id], onDelete: Cascade)
  period      String?
  removed     Boolean           @default(false) // 이번 달만 삭제(소프트 삭제 툼스톤). 목록·집계 제외, 슬롯 유지로 재생성 차단.
  iv          Bytes
  ciphertext  Bytes
  authTag     Bytes
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  @@unique([recurringId, period])
  @@index([date])
}
```

변경점:
- `RecurringExpense.startMonth` 추가(NOT NULL).
- `Expense.removed` 추가(기본 false).
- `Expense.recurringId` FK: **onDelete SetNull → Cascade** (전체 삭제 시 `deleteRecurring` 한 번에 인스턴스까지 정리).

**마이그레이션(데이터 보존)**: prisma migrate dev 로 신규 생성 후 SQL 편집:
- `startMonth` NOT NULL 추가 전, 기존 행 백필: `UPDATE "RecurringExpense" SET "startMonth" = to_char("createdAt", 'YYYY-MM')` (만든 달부터로 간주). 이후 NOT NULL 제약.
- `removed` 는 DEFAULT false 라 기존 행 자동 채움.
- FK 제약 교체(DROP + ADD CONSTRAINT ... ON DELETE CASCADE).
생성: `pnpm --filter @daeoebi/api exec prisma migrate dev --name recurring_start_and_soft_delete` (dev DB 필요). 생성 SQL의 NOT NULL/백필 순서를 확인·보정.

## 3. API (asset 모듈)

**recurring (시작월)**
- `CreateRecurringDto`에 `startMonth`(`@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)`) 추가. `create`가 `data.startMonth = dto.startMonth` 저장.
- `RecurringView`(toView)에 `startMonth` 포함 → 클라 materialize 가 사용.
- `UpdateRecurringDto.active` 는 이미 존재 → **해제 = `updateRecurring({active:false})`** (변경 없음).
- 전체 삭제 = `deleteRecurring(id)` (DELETE /recurring/:id). FK Cascade 라 인스턴스까지 삭제.

**expense (소프트 삭제 + removed 필터)**
- `UpdateExpenseDto`에 `@IsOptional() @IsBoolean() removed?` 추가. `expense.service.update`가 `if (dto.removed !== undefined) data.removed = dto.removed`.
- **이번 달만 삭제 = `PATCH /expenses/:id { removed: true }`** (하드 삭제 아님 — 슬롯 유지).
- `listByMonth`: `where`에 `removed: false` 추가(목록·집계에서 제외).
- 기존 `DELETE /expenses/:id` 하드 삭제는 유지(일반 지출 삭제용).

## 4. 머티리얼라이즈 (web, asset-recurring.ts)

- 템플릿 루프에서 **`if (month < t.startMonth) continue`** 추가(시작월 이전 미생성). 문자열 "YYYY-MM" 사전식 비교로 충분.
- 소프트 삭제 재생성 차단은 **추가 변경 없이 동작**한다: removed 인스턴스가 `(recurringId, period)` 슬롯을 점유하므로, materialize 의 `createExpense` 가 unique 위반(409)으로 막히고 기존 409 무시 로직이 건너뛴다. (removed 건은 listExpenses 에서 빠져 present-set 엔 없지만, POST→409→continue 로 멱등 유지. 매 로드 불필요 POST 1회는 감수 — 후속 최적화 가능.)

## 5. 웹

- **`lib/vault-client.ts`**: `RecurringView`에 `startMonth: string` 추가. `createRecurring` 입력에 `startMonth` 추가. `updateExpense` 입력 타입에 `removed?: boolean` 추가(이번 달만 삭제 = `updateExpense(id, { removed: true })`). `updateRecurring({active})`·`deleteRecurring`·`deleteExpense` 기존 사용.
- **`ExpenseForm` 생성(고정 ON)**: `createRecurring({ dayOfMonth, startMonth: monthOf(date), ...blob })`. 당월 인스턴스 생성은 그대로(머티리얼라이즈가 startMonth 부터이므로 일관).
- **고정 지출 상세(수정 화면)의 액션 영역 재구성**:
  - 일반 지출: "삭제"(하드, 기존).
  - 고정 지출: **"고정 해제"**(`updateRecurring({active:false})` → 중단, 기록 유지) + **"삭제"** → `ConfirmDialog`/시트로 선택:
    - **이 고정 전체 삭제**: `deleteRecurring(recurringId)` (Cascade 로 전 인스턴스 제거).
    - **이번 달만 삭제**: 소프트 삭제(`updateExpense(id,{removed:true})` 또는 `softDeleteExpense(id)`).
  - 동작 후 `onDeleted`/`onSaved` 로 대시보드 복귀·새로고침.
- **`materializeRecurring`**: §4 의 startMonth 경계 추가.
- 카드 익월: 별도 코드 없음(기존 billingDate 결제 시프트가 처리).

> 최근 머지된 "삭제=deleteRecurring+deleteExpense" 동작은 위 "전체 삭제"로 대체된다.

## 6. 테스트

- **API 단위**: recurring.service `create`가 startMonth 저장; expense.service `listByMonth`가 removed 제외; `update`가 removed 설정.
- **API e2e**: 소프트 삭제 멱등 — removed 처리한 인스턴스의 `(recurringId,period)` 로 재생성 POST → 409. 전체 삭제(Cascade) — deleteRecurring 후 해당 인스턴스들 조회 0건.
- **웹 단위**: `materializeRecurring` — `startMonth` 이전 달은 생성 시도 안 함(createExpense 미호출), 이후 달은 생성. (createExpense 모킹)

## 7. 범위 밖 (YAGNI)

- 소프트 삭제 인스턴스의 "복구"(되돌리기).
- materialize present-set 에 removed 포함시켜 불필요 POST 제거(성능 최적화).
- 임의 시작월 직접 선택(현재는 설정한 달 자동).

## 8. 검증

1. `make typecheck`·`make lint`·`make test` 통과.
2. `make dev-up` 후 dev 우회 진입:
   - 6월에 비카드 고정 생성 → 6월부터 보임, 5월로 이동 시 **5월엔 안 생김**.
   - 6월에 카드 고정 생성 → **7월 화면에 첫 등장**, 6월/이전 화면엔 소급 없음.
   - "고정 해제" → 다음 달부터 자동 생성 중단, 기존 건 유지.
   - "삭제 → 이번 달만" → 그 건만 사라지고 새로고침·재진입에도 **안 살아남**.
   - "삭제 → 전체" → 모든 달 인스턴스 + 규칙 제거.
