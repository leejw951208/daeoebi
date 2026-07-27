# 카테고리 HEX 색상 입력

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `feat/category-hex-color` |
| 작성일 | 2026-07-01 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
가계부 카테고리 추가·수정 시 색상을 고정 팔레트에서 고르는 대신 `#rrggbb` HEX 코드로 직접 입력한다. 입력창 옆 미리보기 스와치가 현재 색을 원으로 보여주고, 추가 폼의 이름 필드는 앱 표준 입력 스타일(`field-label`+`field-control`)로 통일됐다.

## 2. 왜 (배경·목표)
- 고정 팔레트는 원하는 색을 쓸 수 없었고, 추가 폼 이름 입력은 커스텀 회색 라벨이라 다른 폼과 룩이 달랐다.
- 임의의 색을 HEX로 직접 지정하고, 입력 UI를 서비스 표준 폼과 일관되게 맞추는 것이 목표다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| HEX 텍스트 입력 + 미리보기 스와치 | 요청이 "HEX 코드 입력"이고 임의 색 지원 | 네이티브 컬러 피커(`<input type=color>`) — 요청 범위 밖 |
| 순수 함수 `isValidHexColor`/`normalizeHexInput` 분리 | `#` 자동 보정·소문자·길이 정규화를 단위 테스트로 검증 | 컴포넌트 내 인라인 처리 — 테스트 어려움 |
| 유효 hex(`/^#[0-9a-fA-F]{6}$/`)가 아니면 추가·저장 버튼 비활성 | 서버 DTO 규칙과 동일한 클라이언트 이중 방어 | 서버 400에만 의존 — UX 불량 |
| 팔레트를 컴포넌트가 아닌 기본 색상값으로만 유지 | 신규 추가 시 초기값 필요 | `CATEGORY_PALETTE` 완전 제거 — 초기값 소실 |
| 수정 행 인라인 이름 입력은 그대로 | 컴팩트 컨텍스트라 표준화 범위 밖 | 함께 교체 — 범위 확대 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| Web(컴포넌트) | `apps/web/app/(vault)/asset/_components/CategoryColorInput.tsx` | 신규(`CategoryColorPicker.tsx` 리네임·재작성). 스와치 + HEX 입력 |
| Web(컴포넌트) | `apps/web/app/(vault)/asset/_components/CategoryColorPicker.tsx` | 제거(위로 대체) |
| Web(폼) | `apps/web/app/(vault)/asset/_components/CategoryAddSection.tsx` | 이름 필드 표준화 + 색 입력 교체 + 검증 게이트 |
| Web(폼) | `apps/web/app/(vault)/asset/_components/CategoryRow.tsx` | 색 입력 교체 + 저장 게이트 |
| Web(헬퍼) | `apps/web/app/(vault)/asset/_lib/asset-categories.ts` | `HEX_COLOR_RE`·`isValidHexColor`·`normalizeHexInput` 추가 |
| Web(테스트) | `apps/web/app/(vault)/asset/_lib/asset-color.spec.ts` | 헬퍼 단위 테스트 |
| Web(E2E) | `apps/web/tests/e2e/asset.spec.ts` | 색 선택을 팔레트 클릭 → HEX 입력 fill로 갱신 |
| Web(E2E) | `apps/web/tests/e2e/category-crud.spec.ts` | 등록·수정 색 선택을 HEX 입력 fill로 갱신 |

DB·API·서버 검증 변경 없음(입력 UI·클라이언트 검증 게이트만 변경).

## 5. 확인 방법
- [ ] `make typecheck` · `make lint` · `make test` 통과
- [ ] `make dev-up` 후 카테고리 추가 폼에서 이름을 입력하고 색을 `#f2994a`처럼 HEX로 넣으면 미리보기 스와치가 채워지고 추가된다. 잘못된 hex면 추가 버튼이 비활성이다. 수정 행에서도 기존 색이 HEX로 채워지고 변경·저장된다.
