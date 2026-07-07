# 저축·투자 탭 재설계 — 디자인 v5 싱크 (Spec)

- 작성일: 2026-07-07
- 대상: 자산 대시보드 "저축·투자" 탭을 디자인(`daeoebi.dc.html`, 화면 11)에 맞춰 재설계
- 브랜치: `feat/savings-investment-redesign` (develop 기준)
- 전제: 기존 파생-뷰 저축·투자(단일 SavingsGoal + 적립 누적)를 **확장·대체**한다. 모든 금액은 앱 전체와 동일하게 VK(AES-256-GCM) 암호화 blob 패스스루로 저장한다(서버 복호화 없음).

## 1. 개요·구성

저축·투자 탭 위→아래:
1. **순자산 hero** — `netWorth` = 저축 합계 + 투자 평가금액. "이번 달 N원 적립 · 지출 M건 자동 연동".
2. **저축 / 투자 요약 카드** — 저축 합계(이번 달), 투자 평가금액(이번 달).
3. **적금 계좌 목록** — 계좌별 잔액·목표 진행률·이번 달 적립. 추가/수정/삭제.
4. **세이빙 박스** — 입출금 원장(잔액·건수·입금/출금·내역 보기).
5. **투자 수익률 카드** — 원금·평가금액·평가손익·수익률(탭하여 수정).
6. **이번 달 적립 내역** — `저축`/`투자` 카테고리 지출 연동 목록.

시트: 적금 목표(수정·삭제), 적금 추가, 투자 수익률, 세이빙 박스 입출금, 세이빙 박스 내역, (카테고리 관리는 §6 별도).

## 2. 데이터 모델 (신규, 전부 암호화 blob)

> **선행(Unit 0):** `AssetCategory` 에 `kind`(`NORMAL`|`SAVINGS`|`INVESTMENT`) 시스템 마커 추가. 저축/투자 카테고리 식별·적금 item 매칭·적립 집계는 **이름/코드가 아니라 kind 기준**으로 한다(이름·코드는 사용자 변경 가능해 앵커 부적합). 기존 파생 로직(`savingsSummary` 등)도 kind 기준으로 교체.


기존 `Income`/`Expense` 패스스루 패턴(iv/ciphertext/authTag)을 그대로 따른다.

- **`SavingsAccount`** (적금 계좌, 다건)
  - `id`, `name`(평문 식별·item 매칭용), 암호화 blob `{ base, goal }`(누적 잔액·목표 금액), `color`(평문), `createdAt/updatedAt`.
  - 이번 달 적립은 저장하지 않는다 — `저축` 카테고리 지출 중 `item === name`을 클라가 합산.
  - > 기존 단일 `SavingsGoal` 모델은 이 다건 모델로 대체(마이그레이션에서 드롭 또는 미사용 처리).
- **`InvestmentPosition`** (싱글톤)
  - 암호화 blob `{ base }`(원금 베이스) + `returnRate`(평문 소수 문자열, 예 "8.5"). 원금 = base + 이번 달 `투자` 지출 합.
- **`SavingsBoxTxn`** (세이빙 박스 입출금, 다건)
  - `id`, `type`(평문 `in`|`out`), `source`(평문 `cash`|`savings`), `date`(평문 "YYYY-MM-DD"), 암호화 blob `{ amount, memo }`.

## 3. 백엔드 (asset 모듈)

각 리소스 CRUD를 Income 패스스루 패턴으로. 전부 세션 가드 + CsrfMiddleware.
- `SavingsAccount`: `GET /savings-accounts`(목록), `POST`(생성: name·color·blob), `PATCH /:id`(blob·color), `DELETE /:id`.
- `InvestmentPosition`: `GET /investment`(단건 or null), `PUT /investment`(returnRate + blob upsert 싱글톤).
- `SavingsBoxTxn`: `GET /savings-box`(목록, date desc), `POST`(type·source·date·blob), `DELETE /:id`.

## 4. 계산 (asset-compute 순수 함수 + 테스트)

- `savingsAccountsView(accounts, monthByItem)` → 각 계좌 `{name,color,base,month,total,goal,goalPct,remain}` + `savedTotal`,`savedMonth`. month = `monthByItem[name] ?? 0`. total=base+month. goalPct=clamp(round(total/goal*100),0,100) (goal>0).
- `investmentView({base, returnRate}, investMonth)` → `{principal, rate, value, pnl}`. principal=base+investMonth. value=round(principal*(1+rate/100)) (rate 유효 시) else principal. pnl=value−principal.
- `savingsBoxBalance(txns)` → `{balance, inTotal, outTotal, fromSavings}`. balance=in−out.
- `monthByCategoryItem(expenses, categories, categoryName)` → 이번 달 해당 카테고리 지출을 item별 합산 Map(적금 month 매칭용). (기존 `filterByMonth`·카테고리 이름 매칭 재사용)
- 이번 달 적립 내역: `저축`+`투자` 카테고리 이번 달 지출(기존 파생 로직 재사용).

## 5. 프론트

- vault-client: 위 3 리소스 함수 + View 타입. asset-payload: `sealAccount/openAccount({base,goal})`, `sealInvestment/openInvestment({base})`, `sealBoxTxn/openBoxTxn({amount,memo})`.
- UI 컴포넌트(dashboard):
  - `SavingsTab` 재작성 — hero·요약카드·적금목록·세이빙박스·투자카드·적립내역.
  - 시트: `SavingsAccountGoalSheet`(수정·삭제), `SavingsAccountAddSheet`(이름·현재저축액·목표), `InvestmentReturnSheet`, `SavingsBoxSheet`(입출금·출처·메모), `SavingsBoxDetailSheet`(내역·삭제·더보기).
- `asset/page.tsx`: 저축·투자 탭 진입 시 세 리소스 + 이번 달 지출(이미 로드) 지연 로드·복호화(실패 스킵), 세그먼트·시트 상태. 쓰기 후 재로드.
- 프리셋 칩(목표/수익률)은 디자인의 `goalPresets`·`returnPresets`·`addGoalPresets` 값을 그대로.

## 6. 카테고리 관리 시트 재설계

디자인 v5의 카테고리 관리는 바텀시트 **목록 ↔ 추가/수정 폼** 2모드(코드·색 스와치 팔레트 포함). 현재 앱 `CategoryManager`(별도 시트, 인라인 행 편집)를 이 2모드 시트 형태로 맞춘다. 기능(이름·코드 고유·색·삭제 미분류)은 유지, UI 구조만 디자인에 정렬.

## 7. 에러·비파괴

- 조회 실패 "불러오지 못했습니다.", 저장 실패 "저장하지 못했어요. 다시 시도해 주세요."(기존 문구), 복호화 실패 스킵.
- 기존 예산·지출·고정지출 로직 변경 없음. "이번 달"(budget) 탭 렌더 불변.

## 8. 테스트

- 단위: asset-compute(savingsAccountsView·investmentView·savingsBoxBalance·monthByCategoryItem) + 각 서비스 spec.
- e2e: 세그먼트 전환, 적금 추가·목표, 투자 수익률 저장→평가손익, 세이빙 박스 입금→잔액.
- QA: SAVINGS 시나리오 확장(적금·투자평가·세이빙박스).

## 9. 규모·분해

대형이라 구현 플랜에서 하위 단위로 나눈다: (a) 적금 계좌, (b) 투자 포지션, (c) 세이빙 박스, (d) 카테고리 관리 시트 정렬. 각 단위는 backend→compute→client→UI→test 순. 순서: 적금 → 투자 → 세이빙 박스 → 카테고리 시트.
