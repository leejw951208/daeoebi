# 고정 지출 탭 · 저축·투자 누적 기준 · 쌈짓돈 개명

작성일: 2026-07-14
브랜치: `feat/recurring-tab` (base: `develop`)
디자인 원본: claude.ai/design `daeoebi` 프로젝트 / `daeoebi.dc.html`

## 배경

고정 지출(`RecurringExpense`)은 템플릿으로 저장되고, 각 달 화면을 열 때 클라이언트가 그 달치 인스턴스(`Expense`)를 생성한다(`materializeRecurring`). 그래서 지금은 "내가 등록해 둔 고정 지출이 무엇무엇인지"를 한눈에 볼 방법이 없다.

또 저축·투자 탭은 값은 이미 누적인데 라벨만 "7월 +160,000" 처럼 월 기준이라 어긋나 있고, 쌈짓돈(구 "세이빙 박스") 잔액이 순자산에서 빠져 있다.

세 가지를 디자인 원본(`daeoebi.dc.html`) 기준으로 맞춘다. 서버·DB·API 변경은 없다. 전부 웹에서 끝난다.

---

## A. 고정 지출 탭 (신규)

### 세그먼트

`지출` / `고정 지출` / `저축·투자` 3개. 첫 탭 라벨이 디자인에서는 `이번 달` 이 아니라 **`지출`** 이므로 함께 바꾼다.

월 이동 화살표·카테고리 버튼은 지금도 첫 탭에서만 보인다. 고정 지출은 특정 월에 매이지 않으므로 저축·투자 탭과 같이 숨긴 채로 둔다.

### 데이터

`asset/page.tsx` 의 `load()` 는 이미 `listRecurring()` 으로 활성 템플릿을 받아 머티리얼라이즈에만 쓰고 버린다. 이 템플릿을 복호화해 상태에 함께 담는다. **추가 네트워크 요청은 없다.**

```
load()
  listRecurring() ──┬─> materializeRecurring()      (기존)
                    └─> 복호화 ─> Loaded.recurrings  (신규)
```

복호화는 기존 지출·예산과 같이 `Promise.allSettled` + `openExpense` 로 하고, 실패분(손상된 블롭)은 스킵한다.

```ts
export interface ComputedRecurring {
    id: string
    item: string
    amount: number
    dayOfMonth: number
    termMonths: number | null // null = 무기한
    categoryId: string | null // 아이콘 색·이니셜 배경에 쓴다
}
```

### 화면 (`RecurringTab.tsx` 신규)

요약 카드 — 라벨 `매달 나가는 고정 지출`, 합계(34px, 800), 우측 하단에 `{n}건`.

행 — 읽기 전용 카드. 카테고리 색 40×40 아이콘(지출명 첫 글자) + 지출명 + 보조줄 + 금액.

```
[넷] 넷플릭스              -17,000원
     매월 15일 · 6개월
[월] 월세                 -500,000원
     매월 25일 · 무기한
```

- 보조줄: `매월 {dayOfMonth}일 · {termMonths}개월`, 무기한이면 `매월 {dayOfMonth}일 · 무기한`
- 금액은 지출이므로 `-` 부호를 붙인다(디자인 `'-'+won(e.amount)`)
- 정렬: 결제일 오름차순, 같으면 지출명 사전순
- 빈 상태: `아직 고정 지출이 없어요` / `지출을 추가할 때 '고정 지출'을 켜면 여기에 모여요.`

### 순수 함수 (`_lib/asset-recurring.ts`)

```ts
formatDayOfMonth(15)   // "매월 15일"
formatTerm(6)          // "6개월"
formatTerm(null)       // "무기한"
totalRecurring(rows)   // 금액 합계
sortRecurring(rows)    // 결제일 asc, 동률이면 item asc (새 배열 반환)
```

### 범위 밖 (YAGNI)

- 탭에서의 수정·삭제·고정 해제. **읽기 전용**이다. 수정은 기존대로 이번 달 지출 항목을 통해 한다.
- 고정 해제된(`active=false`) 템플릿 표시. `listRecurring()` 이 활성만 반환한다.

---

## B. 저축·투자 탭 — 월별에서 누적 기준으로

### 순자산에 쌈짓돈 합산

지금은 `netWorth = savedTotal + investValue` 라 쌈짓돈 잔액이 빠져 있고, 정작 저축 카드는 쌈짓돈으로 이체한 금액을 뺀 값을 보여준다(중복 집계 방지). 디자인 기준으로 통일한다.

```
netWorth = displayedSaved + investValue + boxBalance
         = (savedTotal - box.fromSavings) + investValue + boxBalance
```

- 저축→쌈짓돈 이체: 저축에서 빠지고 쌈짓돈에 들어와 순자산 불변
- 현금→쌈짓돈 입금: 순자산 증가
- 쌈짓돈 출금: 순자산 감소

### 라벨을 누적 기준으로

숫자는 이미 전체 기간 누적인데 배지만 월 기준이라 어긋나 있었다. 배지를 누적 표기로 바꾼다.

| 위치 | 지금 | 바꿀 것 |
|---|---|---|
| 순자산 hero | `7월 +160,000 적립` | `누적 +{누적 적립} 적립` |
| 순자산 hero 보조 | `· 지출 3건 자동 연동` | `· 지출 {전체 기간 적립 건수}건 자동 연동` |
| 저축 카드 | `7월 +100,000` | `누적 +{누적 저축 적립}` |
| 투자 카드 | `7월 +60,000` | `누적 +{누적 투자 적립}` |

`SavingsTab` 의 `month` prop 은 더 이상 쓰이지 않으므로 제거한다.

### 계좌 뷰의 `month` 필드 의미 변경

`SavingsAccountView.month` 는 "이번 달 적립"인데, 이제 화면 어디에도 월 기준 값이 없다. 의미를 **누적 적립**으로 바꾸고 이름도 `contributed` 로 고친다(값이 뜻을 배신하지 않게).

- `savingsAccountsView(accounts, totalByItem, monthByItem)` → `savingsAccountsView(accounts, contribByItem)`
- 반환 `{ rows, savedTotal, savedMonth }` → `{ rows, savedTotal, savedContributed }`
- `SavingsAccountView.month` → `contributed`, `total = base + contributed`
- 계좌 행 배지 `+{a.month}` → `+{a.contributed}` (누적 적립)
- `SavingsAccountGoalSheet` 의 `EditingAccount.month` → `contributed`

투자도 같다. `investMonth`(이번 달 투자 적립) → `investContributed`(전체 기간 투자 적립). 이미 `investmentView` 는 전체 기간 적립으로 원금을 계산하고 있어 계산은 그대로다.

### 최근 적립 내역

- 지금: 보고 있는 달의 적립만(`filterByMonth(contribAll, month)`)
- 바꿀 것: **전체 기간 적립을 날짜 내림차순 정렬 후 상위 5건**
- 헤더 건수 `지출 연동 · {n}건` 의 `n` 도 전체 기간 건수

정렬은 `sortContributionsByDateDesc(rows)` 순수 함수로 뺀다.

---

## C. "세이빙 박스" → "쌈짓돈"

사용자에게 보이는 문구를 전부 바꾼다.

| 위치 | 지금 | 바꿀 것 |
|---|---|---|
| 카드 제목 | `세이빙 박스` | `쌈짓돈` |
| 입출금 시트 제목 · `aria-label` | `세이빙 박스 입금/출금` | `쌈짓돈 입금/출금` |
| 입금 시트 설명 | `...남은 돈을 박스에 넣어두세요.` | `...남은 돈을 쌈짓돈에 넣어두세요.` |
| 출금 시트 설명 | `박스에서 돈을 꺼내 쓴 내역을...` | `쌈짓돈에서 돈을 꺼내 쓴 내역을...` |
| 내역 시트 제목 · `aria-label` | `세이빙 박스 내역` | `쌈짓돈 내역` |

**코드 식별자는 그대로 둔다.** `SavingsBoxSheet`, `savingsBoxBalance`, `/savings-box` API 라우트, `SavingsBoxTxn` 테이블은 서버 스키마·엔드포인트와 맞물려 있고 사용자에게 보이지 않는다. 개명은 UI 문구에 한정한다.

주석에 남은 "세이빙 박스" 표현은 코드를 만지는 김에 "쌈짓돈"으로 정리한다. E2E 셀렉터(`savings.spec.ts` 의 `getByText("세이빙 박스")`, `getByRole("dialog", { name: "세이빙 박스 입금" })` 등)도 함께 갱신한다.

---

## 함께 정리할 것

세그먼트 버튼이 거의 동일한 인라인 스타일 블록으로 2번 복붙돼 있다(`asset/page.tsx:611-668`). 3개째를 그대로 붙이면 3중복이 된다. 탭 정의를 배열로 두고 `map` 으로 렌더링해 한 벌로 줄인다. 디자인 원본도 `seg(on)` 헬퍼 하나로 처리한다. 지금 손대는 코드에 한정한 정리이며, 그 밖의 리팩토링은 하지 않는다.

## 오류 처리

- 템플릿 복호화 실패: 해당 행만 스킵한다(기존 지출·예산과 동일). 탭 전체가 죽지 않는다.
- 로드 실패: 기존 `State.error` 를 그대로 쓴다. 고정 지출 탭은 지연 로드가 아니므로 탭별 오류 상태를 만들지 않는다.

## 테스트

TDD(RED → GREEN)로 진행한다.

**단위 — `_lib/asset-recurring.spec.ts`**
- `formatDayOfMonth` 가 "매월 N일" 을 만든다
- `formatTerm` 이 개월 수는 "N개월", null 은 "무기한" 을 만든다
- `totalRecurring` 이 금액을 합산한다 (빈 배열은 0)
- `sortRecurring` 이 결제일 오름차순으로 정렬하고, 동률이면 지출명 순이며, 입력을 변형하지 않는다

**단위 — `_lib/asset-compute.spec.ts` (기존 파일에 추가·수정)**
- `savingsAccountsView` 가 누적 적립(`contributed`)과 `total = base + contributed` 를 낸다
- `sortContributionsByDateDesc` 가 날짜 내림차순으로 정렬하고 입력을 변형하지 않는다

**단위 — `_components/dashboard/RecurringTab.spec.tsx` (신규)**
- 지출명·`매월 N일`·개월 수·금액이 모두 렌더링된다
- 무기한 템플릿은 `무기한` 으로 표시된다
- 요약 카드에 합계와 건수가 나온다
- 템플릿이 없으면 빈 상태 문구가 나온다

**단위 — `_components/dashboard/SavingsTab.spec.tsx` (기존 파일 수정)**
- 순자산이 저축 + 투자 + 쌈짓돈 잔액으로 표시된다
- 배지가 `누적 +...` 로 표시된다(월 표기 없음)
- 적립 내역이 날짜 내림차순 5건까지만 렌더된다
- 카드 제목이 `쌈짓돈` 이다

**E2E**
- `recurring.spec.ts` 에 추가: 고정 지출을 만든 뒤 `고정 지출` 탭에 들어가면 그 항목의 지출명·`매월 15일`·개월 수·금액이 보인다
- `savings.spec.ts` 수정: `세이빙 박스` 셀렉터를 `쌈짓돈` 으로 갱신

## 완료 기준

- 위 테스트 전부 통과
- `make typecheck`, `make lint` 통과
- 기존 단위 테스트 214개 + E2E 19개 회귀 없음
