# Review: payment-reminders

## 리뷰 개요

- 일자: 2026-05-17
- Spec: docs/features/payment-reminders/spec.md
- Plan: docs/features/payment-reminders/plan.md

---

## 1. Spec 일치 여부

| 처리상태 | 심각도 | 판정 | # | 요구사항 | 근거 | 보강 지시 |
|----------|--------|------|---|----------|------|-----------|
| CLOSED | low | DONE | S1 | 대시보드에서 오늘 기준 `SCHEDULED` occurrence를 조회하고 연체, 오늘, 3일 이내, 7일 이내로 분류한다 | docs/features/payment-reminders/spec.md:19-22, apps/web/app/page.tsx:73-101, apps/web/app/occurrences/reminder-state.ts:60-72 | 없음 |
| CLOSED | low | DONE | S2 | 대시보드 리마인더 요약은 count와 합계 금액을 보여준다 | docs/features/payment-reminders/spec.md:15, docs/features/payment-reminders/spec.md:84, apps/web/app/page.tsx:137-157, apps/web/app/occurrences/reminder-state.ts:84-109 | 없음 |
| CLOSED | low | DONE | S3 | 각 요약 항목은 `/occurrences` 상태·기간 필터 링크로 이동한다 | docs/features/payment-reminders/spec.md:22, docs/features/payment-reminders/spec.md:86, apps/web/app/page.tsx:142-145, apps/web/app/occurrences/reminder-state.ts:111-130 | 없음 |
| CLOSED | low | DONE | S4 | `/occurrences` 리스트는 연체, 오늘, 3일 이내, 7일 이내, 예정 배지를 표시한다 | docs/features/payment-reminders/spec.md:41, apps/web/app/occurrences/OccurrencesView.tsx:92-107, apps/web/app/occurrences/reminder-state.ts:26-33 | 없음 |
| CLOSED | low | DONE | S5 | `PAID`와 `SKIPPED` occurrence는 긴급 리마인더 배지를 표시하지 않는다 | docs/features/payment-reminders/spec.md:42, apps/web/app/occurrences/reminder-state.ts:60-64, apps/web/app/occurrences/reminder-state.spec.ts:79-89 | 없음 |
| CLOSED | low | DONE | S6 | 기본 정렬은 기존 dueDate 오름차순을 유지한다 | docs/features/payment-reminders/spec.md:43, apps/api/src/occurrences/occurrences.service.ts:35-38 | 없음 |
| CLOSED | low | DONE | S7 | 연체 항목은 텍스트와 색상으로 명확히 구분한다 | docs/features/payment-reminders/spec.md:44, apps/web/app/occurrences/reminder-state.ts:26-33, apps/web/app/globals.css:443-446 | 없음 |
| CLOSED | low | DONE | S8 | 기존 `OccurrencePanel` 처리 흐름을 유지한다 | docs/features/payment-reminders/spec.md:49, docs/features/payment-reminders/spec.md:67-68, apps/web/app/occurrences/OccurrencesView.tsx:157-169 | 없음 |
| CLOSED | low | DONE | S9 | 외부 푸시, 외부 네트워크 호출, 신규 DB 테이블을 추가하지 않는다 | docs/features/payment-reminders/spec.md:30-33, docs/features/payment-reminders/spec.md:90-92, apps/web/app/page.tsx:73-88, apps/web/lib/api-client.ts:75-80 | 없음 |
| CLOSED | low | DONE | S10 | 날짜 계산은 `Asia/Seoul` 기준 날짜 문자열로 수행한다 | docs/features/payment-reminders/spec.md:78, docs/features/payment-reminders/spec.md:93, apps/web/lib/format.ts:2-24, apps/web/app/occurrences/reminder-state.ts:49-57 | 없음 |
| CLOSED | low | DONE | S11 | 대시보드 초기 렌더에서 occurrence API 호출은 최대 1회만 추가한다 | docs/features/payment-reminders/spec.md:94, apps/web/app/page.tsx:73-88 | 없음 |
| CLOSED | low | DONE | S12 | 예정 항목이 0건이면 리마인더 영역은 빈 상태 문구와 `정기 지출 추가` 또는 `결제 리스트` 진입을 제공한다 | docs/features/payment-reminders/spec.md:98, apps/web/app/page.tsx:158-170, apps/web/app/payment-reminders-dashboard.spec.tsx:35-52 | 없음 |
| CLOSED | low | DONE | S13 | 날짜 파싱 실패 데이터는 화면을 깨뜨리지 않고 일반 예정으로 폴백한다 | docs/features/payment-reminders/spec.md:102, apps/web/app/occurrences/reminder-state.ts:49-72, apps/web/app/occurrences/reminder-state.spec.ts:91-98 | 없음 |

**요약:** DONE 13 / PARTIAL 0 / NOT DONE 0 / CHANGED 0

---

## 2. Plan 일치 여부

| 처리상태 | 심각도 | 판정 | 태스크 | 근거 | 보강 지시 |
|----------|--------|------|--------|------|-----------|
| CLOSED | low | DONE | T001 | apps/web/app/occurrences/reminder-state.ts:60-72 | 없음 |
| CLOSED | low | DONE | T002 | apps/web/app/occurrences/reminder-state.ts:84-109 | 없음 |
| CLOSED | low | DONE | T003 | apps/web/app/occurrences/reminder-state.spec.ts:53-164 | 없음 |
| CLOSED | low | DONE | T004 | apps/web/app/page.tsx:73-88 | 없음 |
| CLOSED | low | DONE | T005 | apps/web/app/page.tsx:137-170 | 없음 |
| CLOSED | low | DONE | T006 | apps/web/app/page.tsx:142-145, apps/web/app/occurrences/reminder-state.ts:111-130 | 없음 |
| CLOSED | low | DONE | T007 | apps/web/app/occurrences/OccurrencesView.tsx:92-107 | 없음 |
| CLOSED | low | DONE | T008 | apps/web/app/globals.css:219-249, apps/web/app/globals.css:432-462 | 없음 |
| CLOSED | low | DONE | T009 | apps/web/app/globals.css:400-406, Playwright smoke `/occurrences` errorCount=0 | 없음 |
| CLOSED | low | DONE | T010 | `pnpm --filter @secrets-manager/web test` 통과. 10 suites, 43 tests | 없음 |
| CLOSED | low | DONE | T011 | `pnpm --filter @secrets-manager/web run typecheck`, `pnpm lint` 통과 | 없음 |
| CLOSED | low | DONE | T012 | `pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json` 통과. 2 suites, 36 tests | 없음 |
| CLOSED | low | DONE | T013 | curl `/` 200, curl `/occurrences?...` 200, Playwright smoke title 정상·errorCount=0 | 없음 |

**스코프 이탈:** 없음

---

## 3. 테스트 커버리지

| 처리상태 | 심각도 | 판정 | 요구사항 | 테스트 | 보강 지시 |
|----------|--------|------|----------|--------|-----------|
| CLOSED | low | TESTED | 연체, 오늘, 3일 경계, 7일 경계, 7일 이후 분류 | apps/web/app/occurrences/reminder-state.spec.ts:61-77 | 없음 |
| CLOSED | low | TESTED | `PAID`와 `SKIPPED` 제외 | apps/web/app/occurrences/reminder-state.spec.ts:79-89 | 없음 |
| CLOSED | low | TESTED | 날짜 파싱 실패 데이터는 `NORMAL`로 폴백한다 | apps/web/app/occurrences/reminder-state.spec.ts:91-98 | 없음 |
| CLOSED | low | TESTED | 요약 bucket count와 total 계산 | apps/web/app/occurrences/reminder-state.spec.ts:101-147 | 없음 |
| CLOSED | low | TESTED | 대시보드 필터 링크 생성 | apps/web/app/occurrences/reminder-state.spec.ts:149-164 | 없음 |
| CLOSED | low | TESTED | 리마인더 요약 0건 빈 상태 문구와 진입 링크 | apps/web/app/payment-reminders-dashboard.spec.tsx:35-52 | 없음 |
| CLOSED | low | TESTED | 기존 웹 화면 테스트 회귀 | `pnpm --filter @secrets-manager/web test` 통과. 10 suites, 43 tests | 없음 |
| CLOSED | low | TESTED | API occurrence 회귀 | `pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json` 통과. 2 suites, 36 tests | 없음 |
| CLOSED | low | TESTED | `/`, `/occurrences` 렌더 smoke | curl 200, Playwright smoke `errorCount=0` | 없음 |

**미테스트:** 0건

---

## 4. 발견 항목

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|

### Appendix (confidence 5 미만)

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|

---

## 5. 기능 검증

- `pnpm --filter @secrets-manager/web test` 통과. 10 suites, 43 tests.
- `pnpm --filter @secrets-manager/web run typecheck` 통과.
- `pnpm lint` 통과.
- `pnpm format:check` 통과.
- `pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json` 통과. 2 suites, 36 tests.
- HTTP smoke. `http://127.0.0.1:3000/` 200, `http://127.0.0.1:3000/occurrences?status=SCHEDULED&from=2000-01-01&to=2026-05-24` 200.
- Playwright smoke. `/` title 정상, 리마인더 빈 상태 1건, `.error-box` 0건. `/occurrences` title 정상, `.error-box` 0건.

---

## 6. 보안 감사

- 신규 DB 테이블, 마이그레이션, 저장소 추가 없음.
- 외부 push notification, 브라우저 `Notification`, 서비스 워커 push, 외부 캘린더, 이메일, 문자 연동 추가 없음.
- 변경 범위 코드에서 `fetch`, 직접 `axios`, `localStorage`, `document.cookie`, `dangerouslySetInnerHTML`, `eval` 사용 없음.
- 변경 범위 코드에서 secret, token, API key 문자열 검색 결과 없음.
- API 호출은 기존 `getOccurrences`, `getExpenses` 클라이언트만 사용하며 base URL도 기존 `api-client` 경로를 재사용한다.
