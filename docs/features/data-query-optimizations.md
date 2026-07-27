# 데이터 조회 최적화

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `perf/data-query-optimizations` |
| 작성일 | 2026-06-30 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
가계부·볼트의 데이터 조회·쓰기 경로 전반을 최적화했다. 웹에서는 카테고리 마이그레이션과 고정지출 머티리얼라이즈를 병렬 실행하고 월별 1회 가드로 재실행을 막았으며, 시트 편집 후 부모 리로드를 닫을 때 1회로 합쳤다. API에서는 update/delete 뮤테이션의 존재확인 SELECT를 제거해 쿼리 수를 2→1로 줄였고, DB에는 조회 필터·정렬을 커버하는 복합 인덱스와 검색 ILIKE를 가속하는 pg_trgm GIN 인덱스를 추가했다.

## 2. 왜 (배경·목표)
- 카테고리 마이그레이션·고정지출 생성이 직렬 `await` 루프여서 항목이 많을수록 대기가 선형으로 누적됐고, 방문마다 재실행되어 불필요한 작업이 반복됐다.
- 시트에서 여러 번 편집하면 그때마다 부모가 리로드되어 중복 조회가 발생했다.
- update/delete마다 존재확인 SELECT가 선행되어 뮤테이션당 DB 왕복이 2회였다.
- 조회 필터·정렬과 라벨 검색이 단일 컬럼 btree 인덱스에 의존해 커버리지가 부족했다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 직렬 `await` 루프를 `Promise.all(targets.map(...))` 병렬로 전환 | 독립 항목을 동시에 처리해 대기를 상수화. 항목별 `try/catch`로 개별 실패가 배치를 중단하지 않음 | 직렬 유지 — 항목 수에 비례한 지연 |
| 마이그레이션 월별 1회 가드(`getMigrationGuard`/`setMigrationGuard`) | 이미 처리한 달은 재방문 시 건너뜀. `hasLegacy` 단락 조건과 병행 | 매 방문 무조건 실행 — 중복 작업 |
| 시트 편집을 `dirty` 플래그로 모으고 `handleClose()`에서 1회만 `onChanged()` | 편집 N회 → 부모 리로드 N→1 감소, 변경 없으면 리로드 없음 | 편집마다 즉시 부모 리로드 — 중복 조회 |
| 존재확인 SELECT 제거 후 Prisma `P2025`를 `NotFoundException`으로 변환 | 뮤테이션당 쿼리 2→1. `isRecordNotFound(e)` 헬퍼로 동일 응답 유지 | `findUnique` 사전 확인 유지 — 왕복 2회 |
| 복합 인덱스로 필터+정렬 커버 | `[removed, date]`·`[active, createdAt]`·`[siteId, label]`로 조회 패턴을 인덱스만으로 처리 | 단일 컬럼 인덱스 유지 — 커버리지 부족 |
| 라벨 검색에 pg_trgm GIN 인덱스 | ILIKE 부분일치 가속. 스키마 관리형(`previewFeatures`+`extensions`)으로 도입 | btree만 유지 — ILIKE 미가속 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| Web | `apps/web/app/(vault)/asset/_lib/asset-migrate-categories.ts` | 카테고리 마이그레이션 병렬화 |
| Web | `apps/web/app/(vault)/asset/page.tsx` | 마이그레이션 월별 1회 가드 추가 |
| Web | `apps/web/app/(vault)/asset/_lib/asset-recurring.ts` | 고정지출 머티리얼라이즈 생성 병렬화 |
| Web | `apps/web/app/(vault)/asset/_components/CategoryManager.tsx` | `dirty` 플래그로 닫을 때 부모 리로드 1회로 합침 |
| API | `apps/api/src/vault/secret.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| API | `apps/api/src/vault/site.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| API | `apps/api/src/asset/asset-category.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| API | `apps/api/src/asset/expense.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| API | `apps/api/src/asset/income.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| API | `apps/api/src/asset/recurring.service.ts` | update/remove 존재확인 SELECT 제거, P2025 변환 |
| DB | `apps/api/prisma/migrations/20260630042844_optimize_query_indexes/` | 조회 필터·정렬 커버용 복합 인덱스 |
| DB | `apps/api/prisma/migrations/20260630042928_add_trgm_search_indexes/` | 검색 ILIKE 가속용 pg_trgm GIN 인덱스 |

## 5. 확인 방법
- [x] web 단위 테스트 48/48 PASS, `tsc --noEmit` 오류 없음, lint 경고 0.
- [x] api 단위 테스트 91/91 PASS(baseline 89 → 신규 테스트 +2), `typecheck`·`lint` clean.
- [x] `pnpm --filter web build` 성공(정적 8페이지 생성). Prisma Client 7.8.0 생성 OK, 마이그레이션 적용 후 drift 없음.
