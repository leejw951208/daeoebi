# 소개

## 한 줄 설명

여러 사이트의 비밀번호와 가계부(자산) 데이터를 종단간 암호화(E2E)로 보관·관리하는 단일 사용자용 서비스이다. 서버는 본문 평문을 절대 복호화하지 않고 암호문 블롭만 저장·패스스루한다.

- 근거: 루트 `CLAUDE.md` §1, `README.md` 상단 설명, 서버 서비스 전반의 "패스스루" 주석(예: `apps/api/src/vault/secret.service.ts:1`, `apps/api/src/asset/expense.service.ts:1`)

## 목적과 핵심 가치

- **종단간 암호화(E2E)**: Vault Key(VK)로 봉인한 암호문만 서버에 저장한다. 서버는 VK·PRF 출력·복구코드 평문을 보관하지 않는다. — `apps/api/src/auth/auth.service.ts:1`, `apps/web/lib/vault-crypto.ts:1`
- **passkey(WebAuthn) 기반 인증 + PRF 키 래핑**: 비밀번호 없이 지문/얼굴로 열고, 인증기의 PRF 확장 출력으로 VK를 래핑·복원한다. — `apps/api/src/auth/auth.service.ts:80`
- **복구코드 break-glass**: 기기 분실 시 160bit 복구코드로 VK를 복원하는 유일한 백업 경로가 있다. — `apps/api/src/auth/auth.service.ts:370`, `apps/web/lib/vault-crypto.ts:296`
- **단일 사용자 모델**: 세션·백오프·챌린지·복구 래핑 모두 전역 단건 상태로 관리한다(멀티테넌시 없음). — `apps/api/src/auth/session.service.ts:1`, `apps/api/src/auth/auth.types.ts:45`

## 기술 스택

pnpm 모노레포. `packageManager`는 `pnpm@11.0.9`, Node `>=24`이다. — `package.json:5`, `package.json:7`

| 영역 | 스택 | 근거 |
|------|------|------|
| API | NestJS 10 (`@nestjs/common`·`@nestjs/core` ^10.4.0), Express 플랫폼 | `apps/api/package.json` |
| ORM/DB | Prisma ^7.8.0 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL(`pg_trgm` 확장) | `apps/api/prisma/schema.prisma:1`, `apps/api/prisma/schema.prisma:10` |
| 인증 | `@simplewebauthn/server` ^13.3.1 (서버), `@simplewebauthn/browser` ^13.3.0 (웹) | `apps/api/package.json`, `apps/web/package.json` |
| 해시 | `argon2` ^0.44.0(의존성 등재), `node:crypto`(SHA-256·timingSafeEqual 실사용) | `apps/api/package.json`, `apps/api/src/auth/auth.service.ts:12` |
| 검증 | `class-validator` ^0.14.1, `class-transformer` ^0.5.1 | `apps/api/package.json` |
| Web | Next.js ^15.0.3(App Router), React ^19.0.0, axios ^1.7.7, lucide-react | `apps/web/package.json` |
| 암호화(웹) | WebCrypto(AES-256-GCM, HKDF-SHA256) | `apps/web/lib/vault-crypto.ts` |
| 테스트 | Jest ^29(단위·통합), supertest(API e2e), Playwright ^1.48(웹 e2e·비주얼) | `apps/api/package.json`, `apps/web/package.json` |

> 주의: `argon2`는 의존성으로 등재돼 있으나, 현재 인증 경로의 검증은 WebAuthn 서명과 SHA-256 verifier 상수시간 비교로 이루어진다(`apps/api/src/auth/auth.service.ts`). 코드에서 argon2 호출은 확인되지 않았다.

## 저장소 구성

pnpm 워크스페이스는 `apps/*`, `packages/*`이다. `packages/`는 현재 비어 있다. — `pnpm-workspace.yaml:1`

| 워크스페이스 | 패키지명 | 역할 | 근거 |
|--------------|----------|------|------|
| `apps/api` | `@daeoebi/api` | NestJS API 서버. auth·vault·asset 도메인 모듈 + prisma·common 인프라 | `apps/api/package.json`, `apps/api/src/app.module.ts` |
| `apps/web` | `@daeoebi/web` | Next.js 웹앱. 클라이언트 E2E 암호화·WebAuthn 세레모니·UI | `apps/web/package.json` |

최상위 주요 디렉터리: `apps/`(앱), `docs/`(PRD·기능 스펙·QA), `scripts/`, `.claude/`(규칙·스킬), `Makefile`·`docker-compose*.yml`(개발/운영 구동).

## 로컬 실행

로컬 개발은 `make dev-up`만 사용한다(DB는 도커, web·API는 호스트에서 직접 실행). 운영 스택(`docker-compose.yml`, `make prod-*`)은 로컬에서 기동하지 않는다. — `Makefile:1`, 루트 `CLAUDE.md` §3

| 명령 | 동작 | 근거 |
|------|------|------|
| `make dev-up` | 개발 DB(도커) 기동 + 마이그레이션 후 web·API(로컬) 동시 실행 | `Makefile` help |
| `make dev-migrate` | Prisma 마이그레이션 적용(DB 자동 기동) | `Makefile` |
| `make dev-generate` | Prisma Client 재생성 | `Makefile` |
| `make lint` / `make typecheck` / `make test` / `make build` | 전체 린트/타입체크/테스트/빌드 | `Makefile`, `package.json` scripts |

- API dev 서버: `nest start --watch`(기본 포트 4000, `PORT`로 변경). — `apps/api/package.json`, `apps/api/src/main.ts:83`
- Web dev 서버: `next dev --hostname :: --port 3010`. — `apps/web/package.json`
- `DATABASE_URL` 미설정 시 API는 한국어 에러로 즉시 종료한다. — `apps/api/src/main.ts:16`
