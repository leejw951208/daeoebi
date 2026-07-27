# 월별·항목별 수입

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/monthly-income` |
| 작성일 | 2026-06-29 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
수입을 모든 달에 같은 값이 적용되던 싱글톤 1건에서 달마다 여러 건을 기입하는 항목형으로 바꿨다. 사용자는 대시보드 수입 카드를 탭해 열리는 바텀시트에서 그 달의 월급·상여·기타 수입을 각각 추가·편집·삭제할 수 있고, 그 달 수입 합계로 "남은 돈"이 계산된다. 금액·항목명·카테고리는 모두 클라이언트에서 E2E 암호화되어 저장된다.

## 2. 왜 (배경·목표)
- 기존 수입은 싱글톤 1건(`id="singleton"`, 블롭 `{amount}`)이라 달마다 다른 월급·상여를 구분해 기록할 수 없었다.
- 수입을 지출과 동일하게 월별·다건·E2E 암호화 항목으로 만들어, 그 달 수입 합에서 지출을 뺀 남은 돈을 계산하는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 수입을 월 귀속(`month` 평문 `YYYY-MM`) + 암호문 블롭 다건으로 교체 | 지출과 동일 패턴으로 월별·항목별 관리 가능 | 싱글톤 단일값 유지 — 달별 구분 불가 |
| 카테고리(월급·상여·기타)를 블롭에 암호화 저장 | 카테고리도 민감 정보로 보고 본문과 함께 봉인 | 카테고리 평문 컬럼 — E2E 방침 위배 |
| 반복 수입 자동생성 없음(월급도 매달 직접 입력) | 단순·명확, 범위 최소화 | 고정 지출식 템플릿·머티리얼라이즈 — YAGNI |
| UI는 새 라우트 없이 수입 카드 → 바텀시트에서 목록·폼 관리(A안) | 기존 시트·칩 패턴과 일관, 진입 흐름 유지 | 별도 수입 관리 페이지 신설 |
| 신규 마이그레이션에서 기존 싱글톤 행 삭제(`DELETE FROM "Income"`) | 구조(`month` 없음, 블롭 `{amount}`)가 비호환이고 서버는 E2E라 자동 이전 불가 | 데이터 자동 마이그레이션 — 블롭 복호화 불가로 실현 불가능 |
| API를 expense CRUD 패턴 미러(GET 월조회·POST·PATCH·DELETE) | 검증·base64url 패스스루·에러 규약을 지출과 통일 | 싱글톤 GET/PUT 유지 — 다건 불가 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| DB | `apps/api/prisma/migrations/20260629054219_income_monthly_entries` | `Income`에 `month` 추가·`id` 기본값 `cuid()`·`@@index([month])`, 기존 싱글톤 행 삭제 |
| DB | `apps/api/prisma/schema.prisma` | `model Income` 월별 다건으로 교체 |
| API | `apps/api/src/asset/income.controller.ts` | 싱글톤 GET/PUT → `GET /income?month=`·`POST`·`PATCH/:id`·`DELETE/:id` |
| API | `apps/api/src/asset/income.service.ts` | `listByMonth`·`create`·`update`·`remove`(base64url 패스스루) |
| API | `apps/api/src/asset/dto/income.dto.ts` | `CreateIncomeDto`(month + 블롭)·`UpdateIncomeDto` |
| API | `apps/api/src/asset/asset.types.ts` | 에러코드 `INCOME_NOT_FOUND` 추가 |
| API(테스트) | `apps/api/src/asset/income.service.spec.ts` | 월 필터·생성·삭제 NotFound 단위 테스트 |
| API(테스트) | `apps/api/test/auth-store.e2e-spec.ts` | 수입 월 CRUD·`month` 형식 검증 e2e |
| Web(client) | `apps/web/lib/vault-client.ts` | `listIncomes`·`createIncome`·`updateIncome`·`deleteIncome`·`IncomeView` |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-payload.ts` | `IncomePayload {item,amount,category}`·`sealIncome`·`openIncome` |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-categories.ts` | `INCOME_CATEGORIES`·`incomeCategoryColor` 추가 |
| Web(계산) | `apps/web/app/(vault)/asset/_lib/asset-compute.ts` | `ComputedIncome`·`totalIncome` 추가 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/income/IncomeSheet.tsx` | 월 수입 관리 시트(목록 + 추가/편집 모드) 신설 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/income/IncomeRow.tsx` | 수입 목록 한 행(색 점·카테고리·항목·금액) 신설 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/income/IncomeEntryForm.tsx` | 수입 추가·편집 인라인 폼 신설 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/IncomeSheet.tsx` | 구 단일 금액 입력 시트 삭제 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/dashboard/AssetDashboard.tsx` | `Loaded`에 `incomes` 추가·건수 전달 |
| Web(UI) | `apps/web/app/(vault)/asset/_components/dashboard/IncomeExpenseCards.tsx` | 수입 카드 건수 표시 |
| Web(로드) | `apps/web/app/(vault)/asset/page.tsx` | `listIncomes` 로드·복호화·합계·시트 연결 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-payload.spec.ts` | 수입 seal→open 라운드트립 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-compute.spec.ts` | `totalIncome` 합계 |

## 5. 확인 방법
- [ ] `make typecheck` · `make lint` · `make test` 통과
- [ ] `make dev-up` 후 수입 카드 탭 → 시트에서 월급·상여·기타를 추가하면 총수입·남은 돈이 갱신되고, 편집·삭제가 반영되며, 다른 달로 이동하면 그 달 수입만 보인다. 새로고침 후에도 복호화가 정상이다.
