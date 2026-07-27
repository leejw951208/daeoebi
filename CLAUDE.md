# CLAUDE.md

## 프로젝트 한 줄 설명
- 사용자의 비밀번호와 가계부를 종단간 암호화(E2E)하여 관리하는 서비스. pnpm 모노레포이며 `apps/web`(Next.js)과 `apps/api`(NestJS·Prisma·PostgreSQL)로 구성된다.

## 수정/삭제 금지
- `pnpm-lock.yaml` — 직접 편집 금지. 이 프로젝트의 패키지 매니저는 **pnpm**이며, 의존성 변경은 `pnpm install` / `pnpm add`로만 한다. (npm/yarn 명령 사용 금지)
- `apps/web/lib/vault-crypto.ts`의 암호 계약 상수 — `PRF_INFO`, `RC_INFO`(HKDF info)와 AES-256-GCM 블롭 포맷(IV 12B·태그 16B·base64url)은 고정값이다. 변경 시 기존 암호문을 복호화할 수 없게 되며 복구 경로가 없다.
- `apps/api/prisma/migrations/*` — 이미 적용된 마이그레이션은 수정/삭제하지 않는다. 스키마 변경이 필요하면 새 마이그레이션을 추가한다.
- 운영 스택(`docker-compose.yml`, `make prod-*`) — 로컬에서 기동하지 않는다. 로컬 개발은 `make dev-up`(DB 도커 + web·API 로컬)만 사용한다.

## 브랜치 규칙
- **병합 실행 주체**: main 브랜치로의 병합(merge)은 Claude가 임의로 수행하지 않으며, 반드시 사용자가 직접 수행한다. develop 브랜치로의 병합은 사용자 동의를 받은 뒤에만 수행한다.
- **브랜치 생성 기준**: 모든 작업 브랜치는 main 브랜치를 기반으로 생성한다. (`feat/`, `fix/`, `refactor/`, `chore/` 등)
- **브랜치 병합 흐름**
  - 작업 완료 후, 개발 검증을 위해 작업 브랜치를 develop 브랜치로 병합한다.
  - 개발 검증 완료 후, 배포를 위해 작업 브랜치를 main 브랜치로 병합한다(사용자가 직접 수행).
  - main 대상 푸시 시 pre-push 훅이 typecheck와 단위 테스트를 실행한다. 실패하면 푸시되지 않는다.

## 커밋 전략
- 하나의 논리적 변경이 완료될 때마다 커밋한다.
- 커밋 메시지는 `<type>: <설명>` 형식을 따른다. (type: feat, fix, refactor, docs, test, chore, perf, ci)
- 좋은 예: `feat: auth 미들웨어 추가`
- 나쁜 예: `auth 추가하고 UI도 고치고 버그도 수정`
  - 이 경우 세 개의 커밋으로 분리한다.
- 서로 무관한 편집을 누적하면 개별 단위로 롤백할 수 없게 된다.
- 커밋을 위한 커밋은 만들지 않는다.
- 의미 있는 단위가 형성되었을 때만 커밋한다.
