# 고정 지출 종료월 선택

작성일: 2026-08-03

## 배경

고정 지출 템플릿은 `termMonths`(개월 수)로 기간을 정한다. `null`이면 무기한이다.

무기한으로 만든 항목을 나중에 끊으려면 지금은 두 가지 방법뿐인데, 둘 다 문제가 있다.

**개월 수를 고쳐 종료월을 만드는 방법**은 실제로 쓸 수 없다. `RecurringTab.tsx:199`가 무기한 템플릿에 대해 `"무기한"`만 출력하고 시작월을 어디에도 보여주지 않기 때문에, "7월까지"에 해당하는 개월 수를 사용자가 계산할 근거가 없다.

**고정 해제**(`ExpenseForm.tsx:211`)는 이력을 잃는다. 템플릿의 `active`를 끄는데, `listRecurring()`이 `active: true`만 반환하므로(`recurring.service.ts:52`) 과거 달을 열어도 고정 지출 탭에서 그 항목이 사라진다. 그 달의 고정 지출 합계도 줄고, 지출 행의 "고정" 배지도 과거 건까지 없어진다(`asset-compute.ts:46`).

즉 "7월까지는 고정 지출이었다"는 사실을 남기면서 8월부터 끊을 방법이 없다.

## 목표

고정 지출 폼에서 개월 수 대신 **종료월을 직접 고르게** 한다. 종료월 이후에 이미 만들어진 지출은 정리하고, 그 이전 기록과 템플릿은 그대로 남긴다.

## 하지 않는 것

- 스키마 변경. `termMonths`가 계속 저장 형식이다.
- 고정 해제 기능 제거. 그대로 둔다.
- 비활성 템플릿을 과거 달 고정 지출 탭에 되살리는 작업. 별개 문제다.

## 저장 방식

`termMonths`를 유지하고 종료월은 폼 안에서만 존재한다. 저장 직전에 개월 수로 환산해 기존 API로 보낸다.

`endMonth` 컬럼을 새로 두는 안도 검토했으나, 사용자가 얻는 결과가 같은데 마이그레이션·백필·DTO·서비스 전면 수정이 따라온다. 사용자가 겪는 문제는 표현 계층 문제이고 저장 형식은 이미 그 정보를 온전히 담고 있다.

이 선택이 성립하는 근거는 **기존 템플릿의 `startMonth`가 불변**이라는 점이다. `UpdateRecurringDto`에 `startMonth`가 없어 서버가 바꿔주지 않으므로, 수정 모드에서 종료월↔개월 수 환산 기준이 흔들리지 않는다.

## 화면 동작

고정 ON 일 때 "개월 수" 텍스트 입력 자리에 **"종료월" select**가 온다.

첫 옵션은 `설정 안 함(무기한)`이고, 그 아래로 월 목록이 이어진다(`2025년 1월`, `2025년 2월`, …). 도움말은 선택 상태에 따라 바뀐다 — 무기한이면 기존 문구를 유지하고, 종료월이 잡히면 "이 달까지만 나가고 끝나요."

네이티브 `input type="month"`는 쓰지 않는다. iOS Safari가 지원하지 않아 텍스트 입력칸으로 떨어진다.

### 목록 범위

- 하한: 시작월. 시작월보다 앞선 종료월은 목록에 없으므로 별도 검증이 필요 없다.
- 상한: 현재 달 + 24개월. 단 기존 종료월이 그보다 뒤면 그 달까지 늘린다. 늘리지 않으면 select 값이 목록에 없어 열어보기만 해도 값이 조용히 바뀐다.

시작월까지 과거 방향을 전부 여는 이유는, 몇 달 밀린 뒤에 정리하는 경우(11월에 들어와 7월까지로 끊기)를 지원하기 위해서다. 대신 잘못 고르면 기록이 대량으로 지워지므로 확인 단계를 둔다.

### 삭제 확인

저장할 때 종료월 이후에 이미 만들어진 지출이 있으면 `ConfirmDialog`(`components/ConfirmDialog.tsx`)로 한 번 묻는다.

> 2025년 8월부터의 지출 3건이 삭제됩니다. 계속할까요?

확인하면 저장·삭제를 진행하고, 취소하면 아무것도 쓰지 않고 폼에 머문다. 삭제 대상이 없으면 확인 없이 바로 저장한다.

건수는 저장 버튼을 누른 뒤 쓰기 전에 `listRecurringInstances(templateId, endMonth)`로 센다. 이 API는 `period > fromPeriod`이고 `removed: false`라(`expense.service.ts:119`) 삭제 대상과 정확히 일치한다.

신규 생성에는 삭제 대상이 있을 수 없으므로 확인이 뜨지 않는다.

## API

`GET /recurring/:id`를 추가한다. `active` 여부와 무관하게 단건을 반환하고, 없으면 404다.

고정 해제했던 지출에서 고정을 다시 켜는 경로(`ExpenseForm.tsx:169`) 때문에 필요하다. 이때 `listRecurring()`이 비활성 템플릿을 주지 않아 `template`이 `null`이고(`[id]/page.tsx:55`), 옛 템플릿의 `startMonth`를 클라이언트가 모른다. 개월 수는 시작월 없이도 의미가 통했지만 종료월은 그렇지 않다.

`[id]/page.tsx`는 `listRecurring()`에서 못 찾았는데 `view.recurringId`가 있으면 이 API를 추가로 호출해 `template`을 채운다.

그 결과 `ExpenseFormInitial.template`의 의미가 "활성 템플릿"에서 "연결된 템플릿"으로 바뀐다. `active: boolean`을 필드로 추가하고, 지금 `template !== null`로 활성 여부를 판정하는 세 곳을 `template?.active === true` 기준으로 옮긴다.

- `wasRecurring` (토글 초기값·전환 분기)
- 고정 해제 분기 (`ExpenseForm.tsx:208`)
- 삭제 메뉴 분기 (`ExpenseForm.tsx:707`, 활성 고정만 "전체/이번 달" 선택지를 준다)

## 순수 함수

### `asset-dates.ts`

- `monthsBetween(from, to): number` — `(y2-y1)*12 + (m2-m1)`.
- `monthRange(from, to): string[]` — 양끝 포함 월 목록.

### `asset-recurring.ts`

- `termMonthsFromEnd(startMonth, endMonth | null): number | null` 추가 — `endMonthOf`의 역방향. `null`이면 `null`, 아니면 `monthsBetween + 1`(최소 1).
- `endMonthOptions(startMonth, nowMonth, currentEnd): string[]` 추가 — 드롭다운 옵션. 범위 계산이 여기 모여 컴포넌트는 렌더만 한다.
- `parseTermMonths` 제거 — 텍스트 입력이 사라지면 호출부가 없다.
- `formatTerm` 제거, `formatExpiry`는 종료월만 반환 (표시 라벨 절 참고).

## 저장 흐름

`ExpenseForm`의 상태가 `termMonths: string`에서 `endMonth: string | null`로 바뀐다. 초기값은 `endMonthOf(template.startMonth, template.termMonths)`다.

저장 직전에 `termMonthsFromEnd(startMonth, endMonth)`로 환산해 기존 API 호출에 그대로 넘긴다. `startMonth`는 수정 모드면 `template.startMonth`, 신규면 `monthOf(date)`다.

신규 폼에서 날짜를 바꾸면 시작월이 따라 움직인다. 선택된 종료월이 새 시작월보다 앞서게 되면 무기한으로 되돌리고 토스트로 알린다. 조용히 어긋난 값을 저장하는 것보다 낫다.

## 삭제 범위

`propagateRecurringUpdate`에서 갱신 범위와 삭제 범위를 분리한다.

- 갱신(재봉인): `period > pivot`. 지금과 같다. 지나간 달의 확정 기록은 덮어쓰지 않는다.
- 삭제: `period > endMonth`. **현재 달도 포함한다.** 종료월을 7월로 골랐으면 8월 건은 나가지 않은 돈이다.

조회는 `listRecurringInstances(id, min(pivot, endMonth))`로 한 번 넓게 가져와 각 인스턴스를 두 기준으로 분기한다. `endMonth`가 `null`이면 삭제 대상이 없어 지금과 완전히 같게 동작한다.

이 변경 전에는 삭제가 `period > pivot`에 묶여 있어, 8월에 종료월을 7월로 지정해도 이미 만들어진 8월 인스턴스가 남았다.

## 표시 라벨

고정 지출 탭이 `"매월 15일 · 2025년 7월까지 · 7개월"`에서 `"매월 15일 · 2025년 7월까지"`로 짧아진다. 종료월을 직접 고르게 된 이상 개월 수는 파생 정보이고, 한 줄에 기간 표현이 둘 있으면 읽는 데 방해가 된다. 무기한은 `"무기한"` 그대로다.

## 테스트

**단위 (`asset-recurring.spec.ts`, `asset-dates` 관련)**
- `termMonthsFromEnd` — `endMonthOf`와 서로 역함수인지 왕복 검증. 같은 달(1개월), 해 넘김, `null` 왕복.
- `endMonthOptions` — 시작월 하한, 현재 달 + 24개월 상한, 기존 종료월이 상한을 넘을 때 확장.
- `monthsBetween` / `monthRange` — 해 넘김 포함.
- `propagateRecurringUpdate` — 종료월 이후 인스턴스는 현재 달이어도 삭제되고, 종료월 이내이면서 `pivot` 이전인 인스턴스는 건드리지 않는다.

**컴포넌트 (`ExpenseForm.spec.tsx`)**
- 템플릿의 종료월이 select에 선택된 상태로 보인다.
- 무기한을 고르면 `termMonths: null`이 나간다.
- 삭제 대상이 있으면 확인 다이얼로그가 뜨고, 취소하면 아무 쓰기도 일어나지 않는다.

**E2E (`tests/e2e/recurring.spec.ts`)**
- `getByLabel("개월 수")` 입력을 종료월 선택으로 교체.
- 고정 지출 탭 라벨 검증 문자열을 표시 라벨 절에 맞춰 교체.

**API (`apps/api`)**
- `GET /recurring/:id` — 활성/비활성 모두 조회되고, 없는 id는 404.

## 검증 시나리오

2025년 1월부터 무기한으로 나가던 고정 지출이 있고, 오늘이 2025년 8월이며 8월 인스턴스가 이미 만들어져 있다.

1. 8월 지출 건을 열어 종료월을 `2025년 7월`로 고른다.
2. "2025년 8월부터의 지출 1건이 삭제됩니다" 확인이 뜬다. 확인한다.
3. 8월 지출 건이 사라진다. 9월 이후 예정 행도 사라진다.
4. 7월 달로 이동하면 지출 기록이 그대로 있고, 고정 지출 탭에도 `매월 N일 · 2025년 7월까지`로 남아 있다.
5. 7월 지출 행의 "고정" 배지가 유지된다(템플릿이 `active`로 남아 있으므로).
