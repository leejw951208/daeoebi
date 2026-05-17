# Review: ui-ux-improve-claude

## 리뷰 개요

- 일자: 2026-05-17 (재검증 5회차)
- Spec: docs/features/ui-ux-improve-claude/spec.md
- Plan: docs/features/ui-ux-improve-claude/plan.md
- 브랜치. tmp/20260517 (vs origin/main)
- 자동 검증. `pnpm --filter @life-key/web typecheck` 통과, `pnpm --filter @life-key/web test` **32/32 통과** (회귀 복구), `pnpm --filter @life-key/web build` 12 라우트 등록(신규 `/_not-found` 포함), `pnpm --filter @life-key/web run test:visual:update` **69/69 통과** 및 baseline 33개 갱신.
- 직전 회차 대비. Appendix #1 (vault layout idle 첫 tick) 해소 — 코드 분석으로 의도된 동작임을 확인하고 의도 주석 추가([apps/web/app/vault/layout.tsx:27-28](apps/web/app/vault/layout.tsx)). server `idleSecondsRemaining` 이 fetch 시점 기준이므로 mount 직후 1초 동일값 표시가 실제 경과와 일치.

---

## 1. Spec 일치 여부

| 처리상태 | 심각도 | 판정 | # | 요구사항 | 근거 | 보강 지시 |
|----------|--------|------|---|----------|------|-----------|
| CLOSED | — | DONE | S1 | `/expenses` 목록 전용 + URL 필터(상태/카테고리) | [apps/web/app/expenses/ExpensesView.tsx:19-117](apps/web/app/expenses/ExpensesView.tsx) | — |
| CLOSED | — | DONE | S2 | `/expenses/new` 빈 폼 → 저장 후 `/expenses` push | [apps/web/app/expenses/new/NewExpenseView.tsx](apps/web/app/expenses/new/NewExpenseView.tsx) | — |
| CLOSED | — | DONE | S3 | `/expenses/[id]` 4섹션 카드 + view↔edit + ConfirmDialog 삭제 | [apps/web/app/expenses/[id]/ExpenseDetailView.tsx:50-117](apps/web/app/expenses/[id]/ExpenseDetailView.tsx) | — |
| CLOSED | — | DONE | S4 | `/vault` 5개 라우트 + 잠금 segment layout | [apps/web/app/vault/layout.tsx:8-81](apps/web/app/vault/layout.tsx) | — |
| CLOSED | — | DONE | S5 | `/vault` 목록 + URL 필터·검색 | [apps/web/app/vault/EntriesScreen.tsx:17-126](apps/web/app/vault/EntriesScreen.tsx) | — |
| CLOSED | — | DONE | S6 | `/vault/new` 신규 entry 라우트 | [apps/web/app/vault/new/page.tsx](apps/web/app/vault/new/page.tsx) | — |
| CLOSED | — | DONE | S7 | `/vault/[id]` 3섹션 카드 + view↔edit + 삭제 | [apps/web/app/vault/[id]/page.tsx:106-185](apps/web/app/vault/[id]/page.tsx) | — |
| CLOSED | — | CHANGED | S8 | `/vault/categories` 카테고리 메타 관리 (spec에 read-only 결정 명시) | [apps/web/app/vault/categories/page.tsx:11-53](apps/web/app/vault/categories/page.tsx) + [spec.md:48](docs/features/ui-ux-improve-claude/spec.md) | — |
| CLOSED | — | DONE | S9 | `/vault/backup` BackupPanel 단독 라우트 | [apps/web/app/vault/backup/page.tsx:6-19](apps/web/app/vault/backup/page.tsx) | — |
| CLOSED | — | DONE | S10 | detail 페이지 IA 그룹화 (기존 토큰만) | `card` + `section-title` 토큰만 사용 | — |
| CLOSED | — | DONE | S11 | edit 별도 라우트 없이 inline 전환 | `useState<'view'\|'edit'>` 패턴 | — |
| CLOSED | — | DONE | S12 | 필터/검색 URL state | `router.replace(..., { scroll: false })` | — |
| CLOSED | — | DONE | S13 | 알 수 없는 query 값 → 디폴트 fallback | [expense-filter.ts:12-15](apps/web/app/expenses/expense-filter.ts), [vault-filter.ts:7-10](apps/web/app/vault/vault-filter.ts) | — |
| CLOSED | — | DONE | S14 | 라우트 추가 ≤ 7개 | 신규 6개 + layout 1개 = 7 | — |
| CLOSED | — | DONE | S15 | 백엔드·Prisma·DTO 변경 금지 | `apps/api` diff stat 0 | — |
| CLOSED | — | DONE | S16 | `/expenses/잘못된id` → 404 | `notFound()` + 신규 한국어 [apps/web/app/not-found.tsx](apps/web/app/not-found.tsx) | — |
| CLOSED | — | DONE | S17 | `/vault/[id]` 잘못된 id → 안내 | [apps/web/app/vault/[id]/page.tsx:82-92](apps/web/app/vault/[id]/page.tsx) | — |
| CLOSED | — | DONE | S18 | 잠금 상태에서 `/vault/*` 직접 진입 시 키·민감 필드 노출 금지 | layout 이 children 렌더 전 status 분기 | — |
| CLOSED | — | DONE | S19 | 알 수 없는 카테고리 query → 디폴트 fallback | vault-filter.spec.ts | — |
| CLOSED | — | DONE | S20 | 시각 회귀 baseline 갱신 + axe 0건 | axe 11페이지 cover. `pnpm --filter @life-key/web run test:visual:update` 69/69 통과 및 baseline png 33개 갱신 | — |

**요약:** DONE 19 / PARTIAL 0 / NOT DONE 0 / CHANGED 1 (총 20)

---

## 2. Plan 일치 여부

| 처리상태 | 심각도 | 판정 | 태스크 | 근거 | 보강 지시 |
|----------|--------|------|--------|------|-----------|
| CLOSED | — | DONE | T101 vault layout(잠금/idle 공유) | apps/web/app/vault/layout.tsx | — |
| CLOSED | — | DONE | T102 expenses layout(공통 헤더) | plan.md "본 회차는 미적용 가능" 명시 | — |
| CLOSED | — | DONE | T103 디렉터리 골격 + placeholder | build 12 라우트 등록 | — |
| CLOSED | — | DONE | T201 /expenses 목록 전용 축소 | ExpensesView 363→124줄 | — |
| CLOSED | — | DONE | T202 /expenses/new | router.push + router.refresh | — |
| CLOSED | — | DONE | T203 /expenses/[id] 4섹션 + edit | view↔edit toggle | — |
| CLOSED | — | DONE | T204 /expenses URL 필터 | status·category 화이트리스트 fallback | — |
| CLOSED | — | DONE | T301 /vault 목록 전용 축소 | EntriesScreen 225→168줄 | — |
| CLOSED | — | DONE | T302 /vault/new | CategoryForm `entry={null}` 마운트 | — |
| CLOSED | — | DONE | T303 /vault/[id] 3섹션 + edit | 3섹션 conditional | — |
| CLOSED | — | DONE | T304 /vault 필터·검색 URL state | cat·q | — |
| CLOSED | — | CHANGED | T401 /vault/categories | read-only reference. spec 본문에 결정 명시(S8) | — |
| CLOSED | — | DONE | T402 /vault/backup | BackupPanel 단독 마운트 | — |
| CLOSED | — | DONE | T403 vault 헤더 보조 액션 링크 | "카테고리", "백업·복원", "+ 항목 추가" 링크 | — |
| CLOSED | — | DONE | T501 시각 baseline 갱신 | `pnpm --filter @life-key/web run test:visual:update` 69/69 통과. 신규 6개 spec 포함 baseline 33개 생성·갱신 | — |
| CLOSED | — | DONE | T502 axe-playwright 신규 페이지 추가 | accessibility.spec.ts 5→11 페이지 | — |
| CLOSED | — | DONE | T503 Jest 단위 테스트 보강 | 32/32 통과(신규 23 + 기존 9). 직전 회차 회귀 복구 | — |
| CLOSED | — | DONE | T504 README 라우트 맵 | README.md:68-86 | — |

**스코프 이탈:** 없음.

---

## 3. 테스트 커버리지

| 처리상태 | 심각도 | 판정 | 요구사항 | 테스트 | 보강 지시 |
|----------|--------|------|----------|--------|-----------|
| CLOSED | — | TESTED | S1 `/expenses` 목록 + URL 필터 | [expense-filter.spec.ts](apps/web/app/expenses/expense-filter.spec.ts) 11건 + [expenses-flow.spec.ts](apps/web/tests/visual/expenses-flow.spec.ts) | — |
| CLOSED | — | TESTED | S2 `/expenses/new` 저장 흐름 | [expense-form-state.spec.ts](apps/web/app/expenses/expense-form-state.spec.ts) 8건 | — |
| OPEN | LOW | UNTESTED | S3 `/expenses/[id]` view↔edit | 직접 단위/e2e 없음 ([expenses-detail.spec.ts](apps/web/tests/visual/expenses-detail.spec.ts) 는 missing fallback 만) | jsdom 도입 회차에 RTL 단위 테스트 추가. 본 회차는 시각 회규 위임. |
| CLOSED | — | TESTED | S5 `/vault` URL 필터·검색 | [vault-filter.spec.ts](apps/web/app/vault/vault-filter.spec.ts) | — |
| OPEN | LOW | UNTESTED | S7 `/vault/[id]` view↔edit | 직접 단위 없음 ([vault-detail.spec.ts](apps/web/tests/visual/vault-detail.spec.ts) 는 locked fallback 만) | jsdom 도입 회차에 RTL 단위 테스트 추가. |
| CLOSED | — | TESTED | S8 `/vault/categories` reference | [vault-categories.spec.ts](apps/web/tests/visual/vault-categories.spec.ts) | — |
| CLOSED | — | TESTED | S9 `/vault/backup` 마운트 | [vault-backup.spec.ts](apps/web/tests/visual/vault-backup.spec.ts) | — |
| OPEN | MEDIUM | UNTESTED | S18 vault 잠금 fallback (직접 진입) | jsdom 미도입으로 단위 미작성. axe-playwright 위임 | baseline 캡처 후 시각 회규로 재확인. 잠금 fallback 단위 회귀 추가 권장. |
| CLOSED | — | TESTED | S16 `/expenses/잘못된id` 404 | [accessibility.spec.ts:9](apps/web/tests/visual/accessibility.spec.ts) `expenses-detail-missing` | — |
| CLOSED | — | TESTED | 시각 회귀 11페이지 × 3 viewport | `pnpm --filter @life-key/web run test:visual:update` 69/69 통과. axe 11페이지 + visual baseline 33개 | — |

**미테스트:** 3건.

---

## 4. 발견 항목

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | — | 9/10 | QA | apps/web/tests/visual/{dashboard,expenses,expenses-new,expenses-detail,vault,vault-new,vault-detail,vault-categories,vault-backup}.spec.ts-snapshots | **F1 (해소).** `pnpm --filter @life-key/web run test:visual:update` 69/69 통과. 신규 6개 spec baseline 생성 및 기존 변경 baseline 갱신으로 png 33개 확보. | — |
| OPEN | LOW | 8/10 | DX | apps/web/app/vault/[id]/page.tsx:36 | **F2.** detail 페이지가 `listEntries()` 로 전체 entries 로드 후 `find(it => it.id === id)`. spec "API 변경 금지" 제약으로 본 회차 차선책. | 다음 회차(백엔드 endpoint 추가 가능)에 `GET /vault/entries/:id` + `vault-client.getEntry(id)` 도입. |
| OPEN | LOW | 6/10 | DX | apps/web/app/expenses/{ExpensesView,new/NewExpenseView,[id]/ExpenseDetailView}.tsx 및 vault 동등 위치 | **F6.** 헤더·툴바 `style={{ display: 'flex', ... }}` 인라인 객체 반복(7회 이상). 시각/기능 영향 작음. | 다음 디자인 토큰화 회차에서 `.toolbar`/`.detail-header` 클래스 추출. 본 회차 보강 불필요. |
| CLOSED | HIGH | 10/10 | REGRESSION | apps/web/app/ui-ux-redesign-open-items.spec.ts:18-27 | **F9 (해소).** CategoryForm 컨텍스트 변경(라우트 분리)에 맞춰 회규 테스트에서 CategoryForm 단언 제거, OccurrencePanel 단언만 유지. 32/32 통과 복구. | — |
| CLOSED | LOW | 6/10 | DX | apps/web/app/not-found.tsx | **F4 (해소).** 한국어 글로벌 404 + 홈 복귀 링크. build 결과 `/_not-found` static 라우트 등록 확인. | — |
| CLOSED | LOW | 7/10 | OTHER | docs/features/ui-ux-improve-claude/spec.md:48 | **F3 (해소).** spec S8 본문에 read-only reference 결정과 사유(API 변경 금지 제약 + 카테고리 코드 상수) 명시. | — |
| CLOSED | INFORMATIONAL | 7/10 | DX | apps/web/app/vault/CategoryForm.tsx | **F5 (직전 회차).** `inline-bottom-sheet` 클래스 제거 패치 반영. F9 회규 테스트도 동반 갱신. | — |
| CLOSED | INFORMATIONAL | 7/10 | DX | README.md:74 | **F4 (직전 회차).** status 값(`active`/`inactive`/`all`) 명시. | — |
| CLOSED | INFORMATIONAL | 5/10 | DX | apps/web/app/expenses/new/NewExpenseView.tsx, apps/web/app/vault/new/page.tsx | **F8 (직전 회차).** 불필요한 `useTransition` 제거. | — |

### Appendix (confidence 5 미만)

| 처리상태 | 심각도 | 신뢰도 | 분류 | 위치 | 내용 | 보강 지시 |
|----------|--------|--------|------|------|------|-----------|
| CLOSED | INFORMATIONAL | 4/10 | DX | apps/web/app/vault/layout.tsx:27-41 | (해소) 코드 분석 결과 의도된 동작. server `idleSecondsRemaining` 이 fetch 시점 기준이라 mount 직후 1초 동일값 표시가 실제 경과와 일치. 즉시 tick 트리거는 오히려 부정확. 의도 주석 추가됨. | — |
| OPEN | INFORMATIONAL | 3/10 | DX | apps/web/app/vault/EntriesScreen.tsx:96-100 | 헤더 "+ 항목 추가" `marginLeft: auto` flex-wrap 시 좌측 정렬 — 의도 가능성 | `--include-appendix` 시. 시각 baseline 캡처 후 확인. |

---

## 5. 기능 검증

본 환경에서는 백엔드 dev 서버 미가동으로 gstack `qa-only` 의 실제 브라우저 자동화는 불가. 정적 검증 명령으로 갈음했고, 라이브 검증은 F1로 이관.

### 통과

- `pnpm --filter @life-key/web run typecheck` → 통과 (tsc --noEmit).
- `pnpm --filter @life-key/web test` → **32/32 통과**. F9 회귀 복구 확인.
- `pnpm --filter @life-key/web run build` → **12 라우트 등록** (이전 11 + 신규 `/_not-found`). Static 5 / Dynamic 7. First Load JS 최대 133 kB.

### 운영 검증 잔여 (사용자 수행)

1. 잠금 상태에서 `/vault/new`, `/vault/[id]/<임의id>`, `/vault/categories`, `/vault/backup` 직접 진입 → UnlockScreen fallback 수동 확인.
2. `/expenses?status=garbage&category=구독` 진입 시 status `all` fallback + 카테고리 적용 수동 확인.
3. `/존재하지않는경로` 진입 시 신규 한국어 not-found 페이지 표시 확인.

---

## 6. 보안 감사

본 회차는 신규 공격 표면 도입 없음. F9 패치는 테스트 코드만 수정, F4 신규 페이지는 정적 텍스트 + Link, F3은 문서. 위협 모델 변화 0.

### 확인된 통제

- **잠금 fallback 무결성.** [apps/web/app/vault/layout.tsx:61-68](apps/web/app/vault/layout.tsx) — `setup-required`/`locked` 모든 분기에서 `<UnlockScreen />` 만 렌더. children 은 unlocked 분기에서만 마운트.
- **API 인증·자격 정책 불변.** `vault-client.ts`/`api-client.ts` interceptor 무수정.
- **VAULT_LOCKED 런타임 대응.** `err.code === 'VAULT_LOCKED'` 시 `onStatusRefresh()` 만 호출.
- **민감 필드 표시.** 기존 `<CopyField sensitive>` 위임. 본 회차 미수정.
- **XSS 표면.** 신규 `not-found.tsx` 포함 `dangerouslySetInnerHTML`/`innerHTML`/`eval` 없음.
- **URL state 신뢰성.** 화이트리스트 기반 fallback.
- **에러 메시지 노출.** 기존 동작 유지.

### 신규 위험 0건

- 인증 우회 없음.
- IDOR 신규 없음.
- 새 secrets/env 누출 없음.
- 새 외부 호출 없음.

### 권장 (스코프 외)

- `vault-client.getEntry(id)` 단건 endpoint — F2 항목.
