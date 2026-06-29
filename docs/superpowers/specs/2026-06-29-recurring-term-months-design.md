# 고정 지출 개월 수(기간 제한) 설계

## 1. 배경·목표

고정 지출(`RecurringExpense`)은 현재 `startMonth`부터 **무기한** 자동 생성된다(해제 전까지). 할부·약정처럼 **정해진 개월 수만** 운영하고 자동 종료되는 경우를 지원한다.

확정 결정(브레인스토밍):
- **의미**: 기간 제한 — 시작월부터 N개월간만 자동 생성하고 이후 자동 종료.
- **입력**: 선택. 비우면 기존처럼 무기한.
- **카드**: 개월 수 = 구매 인스턴스 수(시작월부터 N개). 각 인스턴스가 기존 결제 시프트로 익월에 표시되므로, 카드는 자연히 "익월부터 N개월"이 된다(별도 카드 분기 없음).

| 카드 고정 + 개월 수 3 + 6월 시작 | 구매(인스턴스) | 결제월(화면 등장) |
|---|---|---|
| 1 | 6월 | 7월 |
| 2 | 7월 | 8월 |
| 3 | 8월 | 9월 |

비카드: 6·7·8월 구매 = 6·7·8월 표시.

## 2. 데이터 모델 (Prisma, 신규 마이그레이션)

`RecurringExpense`에 nullable 정수 컬럼 추가:
```prisma
model RecurringExpense {
  id         String    @id @default(cuid())
  dayOfMonth Int
  startMonth String
  termMonths Int?      // null = 무기한. N = startMonth 부터 N개월간만 생성.
  active     Boolean   @default(true)
  ...
}
```
**마이그레이션**: nullable 컬럼 추가뿐 — 기존 행은 `null`(무기한)로 동작 불변, **백필 불필요**. `prisma migrate dev --name recurring_term_months`.

## 3. API (asset 모듈)

- `CreateRecurringDto`에 `termMonths?` 추가:
```ts
@IsOptional()
@IsInt()
@Min(1)
termMonths?: number
```
- `recurring.service.create`: `data.termMonths = dto.termMonths ?? null`.
- `RecurringRow`·`toView`에 `termMonths: row.termMonths`(타입 `number | null`) 포함 → 클라 materialize 가 사용.
- `UpdateRecurringDto`는 이번 범위에선 변경 없음(수정 화면에서 개월 수 변경은 후속).

## 4. 머티리얼라이즈 (web, asset-recurring.ts)

기존 `month < t.startMonth` 경계 다음에 종료월 상한을 추가한다. `addMonth`(asset-dates)를 import 한다.
```ts
for (const t of templates) {
    if (month < t.startMonth) continue
    if (t.termMonths != null && month > addMonth(t.startMonth, t.termMonths - 1)) continue // 기간 종료 후 미생성
    if (present.has(`${t.id}|${month}`)) continue
    ...
}
```
생성 범위 = `[startMonth, addMonth(startMonth, termMonths-1)]`. termMonths=1 이면 시작월 한 달만. 문자열 "YYYY-MM" 사전식 비교로 충분.

## 5. 웹

- **`lib/vault-client.ts`**: `RecurringView`에 `termMonths: number | null` 추가. `createRecurring` 입력에 `termMonths?: number` 추가.
- **`asset-recurring.ts`**: §4 의 종료월 경계 + `addMonth` import.
- **`ExpenseForm` 고정 ON 영역**: 기존 "고정 지출" 토글 아래에 **"개월 수"(선택)** 숫자 입력 추가. 안내 문구 예: "비우면 무기한, 입력하면 그 개월 수만큼만 자동 생성됩니다." 값이 있으면 `createRecurring({..., termMonths: Number(termInput)})`, 비었으면 termMonths 미전송.
  - 입력 검증(확정): 입력은 숫자만(`inputMode="numeric"`, 비숫자 제거). 전송 시 `n = Number(digits)` 가 **1 이상 정수면 termMonths=n**, 그 외(빈 값·0)는 **termMonths 미전송 = 무기한**.

## 6. 테스트

- **API 단위**(recurring.service.spec): `create`가 `termMonths` 를 저장(값 있을 때)·`null`(없을 때)로 처리하고 뷰에 포함.
- **웹 단위**(asset-recurring.spec): 종료월 경계 — `startMonth="2026-06", termMonths=3` 템플릿에 대해 `2026-08`(종료월)은 생성, `2026-09`(종료월+1)는 미생성; `termMonths=null` 이면 먼 미래 달도 생성.

## 7. 범위 밖 (YAGNI)

- 수정 화면에서 개월 수 변경(UpdateRecurringDto).
- 종료 시 자동 `active=false` 전환(materialize 경계로 충분 — 불필요).
- 임의 종료월 직접 지정(개월 수로 충분).

## 8. 검증

1. `make typecheck`·`make lint`·`make test` 통과.
2. `make dev-up` 후 dev 우회 진입:
   - 비카드 고정 + 개월 수 3, 6월 시작 → 6·7·8월 생성, 9월엔 미생성.
   - 카드 고정 + 개월 수 3, 6월 시작 → 결제월 7·8·9월 등장, 10월엔 없음.
   - 개월 수 비우고 생성 → 기존처럼 무기한.
