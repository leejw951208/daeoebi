# 고정 지출 시작월·해제·삭제

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 작성일 | 2026-06-29 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
고정 지출을 설정한 달(`startMonth`)부터만 생성해 과거 달로 이동해도 소급 생성되지 않게 했다. 상세 화면에서 "고정 해제"로 기록을 지우지 않고 이후 자동 생성만 멈출 수 있고, "삭제"는 "이 고정 전체 삭제"와 "이번 달만 삭제" 중에서 고를 수 있다. 이번 달만 삭제한 건은 새로고침·재진입에도 다시 살아나지 않는다.

## 2. 왜 (배경·목표)
- 기존 `materializeRecurring`은 보는 달이면 무조건 인스턴스를 만들어, 6월에 만든 고정도 5월·3월 등 과거 달로 이동하면 소급 생성됐다.
- `active` 플래그는 있었지만 이를 끄는 UI가 없어 중단이 곧 파괴적 삭제뿐이었다.
- 시작월 경계로 소급 생성을 막고, 비파괴 해제와 전체/이번 달만 삭제 선택지를 제공하는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| `startMonth`를 평문 컬럼으로 저장 | `method`가 암호문이라 서버는 결제월·카드 여부를 모름. 시작월은 평문 메타로만 판정 가능 | 서버 집계 — 암호문이라 불가 |
| 시작월은 카드·비카드 동일(설정한 달) | 카드 익월 등장은 기존 `billingDate` 결제 시프트가 이미 담당 | startMonth에 카드 익월 로직 중복 |
| "이번 달만 삭제"를 소프트 삭제(`removed=true`)로 | removed 인스턴스가 `(recurringId, period)` unique 슬롯을 점유해 materialize 재생성 POST가 409로 막힘 | 하드 삭제 — 다음 로드에서 재생성됨 |
| "전체 삭제"를 FK Cascade로 | `deleteRecurring` 한 번에 규칙+모든 달 인스턴스 정리 | onDelete SetNull — 고아 인스턴스 잔존 |
| 해제는 기존 `active=false` 재사용 | 스키마·API 변경 없이 UI만 노출하면 됨 | 신규 상태 컬럼 추가 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| API(DTO) | `apps/api/src/asset/dto/recurring.dto.ts` | `CreateRecurringDto.startMonth`(`YYYY-MM` `@Matches`) 추가 |
| API(DTO) | `apps/api/src/asset/dto/expense.dto.ts` | `UpdateExpenseDto.removed?` 추가 |
| API(서비스) | `apps/api/src/asset/recurring.service.ts` | `create`·`toView`에 `startMonth` 반영 |
| API(서비스) | `apps/api/src/asset/expense.service.ts` | `listByMonth`에 `removed: false` 필터, `update`가 `removed` 설정 |
| API(테스트) | `apps/api/test/auth-store.e2e-spec.ts` | 소프트 삭제 멱등(재생성 409)·Cascade 삭제 e2e 추가 |
| Web(클라이언트) | `apps/web/lib/vault-client.ts` | `RecurringView.startMonth`, `createRecurring`·`updateExpense(removed)` 입력 확장 |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-recurring.ts` | materialize 루프에 `month < t.startMonth` 시작월 경계 가드 추가 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-recurring.spec.ts` | 시작월 경계 단위 테스트 신규 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx` | 생성 시 `startMonth` 전달, "고정 해제"·"전체 삭제"·"이번 달만 삭제" 액션·다이얼로그 |
| DB | `20260629123654_recurring_start_and_soft_delete` | `startMonth` NOT NULL(기존 행 `createdAt` 백필), `removed` DEFAULT false, `Expense.recurringId` FK를 SetNull→Cascade |

## 5. 확인 방법
- [x] `make typecheck` · `make lint` · `make test` 통과
- [ ] `make dev-up` 후 6월에 고정 생성 → 6월부터 보이고 5월로 이동하면 미생성. 카드 고정은 7월 화면에 첫 등장한다.
- [ ] "고정 해제" 시 이후 자동 생성만 멈추고 기존 기록은 유지된다.
- [ ] "삭제 → 이번 달만"은 그 건만 사라지고 재진입에도 살아나지 않으며, "삭제 → 전체"는 모든 달 인스턴스와 규칙이 제거된다.
- [ ] 관련 QA: `docs/qa/qa-scenarios.md`의 고정 시작월·해제·삭제 항목
