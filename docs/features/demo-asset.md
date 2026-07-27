# 데모 페이지 가계부 추가 (비밀번호 데모 갱신)

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/demo-asset` |
| 작성일 | 2026-07-01 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
공개 데모(`/demo`) 상단에 비밀번호 ↔ 가계부 전환 세그먼트 토글이 생기고, 가계부 탭에서 실제 자산 대시보드(남은 돈·카테고리 분해·달력·일자 상세)를 볼 수 있다. 방문자는 로그인·암호화 없이 지출 추가(FAB)와 카테고리 관리(추가·수정·삭제, HEX 색상)를 메모리 상태로 직접 조작해 볼 수 있다.

## 2. 왜 (배경·목표)
- 기존 데모(`/demo`)는 비밀번호 금고만 보여줘 서비스의 핵심인 가계부를 체험할 수 없었다.
- 실제 인증·암호화·서버 왕복 없이 가계부 UX를 안전하게 시연하는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 실제 `AssetDashboard`(+하위)를 가짜 데이터로 재사용 | vault-client를 타입 전용으로만 참조하는 순수 프레젠테이션이라 그대로 재사용 가능, 실제와 동일한 화면 | 데모 전용 대시보드 재구현 — 중복·드리프트 |
| 상호작용은 데모 전용 컴포넌트로 로컬 상태만 변경 | 실제 `CategoryManager`/`ExpenseForm`은 `useVault`·vault-client 런타임 의존이라 재사용 불가 | 실제 컴포넌트 직접 사용 — 인증·암호화가 끌려 들어옴 |
| 색상 입력은 `CategoryColorInput`(HEX) 재사용 | 실제 카테고리 관리와 동일 입력 규약 유지 | 데모용 팔레트 별도 구현 — 불일치 |
| 카테고리 삭제 시 해당 지출 `categoryId=null`(미분류) | 실제 삭제 동작과 동일하게 미분류로 강등 | 지출도 함께 삭제 — 실제와 다른 동작 |
| 수입은 표시만(`onOpenIncome` no-op) | 데모 범위 축소(YAGNI), 지출·카테고리 시연에 집중 | 수입 시트까지 상호작용 — 범위 확대 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| Web(데이터) | `apps/web/app/demo/demo-asset-data.ts` | 가짜 자산 데이터(`DEMO_MONTH`·카테고리·지출·수입) 추가 |
| Web(UI) | `apps/web/app/demo/DemoCategoryManager.tsx` | 로컬 상태 카테고리 관리(추가·수정·삭제) 추가 |
| Web(UI) | `apps/web/app/demo/DemoExpenseForm.tsx` | 로컬 상태 지출 추가 폼 추가 |
| Web(UI) | `apps/web/app/demo/DemoAssetScreen.tsx` | `AssetDashboard` 재사용 + 상호작용 조립 추가 |
| Web(UI) | `apps/web/app/demo/page.tsx` | 비밀번호/가계부 탭 토글(`DemoTabs`) 통합 |
| Web(테스트) | `apps/web/tests/e2e/demo.spec.ts` | 가계부 탭 렌더 + 카테고리 HEX 추가 스모크 e2e |

DB·API 변경 없음(데모는 vault-client·인증·암호화·서버 왕복 없이 메모리 상태로만 동작).

## 5. 확인 방법
- [x] tsc · lint · test · build 통과, e2e 11 passed
- [ ] `make dev-up` 후 `/demo`에서 가계부 탭으로 전환하면 자산 대시보드가 뜨고, FAB로 지출을 추가하면 달력·카테고리 분해에 반영되며, 카테고리 관리에서 HEX로 카테고리를 추가·수정·삭제할 수 있다(삭제 시 해당 지출은 미분류).
- [ ] 관련 QA: `apps/web/tests/e2e/demo.spec.ts`
