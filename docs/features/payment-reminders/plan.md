# Plan. 결제 리마인더

## 단계 구성

| Phase | 이름 | 목표 |
|-------|------|------|
| P1 | 리마인더 분류 모델 | occurrence의 연체/오늘/3일/7일 임박도를 순수 함수로 계산하고 테스트한다 |
| P2 | 대시보드 요약 | 대시보드에서 리마인더 count와 금액 요약을 보여주고 필터 링크로 연결한다 |
| P3 | 결제 리스트 배지 | `/occurrences` 리스트에 리마인더 배지를 추가하고 처리 흐름을 유지한다 |
| P4 | 검증 | 타입체크, lint, Jest, API e2e, 필요 시 visual smoke로 회귀를 확인한다 |

## 구현 태스크

### P1. 리마인더 분류 모델

- [ ] **T001** `apps/web/app/occurrences/reminder-state.ts` 순수 함수 추가. `ExpenseOccurrence`, 기준일을 입력받아 `OVERDUE`, `TODAY`, `DUE_SOON_3`, `DUE_SOON_7`, `NORMAL`, `NONE`을 반환한다.
  - 선행. 없음 · 예상. 0.5h
- [ ] **T002** 리마인더 요약 집계 함수 추가. `SCHEDULED` 항목만 대상으로 count와 금액 합계를 계산한다.
  - 선행. T001 · 예상. 0.5h
- [ ] **T003** `reminder-state.spec.ts` 추가. 연체, 오늘, 3일 경계, 7일 경계, PAID/SKIPPED 제외를 검증한다.
  - 선행. T001, T002 · 예상. 0.5h

### P2. 대시보드 요약

- [ ] **T004** 대시보드 데이터 조회 범위 확인. 오늘 기준 과거 미처리 항목과 7일 이내 예정 항목을 가져오도록 기존 occurrence 조회를 조정한다.
  - 선행. T002 · 예상. 0.5h
- [ ] **T005** `app/page.tsx` 또는 대시보드 클라이언트 컴포넌트에 리마인더 요약 UI를 추가한다. 카드는 연체, 오늘, 3일 이내, 7일 이내 순서로 표시한다.
  - 선행. T004 · 예상. 1h
- [ ] **T006** 각 요약 카드에 `/occurrences` 필터 링크를 연결한다. 연체는 `to=어제`, 오늘은 `from=today&to=today`, 3일/7일은 해당 범위를 사용한다.
  - 선행. T005 · 예상. 0.5h

### P3. 결제 리스트 배지

- [ ] **T007** `OccurrencesView`에 리마인더 배지를 표시한다. `PAID`와 `SKIPPED`는 상태 배지만 유지한다.
  - 선행. T001 · 예상. 0.5h
- [ ] **T008** CSS 상태 클래스를 추가한다. 연체는 danger, 오늘은 warning, 3일/7일은 info 계열을 사용하되 기존 팔레트와 충돌하지 않게 한다.
  - 선행. T007 · 예상. 0.5h
- [ ] **T009** `처리` 버튼 위치와 모바일 카드 레이아웃을 확인해 배지와 버튼이 겹치지 않도록 조정한다.
  - 선행. T007, T008 · 예상. 0.5h

### P4. 검증

- [ ] **T010** `pnpm --filter @secrets-manager/web test`로 리마인더 순수 함수와 기존 화면 테스트를 검증한다.
  - 선행. T003, T009 · 예상. 0.25h
- [ ] **T011** `pnpm --filter @secrets-manager/web run typecheck`와 `pnpm lint`를 실행한다.
  - 선행. T009 · 예상. 0.25h
- [ ] **T012** `pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json`를 실행해 기존 occurrence API 회귀가 없는지 확인한다.
  - 선행. T009 · 예상. 0.25h
- [ ] **T013** 로컬 서버에서 `/`와 `/occurrences`를 열어 리마인더 UI가 렌더링되는지 smoke 확인한다.
  - 선행. T010, T011, T012 · 예상. 0.5h

## 아키텍처 다이어그램

```
GET /occurrences
      │
      ▼
ExpenseOccurrence[]
      │
      ├─ reminder-state.ts
      │    ├─ classifyReminder(occurrence, today)
      │    └─ summarizeReminders(occurrences, today)
      │
      ├─ Dashboard
      │    └─ Reminder summary cards ──► /occurrences?status=SCHEDULED&from=...&to=...
      │
      └─ OccurrencesView
           └─ per-row reminder badge + existing OccurrencePanel
```

## 테스트 매트릭스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|----------|
| 1 | 연체 분류 | today=2026-05-17, dueDate=2026-05-16, status=SCHEDULED | `OVERDUE` |
| 2 | 오늘 분류 | today=2026-05-17, dueDate=2026-05-17, status=SCHEDULED | `TODAY` |
| 3 | 3일 이내 경계 | today=2026-05-17, dueDate=2026-05-20, status=SCHEDULED | `DUE_SOON_3` |
| 4 | 7일 이내 경계 | today=2026-05-17, dueDate=2026-05-24, status=SCHEDULED | `DUE_SOON_7` |
| 5 | 7일 이후 | today=2026-05-17, dueDate=2026-05-25, status=SCHEDULED | `NORMAL` |
| 6 | 완료/스킵 제외 | status=PAID 또는 SKIPPED | `NONE`, 요약 count 제외 |
| 7 | 요약 금액 | overdue 1건 10,000원, today 1건 20,000원 | 각 bucket count=1, total=해당 금액 |
| 8 | 대시보드 링크 | 오늘 카드 클릭 | `/occurrences?status=SCHEDULED&from=today&to=today` 이동 |
| 9 | 리스트 렌더 | 연체 occurrence가 포함된 목록 | 연체 배지와 기존 처리 버튼이 함께 보인다 |
