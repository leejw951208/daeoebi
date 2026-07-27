# 컨벤션

## 코드 스타일

- **포매팅(Prettier)**: `tabWidth: 4`, `semi: false`(세미콜론 없음). — `.prettierrc.json`
- **린트(ESLint)**: flat config. `@typescript-eslint/no-explicit-any: off`(any 허용), `no-unused-vars`는 `^_` 접두어 예외. `dist`·`.next`·`coverage`·`generated/prisma`·`docs`·`.claude` 등은 무시. `--max-warnings 0`(경고 0 강제). — `eslint.config.mjs`, `apps/api/package.json`·`apps/web/package.json` lint 스크립트
- **네이밍**(`.claude/rules/ecc/common/coding-style.md`, `typescript/coding-style.md`): 변수·함수 `camelCase`, 타입·인터페이스·컴포넌트 `PascalCase`, 상수 `UPPER_SNAKE_CASE`, 커스텀 훅 `use` 접두. boolean은 `is`/`has`/`should`/`can` 접두.
  - 실제 코드 준수 예: 에러 코드 상수 `AUTH_ERRORS`·`VAULT_ERRORS`·`ASSET_ERRORS`, boolean 파라미터 `authenticated`·`isRecovery`, 함수 `assertRegisterAllowed`.
- **불변성**: 기존 객체를 변형하지 않고 새 객체를 만든다(스프레드 사용). 서비스의 부분 업데이트도 `data` 객체를 새로 구성한다. — `.claude/rules/ecc/common/coding-style.md`, 예 `apps/api/src/asset/expense.service.ts:188`
- **에러 처리**: 경계에서 명시적으로 처리하고 UI-facing 메시지는 한국어. Prisma 에러코드(P2002/P2003/P2025)를 도메인 예외로 매핑한다. — 예 `apps/api/src/asset/expense.service.ts:244`
- **입력 검증**: 시스템 경계에서 class-validator DTO로 검증(`typescript/coding-style.md`는 Zod를 권장하나 이 프로젝트는 Nest#class-validator를 사용한다).
- **파일 구성**: 도메인/기능별로 작은 파일 다수. 컨트롤러·서비스·DTO를 분리한다.
- **주석 언어**: 소스 주석은 한국어로 작성돼 있다(도메인 의사결정·불변식 근거 기록).

## 커밋 메시지

- 형식: `<type>: <설명>` 또는 스코프 포함 `<type>(scope): <설명>`. — 루트 `CLAUDE.md` §5, `.claude/rules/ecc/common/git-workflow.md`
- 허용 type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`(+ 병합 커밋 `merge:`가 관행상 사용됨).
- 하나의 논리적 변경마다 커밋한다. 무관한 편집을 한 커밋에 누적하지 않는다.
- 실제 이력 예(`git log`): `feat: 고정 지출 method 웹 타입·모델 확장 및 불변 갱신 헬퍼`, `fix(asset): 금액 입력이 길어지면 잘리던 문제 수정`, `test: 고정 지출 탭 지출 방식 등록·유지 E2E 추가`, `merge: 고정 지출 지출 방식 추가 (feat/recurring-method)`.

## 브랜치 전략

- **기반 브랜치**: 모든 작업 브랜치는 `develop`에서 생성한다(`feat/`·`fix/`·`refactor/`·`chore/`). — 루트 `CLAUDE.md` §4
- **병합 흐름**: 작업 브랜치 → `develop`(사용자 동의 후) → `main`(사용자가 직접 수행). Claude는 `main` 병합을 임의 수행하지 않는다.
- **pre-push 훅**: `main` 대상 푸시일 때만 `pnpm typecheck` + API 단위테스트(`@daeoebi/api test:unit`) + web 테스트(`@daeoebi/web test`)를 실행한다. 실패 시 푸시 차단. — `.husky/pre-push`
- **pre-commit 훅**: `lint-staged` 실행(스테이지된 `.ts/.tsx`는 `eslint --fix --max-warnings=0` + prettier, 기타는 prettier). — `.husky/pre-commit`, `package.json` `lint-staged`

## 금지 사항

루트 `CLAUDE.md` §3 및 `.gitignore`·프로젝트 규칙에 명문화돼 있다.

- 빌드 산출물 수정/삭제 금지: `node_modules/`, `apps/api/dist/`, `apps/web/.next/`, `coverage/`.
- `pnpm-lock.yaml` 직접 편집 금지. 의존성 변경은 `pnpm install`/`pnpm add`만(npm/yarn 금지). 패키지 매니저는 pnpm.
- 암호 계약 상수 변경 금지: `apps/web/lib/vault-crypto.ts`의 `PRF_INFO`·`RC_INFO`(HKDF info)와 AES-256-GCM 블롭 포맷(IV 12B·태그 16B·base64url). 변경 시 기존 암호문 복호화 불가·복구 경로 없음. — `apps/web/lib/vault-crypto.ts:4`·`:5`, `apps/api` DTO 계약(`base64url.ts`)
- `.env.development`·`.env.production` 등 시크릿 파일: 조회만. 생성·수정·복사·삭제 금지. `.env.example`은 키만 갱신(값 기입 금지).
- 적용된 마이그레이션(`apps/api/prisma/migrations/*`) 수정/삭제 금지. 변경은 새 마이그레이션으로.
- 운영 스택(`docker-compose.yml`, `make prod-*`) 로컬 기동 금지. 로컬은 `make dev-up`만.
