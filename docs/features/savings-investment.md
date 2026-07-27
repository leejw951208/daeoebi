# 저축·투자 관리

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/savings-investment-redesign` |
| 작성일 | 2026-07-06 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
자산 대시보드에 "저축·투자" 탭을 추가했다. 상단 세그먼트로 `이번 달`(기존 예산·지출)과 `저축·투자`를 전환한다. 저축·투자 탭은 순자산 hero, 저축/투자 요약 카드, 적금 계좌 목록(계좌별 잔액·목표 진행률·이번 달 적립), 쌈짓돈 입출금 원장, 투자 수익률 카드, 이번 달 적립 내역을 보여준다. 사용자는 적금 계좌를 여러 개 추가해 목표를 관리하고, 투자 수익률을 입력해 평가손익을 확인하며, 쌈짓돈으로 현금·저축이체 입출금을 기록할 수 있다.

## 2. 왜 (배경·목표)
- 기존에는 지출을 카테고리로만 기록해, 저축·투자가 얼마나 쌓였는지·목표에 얼마나 다가갔는지 한눈에 볼 수 없었다.
- 초기안은 카테고리 이름 매칭 기반의 단일 저축 목표(파생 뷰)였는데, 실제 여러 적금 계좌·투자 평가·별도 원장을 표현하지 못했다. 디자인 v5에 맞춰 다건 계좌·투자 평가·쌈짓돈까지 담는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 저축·투자 식별을 `AssetCategory.kind`(`NORMAL`·`SAVINGS`·`INVESTMENT`) 기준으로 | 이름·코드는 사용자가 바꿀 수 있어 앵커로 부적합. 안정적 시스템 마커 필요 | 초기안의 카테고리 이름(`저축`/`투자`) 매칭 — 이름 변경 시 집계에서 누락 |
| 단일 `SavingsGoal` → 다건 `SavingsAccount`로 대체 | 계좌별 잔액·목표·색을 개별 관리해야 함. 기존 단일 모델은 미사용 처리 | 초기안의 단일 목표(이름+금액) — 실제 여러 적금 표현 불가 |
| 모든 금액을 VK(AES-256-GCM) blob 패스스루로 저장, 서버 복호화 없음 | 앱 전체 E2E 암호 계약 유지. 집계는 클라이언트가 복호화 후 순수 함수로 | 서버 집계 — 평문 노출로 E2E 위반 |
| `InvestmentPosition` 싱글톤(`returnRate` 평문 + 원금 blob) | 원금은 암호문으로 보호하되 수익률만 평문으로 두어 평가금액·손익 계산 | 평가금액까지 저장 — 원금 노출·중복 |
| 저축·투자 총액을 전체 기간 누적 기준으로, 순자산에 쌈짓돈 합산 | 월 리셋되면 누적 자산이 축소돼 보임. 누적이 실제 자산에 부합 | 월간 리셋 집계 — 자산이 매월 0으로 보임 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| API | `apps/api/src/asset/savings-account.{controller,service,dto}.ts` | 적금 계좌 CRUD (`GET/POST /savings-accounts`, `PATCH/DELETE /:id`) |
| API | `apps/api/src/asset/investment.{controller,service,dto}.ts` | 투자 포지션 싱글톤 (`GET/PUT /investment`) |
| API | `apps/api/src/asset/savings-box.{controller,service,dto}.ts` | 쌈짓돈 입출금 (`GET/POST /savings-box`, `DELETE /:id`) |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-compute.ts` | `savingsAccountsView`·`investmentView`·`savingsBoxBalance`·`savingsByItem` 등 순수 함수 |
| Web(암호화) | `apps/web/app/(vault)/asset/_lib/asset-payload.ts` | `sealAccount/openAccount`·`sealInvestment/openInvestment`·`sealBoxTxn/openBoxTxn` |
| Web(클라이언트) | `apps/web/lib/vault-client.ts` | 적금·투자·쌈짓돈 리소스 함수 + View 타입 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/dashboard/SavingsTab.tsx` | 저축·투자 탭 재작성(hero·요약·적금·쌈짓돈·투자·적립 내역) |
| Web(UI) | `apps/web/app/(vault)/asset/_components/{SavingsAccountAddSheet,SavingsAccountGoalSheet,InvestmentReturnSheet,SavingsBoxSheet,SavingsBoxDetailSheet}.tsx` | 적금 추가·목표, 투자 수익률, 쌈짓돈 입출금·내역 시트 |
| DB | `20260707005235_add_asset_category_kind` | `AssetCategory.kind` 컬럼 추가·시드 마커 지정 |
| DB | `20260707095940_add_savings_account` | `SavingsAccount` 테이블 생성 |
| DB | `20260707102420_add_investment_position` | `InvestmentPosition` 테이블 생성 |
| DB | `20260707104224_add_savings_box_txn` | `SavingsBoxTxn` 테이블 생성 |

## 5. 확인 방법
- [ ] `make typecheck` · `make lint` · `make test` 통과
- [ ] `make dev-up` 후 저축·투자 세그먼트로 전환하면 순자산 hero·요약 카드가 뜬다. 적금 계좌를 추가하고 목표를 저장하면 진행률이 반영되고, 투자 수익률을 입력하면 평가손익이 계산되며, 쌈짓돈에 입금하면 잔액이 늘고 순자산에 합산된다.
- [ ] 관련 QA: `docs/qa/qa-scenarios.md`의 `SAVINGS`
