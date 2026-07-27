# 고정 지출 개월 수(기간 제한)

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 작성일 | 2026-06-29 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
고정 지출 등록 시 "개월 수"를 선택 입력할 수 있다. 값을 넣으면 시작월부터 그 개월 수만큼만 자동 생성되고 이후 자동 종료되며, 비우면 기존처럼 무기한으로 생성된다. 할부·약정처럼 정해진 기간만 반복되는 지출을 표현할 수 있다.

## 2. 왜 (배경·목표)
- 고정 지출은 `startMonth`부터 해제 전까지 무기한 생성돼, 정해진 개월 수만 운영되는 할부·약정을 표현할 수 없었다.
- 시작월부터 N개월간만 생성하고 자동 종료되는 기간 제한을 선택 옵션으로 추가하는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| `termMonths Int?`를 평문 nullable 컬럼으로 추가 | null=무기한으로 기존 행 동작 불변, 백필 불필요 | 별도 종료월 컬럼 — 개월 수로 충분 |
| 종료 판정을 materialize 경계로만 처리 | `[startMonth, addMonth(startMonth, termMonths-1)]` 범위 밖은 미생성이면 충분 | 종료 시 `active=false` 자동 전환 — 불필요 |
| 카드 분기 없음 | 각 인스턴스가 기존 결제 시프트로 익월 표시돼 자연히 "익월부터 N개월"이 됨 | 카드 전용 카드 생성 로직 분기 |
| 입력은 1 이상 정수만 전송 | 빈 값·0은 무기한 의미로 termMonths 미전송 | 항상 전송 — 무기한 표현 모호 |
| 수정 화면 개월 수 변경은 범위 밖 | 등록 시 확정으로 충분, YAGNI | UpdateRecurringDto 확장 — 후속 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| DB | `20260629135950_recurring_term_months` | `RecurringExpense`에 `termMonths INTEGER` nullable 컬럼 추가 |
| API | `apps/api/prisma/schema.prisma` | `RecurringExpense.termMonths Int?` |
| API | `apps/api/src/asset/dto/recurring.dto.ts` | `CreateRecurringDto`에 `termMonths?`(`@IsOptional`·`@IsInt`·`@Min(1)`) |
| API | `apps/api/src/asset/recurring.service.ts` | `create` 저장(`?? null`)·`RecurringRow`·`toView`에 `termMonths` 포함 |
| API(테스트) | `apps/api/src/asset/recurring.service.spec.ts` | `termMonths` 저장·null 처리·뷰 포함 단위 테스트 |
| Web | `apps/web/lib/vault-client.ts` | `RecurringView.termMonths`·`createRecurring` 입력에 `termMonths?` |
| Web | `apps/web/app/(vault)/asset/_lib/asset-recurring.ts` | materialize 종료월 상한 경계 + `addMonth` import |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts` | 종료월까지 생성·종료월+1 미생성 경계 테스트 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx` | 고정 ON 시 "개월 수"(선택) 숫자 입력, 1 이상 정수만 전송 |

## 5. 확인 방법
- [ ] `make typecheck` · `make lint` · `make test` 통과
- [ ] `make dev-up` 후 비카드 고정 + 개월 수 3, 6월 시작 → 6·7·8월 생성, 9월 미생성. 카드면 결제월 7·8·9월 등장, 10월엔 없음. 개월 수를 비우면 무기한 생성.
