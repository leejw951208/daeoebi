# 카드 결제월(익월) 반영

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/card-billing-month` |
| 작성일 | 2026-06-29 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
가계부 대시보드의 월 화면이 구매월이 아니라 결제월(실제 출금되는 달) 기준으로 바뀌었다. 카드 지출은 구매한 다음 달에 청구되는 것으로 보고, 남은 돈·카테고리·달력·목록에 일관되게 반영된다. 사용자는 이번 달 화면에서 이번 달에 실제로 빠져나가는 돈을 본다.

## 2. 왜 (배경·목표)
- 기존 대시보드는 지출을 구매일(date)이 속한 달로 집계해, 익월에 결제되는 카드 지출이 실제 출금 시점과 어긋났다.
- "이번 달 남은 돈"을 이번 달에 실제 결제되는 금액 기준으로 맞추는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 카드만 익월(구매월+1, 말일 클램프) 이연, 자동이체·현금은 당월 | 카드만 실질적 결제 이연이 발생. 단순·명확한 정밀도 A | 카드별 결제일·마감일 기반 정확 청구월(정밀도 B) — 과함 |
| 결제월 전체 전환(월 네비가 결제월을 의미) | 지출 합계 == 남은 돈 차감으로 화면 전체 일관 | 결제월/구매월 토글 보기 — 범위 축소 |
| 결제월은 전부 클라이언트 집계에서 계산 | `method`가 암호문 블롭 안에 있어 서버는 결제월을 알 수 없음 | 서버 집계 — E2E 암호화상 불가 |
| 결제일 판정을 순수 함수 `billingDate`로 분리 | 기존 `monthOf`/`addMonth`/`clampedDate` 재사용, 단위 테스트 용이 | 컴포넌트·로드 내 인라인 계산 — 테스트 어려움 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| Web(상수) | `apps/web/app/(vault)/asset/_lib/asset-categories.ts` | 이연 대상 결제수단 상수 `CARD_METHOD` 추가 |
| Web(날짜) | `apps/web/app/(vault)/asset/_lib/asset-dates.ts` | 순수 함수 `billingDate(dateISO, deferred)` 추가(카드 익월·말일 클램프) |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-compute.ts` | `ComputedExpense.billingDate` 추가, `byDay`를 결제일 기준으로 변경, `billedInMonth` 추가 |
| Web(로드) | `apps/web/app/(vault)/asset/page.tsx` | M·M-1 두 달치 조회·머티리얼라이즈 후 결제일 부여, 결제월 M 결제분만 집계 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` | 선택일 상세 필터를 `billingDate` 기준으로 변경 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/dashboard/DayDetail.tsx` | 카드 건(결제일 ≠ 구매일)에 "M/D 구매" 부제 표기 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-dates.spec.ts` | `billingDate` 경계값(익월·말일 클램프·연말 롤오버) 단위 테스트 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts` | `billedInMonth`·`byDay` 결제월 기준 단위 테스트 |

모델·API·마이그레이션 변경 없음(결제월은 암호문상 서버가 계산할 수 없어 웹 전용).

## 5. 확인 방법
- [ ] `make typecheck` · `make lint` · `make test` 통과.
- [ ] `make dev-up` 후 6월에 카드 지출을 입력하면 6월 화면 남은 돈·달력에서 빠지지 않고 7월 화면에 반영되고, 현금·자동이체는 당월 그대로다. 달력에서 카드 건이 결제월의 같은 일자(말일 클램프)에 찍히고 상세에 "M/D 구매" 부제가 보이며, 지출 합계와 남은 돈 차감이 일치한다.
