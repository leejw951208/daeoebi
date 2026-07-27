# 테스트 전략

## 테스트 종류와 위치

| 종류 | 위치 | 러너 | 검증 대상 |
|------|------|------|-----------|
| API 단위 | `apps/api/src/**/*.spec.ts` | Jest(`rootDir: src`) | 서비스 로직(예: `expense.service.spec.ts`, `auth.service.spec.ts`, `recovery-code.spec.ts`) |
| API 통합/E2E | `apps/api/test/*.e2e-spec.ts` | Jest + supertest | 실제 Nest 파이프라인(가드·CSRF·세션·게이팅). 현재 `auth-store.e2e-spec.ts` 1개 |
| Web 단위(node) | `apps/web/app/**/*.spec.ts` | Jest project `node` | 순수 헬퍼(예: `secret-payload.spec.ts`, `field-suggestions.spec.ts`) |
| Web 단위(jsdom) | `apps/web/**/*.spec.tsx` | Jest project `jsdom` | React 컴포넌트 |
| Web E2E | `apps/web/tests/e2e/*.spec.ts` | Playwright(`playwright.e2e.config.ts`) | 사용자 흐름(asset·savings·recurring·category-crud) |
| Web 비주얼 회귀 | `apps/web/tests/visual/*.spec.ts` | Playwright(`playwright.visual.config.ts`) | 스크린샷 스냅샷 + 접근성(`accessibility.spec.ts`) |

- 네이밍 규칙: 단위는 `*.spec.ts`/`*.spec.tsx`, API e2e는 `*.e2e-spec.ts`. — `apps/api/jest.config.js`, `apps/api/test/jest-e2e.json`

## 실행 방법

| 대상 | 명령 | 근거 |
|------|------|------|
| 전체(모노레포) | `pnpm test`(= `pnpm -r run test`) 또는 `make test` | `package.json` scripts |
| API 전체 | `pnpm --filter @daeoebi/api test`(단위 + e2e 순차) | `apps/api/package.json` `test` |
| API 단위만 | `pnpm --filter @daeoebi/api test:unit` | `apps/api/package.json` |
| API e2e만 | `pnpm --filter @daeoebi/api test:e2e` | `apps/api/package.json` |
| Web 단위 | `pnpm --filter @daeoebi/web test` | `apps/web/package.json` |
| Web E2E | `pnpm --filter @daeoebi/web test:e2e` | `apps/web/package.json` |
| Web 비주얼 | `test:visual` / 업데이트 `test:visual:update` | `apps/web/package.json` |

- API e2e 설정: `testRegex: .e2e-spec.ts$`, `maxWorkers: 1`(직렬), `setupFiles: [setup-env.ts]`. — `apps/api/test/jest-e2e.json`
- Web e2e 설정: `testDir: ./tests/e2e`, `baseURL: http://localhost:3010`, `fullyParallel: false`, chromium 단일 프로젝트. — `apps/web/playwright.e2e.config.ts`
- Web jest는 멀티프로젝트(`node`+`jsdom`), `@/` alias 매핑. — `apps/web/jest.config.js`

## 커버리지 방침

- API jest에 `collectCoverageFrom: ["**/*.(t|j)s"]`, `coverageDirectory: ../coverage`가 설정돼 있다. — `apps/api/jest.config.js`
- **수치 게이트(임계치)는 코드에 설정돼 있지 않다.** `.claude/rules/ecc/common/testing.md`는 80% 최소 커버리지를 규정하지만, jest 설정에 `coverageThreshold`가 없어 CI/훅에서 강제되지는 않는다(규칙 문서상의 목표이지 코드 강제 아님).

## 테스트 구조 컨벤션

- **AAA 패턴**(Arrange-Act-Assert)과 행위 서술형 테스트명을 권장한다. — `.claude/rules/ecc/common/testing.md`
- **API e2e의 인증/암호화 처리**: `@simplewebauthn/server`의 `generate*`는 실제 사용(챌린지 흐름 유지)하고 `verify*`만 `jest.mock`으로 제어한다. 가드·CSRF·세션·게이팅·암호문 패스스루는 실제 파이프라인으로 검증한다. — `apps/api/test/auth-store.e2e-spec.ts:1`·`:7`
- **e2e 환경 주입**: `test/setup-env.ts`가 모듈 평가 전에 `.env.test*`→`.env.development*` 순으로 로드하고, 첫 등록 게이트용 `BOOTSTRAP_TOKEN`(`"e2e-bootstrap-token"`)과 `VAULT_ALLOWED_ORIGINS`(3000)를 고정 주입한다. — `apps/api/test/setup-env.ts:19`·`:24`
- **e2e Origin**: e2e spec은 `Origin: http://localhost:3000`과 `X-Vault-Request: 1` 헤더로 쓰기 요청을 보낸다(CSRF 미들웨어 통과 목적). — `apps/api/test/auth-store.e2e-spec.ts:31`
- **테스트용 dev 로그인**: `POST /auth/dev/login`은 비운영에서 WebAuthn 검증 없이 세션을 발급하는 UI 확인용 경로다(운영에선 404). Web e2e가 세션 확보에 활용한다. — `apps/api/src/auth/auth.controller.ts:116`
