# 고정 지출 탭 설계

작성일: 2026-07-14
브랜치: `feat/recurring-tab` (base: `develop`)

## 배경

고정 지출(`RecurringExpense`)은 템플릿으로 저장되고, 각 달 화면을 열 때 클라이언트가 그 달치 인스턴스(`Expense`)를 생성한다(`materializeRecurring`). 그래서 지금은 "내가 등록해 둔 고정 지출이 무엇무엇인지"를 한눈에 볼 방법이 없다. 이번 달 달력에 흩어진 인스턴스를 눈으로 훑는 수밖에 없다.

자산 페이지에 고정 지출 템플릿만 모아 보는 탭을 추가한다.

## 목표

자산 페이지 하위 탭에서 활성 고정 지출 템플릿 목록을 본다. 각 행은 **지출명·매월 결제일·금액·개월 수** 를 보여준다. 목록 위에 매달 나가는 고정 지출 합계와 건수를 요약한다.

## 범위 밖 (YAGNI)

- 탭에서의 수정·삭제·고정 해제. 목록은 **읽기 전용**이다. 수정은 기존대로 이번 달 지출 항목을 통해 한다.
- 고정 해제된(`active=false`) 템플릿 표시. `listRecurring()` 이 활성만 반환하므로 애초에 목록에 들어오지 않는다.
- 서버·DB·API 변경. 전부 웹에서 끝난다.

## 아키텍처

### 데이터 흐름

`asset/page.tsx` 의 `load()` 는 이미 `listRecurring()` 으로 활성 템플릿을 받아 머티리얼라이즈에만 쓰고 버린다. 이 템플릿을 복호화해 상태에 함께 담는다. **추가 네트워크 요청은 없다.**

```
load()
  listRecurring() ──┬─> materializeRecurring()   (기존)
                    └─> 복호화 ─> Loaded.recurrings  (신규)
```

복호화는 기존 지출·예산과 같이 `Promise.allSettled` + `openExpense` 로 하고, 실패분(손상된 블롭)은 스킵한다. 템플릿은 통상 10건 미만이라 비용이 없다.

### 타입

```ts
// asset-compute.ts
export interface ComputedRecurring {
    id: string
    item: string
    amount: number
    dayOfMonth: number
    termMonths: number | null // null = 무기한
}
```

`Loaded` 에 `recurrings: ComputedRecurring[]` 를 추가한다.

### 컴포넌트

| 파일 | 역할 |
|---|---|
| `_components/dashboard/RecurringTab.tsx` (신규) | 요약 카드 + 목록 렌더링. props 로 받은 값만 그리는 순수 표시 컴포넌트 |
| `_components/dashboard/AssetDashboard.tsx` | `assetTab === "recurring"` 분기 추가 |
| `asset/page.tsx` | 세그먼트 3개, 템플릿 복호화 |
| `_lib/asset-recurring.ts` | 포맷터·합계·정렬 순수 함수 추가 |

`SavingsTab` 과 동일한 경계다. 데이터 로드·복호화는 페이지가, 표시는 탭 컴포넌트가 맡는다.

### 순수 함수 (`_lib/asset-recurring.ts`)

```ts
formatDayOfMonth(15)   // "매월 15일"
formatTerm(6)          // "6개월"
formatTerm(null)       // "무기한"
totalRecurring(rows)   // 금액 합계
sortRecurring(rows)    // dayOfMonth 오름차순 (동률이면 item 사전순)
```

정렬은 새 배열을 반환한다(입력 불변).

## 화면

세그먼트: `이번 달` / `고정 지출` / `저축·투자`

월 이동 화살표는 지금도 `이번 달` 탭에서만 보인다. 고정 지출은 특정 월에 매이지 않으므로 저축·투자 탭과 같이 숨긴 채로 둔다.

```
┌────────────────────────────┐
│ 매달 나가는 고정 지출        │
│ 452,000원          5건      │
└────────────────────────────┘
┌────────────────────────────┐
│ [넷] 넷플릭스     17,000원  │
│      매월 15일 · 6개월      │
│ [월] 월세        500,000원  │
│      매월 25일 · 무기한     │
└────────────────────────────┘
```

행은 기존 `entry-card` 스타일을 따르되 `Link` 가 아닌 `div` 다(읽기 전용). 아이콘은 지출명 첫 글자.

빈 상태:

> 아직 고정 지출이 없어요
> 지출을 추가할 때 '고정 지출'을 켜면 여기에 모여요.

## 함께 정리할 것

세그먼트 버튼이 거의 동일한 인라인 스타일 블록으로 2번 복붙돼 있다(`asset/page.tsx:611-668`). 3개째를 그대로 붙이면 3중복이 된다. 탭 정의를 배열로 두고 `map` 으로 렌더링해 한 벌로 줄인다. 지금 손대는 코드에 한정한 정리이며, 그 밖의 리팩토링은 하지 않는다.

## 오류 처리

- 템플릿 복호화 실패: 해당 행만 스킵한다(기존 지출·예산과 동일). 탭 전체가 죽지 않는다.
- 로드 실패: 기존 `State.error` 를 그대로 쓴다. 탭별 별도 오류 상태를 만들지 않는다(저축·투자와 달리 지연 로드가 아니므로).

## 테스트

TDD(RED → GREEN)로 진행한다.

**단위 — `_lib/asset-recurring.spec.ts`**
- `formatDayOfMonth` 가 "매월 N일" 을 만든다
- `formatTerm` 이 개월 수는 "N개월", null 은 "무기한" 을 만든다
- `totalRecurring` 이 금액을 합산한다 (빈 배열은 0)
- `sortRecurring` 이 결제일 오름차순으로 정렬하고 입력을 변형하지 않는다

**단위 — `_components/dashboard/RecurringTab.spec.tsx`**
- 지출명·결제일·금액·개월 수가 모두 렌더링된다
- 요약 카드에 합계와 건수가 나온다
- 템플릿이 없으면 빈 상태 문구가 나온다

**E2E — `tests/e2e/recurring.spec.ts` 에 추가**
- 고정 지출을 만든 뒤 `고정 지출` 탭에 들어가면 그 항목의 지출명·결제일·금액·개월 수가 보인다

## 완료 기준

- 위 테스트 전부 통과
- `make typecheck`, `make lint` 통과
- 기존 214개 단위 테스트 + 19개 E2E 회귀 없음
