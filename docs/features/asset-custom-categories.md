# 사용자 정의 지출 카테고리

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/asset-custom-categories` |
| 작성일 | 2026-06-30 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
가계부의 지출 카테고리를 코드에 박힌 고정 8종 상수에서 사용자가 직접 관리하는 목록으로 바꿨다. 사용자는 카테고리 관리 UI에서 카테고리를 추가·수정·삭제하고, 고정 팔레트에서 색을 고른다. 지출 폼의 카테고리 칩은 이 목록으로 렌더되며, 저장 값은 이름 문자열이 아니라 `categoryId`다. 기존 지출은 로그인 후 자동으로 새 카테고리에 연결된다.

## 2. 왜 (배경·목표)
- 지출 카테고리가 코드 상수라 사용자가 자신의 소비 패턴에 맞게 바꿀 수 없었다.
- 카테고리를 추가·수정·삭제할 수 있게 하되, 이름·금액이 암호화 블롭 안에 있어 서버가 못 보던 제약과 조화시키는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 평문 테이블 `AssetCategory` + `categoryId` FK | 비밀번호 금고의 `Category` 패턴을 재사용. 카테고리는 더 이상 블롭에 저장하지 않음 | 이름을 블롭에 유지 — 서버가 목록·집계를 못 함 |
| 지출 카테고리만 사용자 정의 | 수입 카테고리(월급·상여·기타)는 고정으로 충분 | 수입까지 확장 — YAGNI |
| 삭제 시 `onDelete: SetNull` | 지출을 지우지 않고 "미분류"로 남김(비밀번호 `Secret` 패턴과 동일) | Cascade 삭제 — 지출 데이터 손실 |
| 목록이 비면 기본 8종 시드 | 첫 사용 시 빈 화면 방지, 옛 상수 이름과 동일해 무손실 연결 | 빈 목록 방치 — 초기 사용성 저하 |
| 고정 팔레트에서 색 선택 | 임의 hex 입력 대비 단순·일관 | 자유 hex 입력 — YAGNI |
| 기존 지출은 클라이언트 일회성 이름 매칭 | 이름이 암호문 안이라 서버가 매칭 불가. 멱등 처리로 안전 | 서버 배치 마이그레이션 — 서버가 블롭을 못 읽음 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| API | `apps/api/src/asset/asset-category.controller.ts` | 추가 — `/asset-categories` CRUD 라우트 |
| API | `apps/api/src/asset/asset-category.service.ts` | 추가 — 목록·생성·수정·삭제, 빈 목록 시 기본 8종 시드 |
| API | `apps/api/src/asset/dto/asset-category.dto.ts` | 추가 — Create/Update DTO(이름 1–100, 색 #rrggbb) |
| API | `apps/api/src/asset/asset.module.ts` | 수정 — 컨트롤러·서비스 등록, CsrfMiddleware 적용 |
| API | `apps/api/src/asset/asset.types.ts` | 수정 — `ASSET_CATEGORY_NOT_FOUND` 에러코드 추가 |
| API | `apps/api/src/asset/dto/expense.dto.ts`·`expense.service.ts` | 수정 — `categoryId` 저장·뷰 반영 |
| API | `apps/api/src/asset/dto/recurring.dto.ts`·`recurring.service.ts` | 수정 — 고정 지출 템플릿에 `categoryId` 반영 |
| Web | `apps/web/lib/vault-client.ts` | 수정 — 카테고리 API 클라이언트, `categoryId` 필드 |
| Web | `apps/web/app/(vault)/asset/_lib/asset-categories.ts` | 수정 — 팔레트 상수·`resolveCategory` 헬퍼, 고정 상수 제거 |
| Web | `apps/web/app/(vault)/asset/_lib/asset-payload.ts` | 수정 — 지출 블롭에서 category 제거, `readLegacyCategory` 추가 |
| Web | `apps/web/app/(vault)/asset/_lib/asset-compute.ts` | 수정 — `byCategory`를 `categoryId` 기준으로 재작성 |
| Web | `apps/web/app/(vault)/asset/_lib/asset-migrate-categories.ts` | 추가 — 이름 매칭 일회성 마이그레이션 |
| Web | `apps/web/app/(vault)/asset/_components/CategoryManager.tsx` | 추가 — 카테고리 관리 UI |
| Web | `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx` | 수정 — 칩을 목록 기반으로, `categoryId` 저장 |
| Web | `apps/web/app/(vault)/asset/_components/dashboard/DayDetail.tsx`·`CategoryBreakdown.tsx`·`AssetDashboard.tsx` | 수정 — 색·이름을 카테고리 목록에서 조인 |
| Web | `apps/web/app/(vault)/asset/page.tsx`·`[id]/page.tsx`·`_lib/asset-recurring.ts` | 수정 — 카테고리 로드·전달, 머티리얼라이즈 시 `categoryId` 복사 |
| DB | `20260630010930_add_asset_category` | `AssetCategory` 테이블 + `Expense`·`RecurringExpense`의 `categoryId` FK(SetNull)·인덱스 |

## 5. 확인 방법
- [x] 백엔드 `test:unit`·`typecheck`·`lint`, 프론트 `test`·`tsc --noEmit`·`lint`·`build` 통과 (final-fix 기준 web 48 tests / 10 suites).
- [x] E2E 5종 통과: 대시보드 스모크, 카테고리 CRUD, 카테고리 선택 지출 저장, 결제방법 필드 부재 회귀, 동적 카테고리 칩.
- [ ] `make dev-up` 후 카테고리 관리에서 추가·수정·삭제 → 지출 폼에 반영, 삭제한 카테고리의 지출은 "미분류"로 표시, 기존(옛) 지출이 있는 월 진입 시 자동으로 카테고리에 연결.
