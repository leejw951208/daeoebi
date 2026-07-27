# 앱 전역 버튼 로딩 스피너

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/loading-spinners` |
| 작성일 | 2026-06-30 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
저장·수정·삭제 같은 쓰기 액션 버튼을 누르면 버튼 안에 작은 회전 스피너가 뜨고 버튼이 비활성화된다. 사용자는 요청이 진행 중임을 즉시 알 수 있고, 완료될 때까지 같은 버튼을 다시 누를 수 없다. 조회 로딩은 기존 스켈레톤을 그대로 유지한다.

## 2. 왜 (배경·목표)
- 기존에는 쓰기 동작 중 버튼이 `disabled`만 되어 "진행 중"이 눈에 보이지 않아 사용자가 동작 여부를 확신하기 어려웠다.
- 액션 버튼에 인라인 스피너로 즉각적 피드백을 주고, 앱 전역의 버튼 로딩 표현을 하나로 통일하는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 공용 `Button`(`loading` prop → 스피너+`disabled`+`aria-busy`) 신설 | 곳곳의 `<button className="btn" disabled>` 패턴을 한곳으로 모아 표현을 통일 | 컴포넌트마다 인라인으로 스피너 추가 — 중복·표류 |
| 인라인 버튼 스피너만 | 진행 표시라는 목표에 가장 단순·명확 | 토스트/전체화면 오버레이/상단 진행바 — YAGNI로 제외 |
| 스피너는 `currentColor` CSS 회전 원, `aria-hidden` | 버튼 글자색을 상속해 variant마다 색 맞춤 불필요, 접근성은 `aria-busy`가 담당 | 이미지·SVG 아이콘 — 색 대응·의존성 부담 |
| 라벨 고정 + 스피너("인증 중…" 같은 텍스트 토글 제거) | 레이아웃 점프 최소화, 표현 일관 | 기존 텍스트 토글 유지 — 버튼별로 제각각 |
| `ConfirmDialog`에 `confirmLoading` prop 추가 | 비동기 삭제(CategoryManager 등) 확인 버튼에도 진행 표시, 미전달 시 false로 하위호환 | `onConfirm` 동기 콜백 그대로 — 진행 표시 불가 |
| 상태 로직·API·에러 처리 무변경 | 버튼 시각 표현만 보강하는 것이 범위 | busy 상태·핸들러 재설계 — 범위 초과 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| Web(신규) | `apps/web/components/Spinner.tsx` | `currentColor` 회전 스피너, `aria-hidden` |
| Web(신규) | `apps/web/components/Button.tsx` | `loading`/`variant` 공용 버튼 (이후 `forwardRef` 지원 추가) |
| Web(스타일) | `apps/web/app/globals.css` | `@keyframes spin`·`.spinner`·`.btn-spinner` 추가 |
| Web(공용) | `apps/web/components/ConfirmDialog.tsx` | `confirmLoading` prop, 확인 버튼 `Button` 통일 |
| Web(가계부) | `apps/web/app/(vault)/asset/_components/ExpenseForm.tsx`, `CategoryAddSection.tsx`, `CategoryRow.tsx`, `CategoryManager.tsx`, `income/IncomeEntryForm.tsx`, `income/IncomeSheet.tsx` | 액션 버튼 `Button` 교체, 삭제 확인에 `confirmLoading` 연결 |
| Web(비밀번호·백업) | `apps/web/app/(vault)/[id]/page.tsx`, `_components/secret-form/SecretReviewStep.tsx`, `_components/BackupPanel.tsx` | 저장·삭제·내보내기/가져오기 버튼 `Button` 교체 |
| Web(인증) | `apps/web/app/(vault)/auth/UnlockScreen.tsx`, `OnboardingScreen.tsx` | 잠금해제·등록 버튼 `Button` 교체, 텍스트 토글 제거 |
| Web(테스트) | `apps/web/tests/e2e/asset.spec.ts` | 카테고리 추가 버튼이 진행 중 `aria-busy`됨을 route-delay로 검증 |

DB·API 변경 없음(버튼 시각 표현만 보강, 상태 로직·API·에러 처리 무변경).

## 5. 확인 방법
- [x] `pnpm --filter web exec tsc --noEmit` · `lint` · `test`(11 suites / 53) · `build` 통과
- [x] e2e: `asset.spec.ts` 6 passed (route-delay로 로딩 상태 관측, 2회 연속 안정)
- [ ] `make dev-up` 후 가계부·비밀번호에서 저장·삭제를 누르면 해당 버튼에 스피너가 뜨고 비활성화되어 더블클릭이 막힌다. 취소·월 이동 등 네비게이션 버튼과 조회 스켈레톤은 변화 없다.
