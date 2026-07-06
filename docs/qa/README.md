# 대외비 QA 가이드

대외비의 수동·자동(Playwright) QA 기준 문서. 전체 시나리오 매트릭스는 [qa-scenarios.md](./qa-scenarios.md) 한 곳에 모아 둔다.

## 3축으로 본다

| 축 | 확인 대상 |
|------|-----------|
| **기능** | 동작하는가 (추가·수정·삭제·검증·경계) |
| **레이아웃** | 잘림·겹침 없이 뷰포트 안에 보이는가 (`LAYOUT-*`) |
| **상태** | 로딩·에러·빈 상태 처리 (`STATE-*`) |

- **모바일·데스크탑 둘 다** 확인한다(레이아웃 버그는 한쪽에서만 나온다).
- 다이얼로그·바텀시트·하단 버튼은 클릭 여부가 아니라 **뷰포트 안에 실제로 보이는지** 확인한다.

## 실행 방법

- 웹 `http://localhost:3010`, API `http://localhost:4010` (`make dev-up`).
- 인증 우회: 비운영에서 `devUnlock()`(`apps/web/lib/dev-auth.ts`, `DEV_AUTH = NODE_ENV !== "production"`)으로 패스키 없이 잠금해제한다. 기존 e2e(`apps/web/tests/e2e/*.spec.ts`, `playwright.e2e.config.ts`) 패턴을 따른다. 사전 조건 "dev-unlock 상태"는 이 우회를 의미한다.
- 반복 실행 충돌을 피하려면 이름·라벨에 고유 접미어를 붙인다.
- **실제 결과·Pass/Fail 은 실행 시 기입한다(작성 시 비워 둔다).**

## 기록 표기

- 결과: ✅ 통과 / ❌ 실패 / ⏭ 해당없음
- 실패는 비고(또는 실제 결과)에 **재현 방법·환경**을 남긴다.

## 메타(매 QA 회차마다 기록)

- 일자:
- 환경: 로컬(localhost:3010) / 배포(daeoebi.leejw.dev)
- 뷰포트: 모바일(≈390) / 데스크탑(≈900)
- 진입: 패스키 / dev 우회(비운영)

## 참고

- 시나리오 작성 스킬: `.claude/skills/writing-qa-scenarios`
