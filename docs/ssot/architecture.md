# 아키텍처

## 전체 구조

```
[apps/web (Next.js)]  --HTTPS/JSON, 쿠키 세션-->  [apps/api (NestJS)]  --Prisma/pg-->  [PostgreSQL]
   E2E 암호화(VK)                                    암호문 패스스루             암호문 블롭 저장
   WebAuthn 세레모니
```

- 웹은 VK로 본문을 봉인(seal)해 base64url 블롭으로 API에 보낸다. API는 복호화 없이 저장하고, 조회 시 블롭을 그대로 반환한다. 복호화(open)는 웹에서만 일어난다. — `apps/web/lib/vault-crypto.ts:201`(`seal`)·`:223`(`open`), 서버 서비스 `toView`/패스스루 로직(예: `apps/api/src/vault/secret.service.ts:50`)
- 운영에서는 cloudflared 리버스 프록시 뒤에서 same-origin(`/api/*` 프리픽스)으로 서비스한다. — `apps/api/src/main.ts:28`·`:38`

## 레이어

NestJS 표준 3계층(Controller → Service → Prisma)이다. Repository 계층은 별도로 두지 않고 서비스가 `PrismaService`를 직접 사용한다.

| 레이어 | 책임 | 예시 |
|--------|------|------|
| Controller | HTTP 라우트·상태코드·쿼리/바디 바인딩 | `apps/api/src/vault/secret.controller.ts`, `apps/api/src/asset/expense.controller.ts` |
| DTO | 요청 검증(class-validator) | `apps/api/src/asset/dto/expense.dto.ts` |
| Service | 도메인 로직·Prisma 접근·에러 매핑 | `apps/api/src/asset/expense.service.ts` |
| PrismaService | `PrismaClient` 라이프사이클 연결(pg 어댑터) | `apps/api/src/prisma/prisma.service.ts` |

- 공통 응답 래핑 인터셉터는 없다. 서비스가 반환한 객체가 그대로 직렬화된다(자세한 규칙은 `serialization.md`).
- 전역 에러 정규화는 `HttpExceptionFilter` 하나가 담당한다. — `apps/api/src/common/http-exception.filter.ts:12`

## 모듈 구조

루트 `AppModule`이 `ConfigModule`(전역)·`PrismaModule`·`AuthModule`·`VaultModule`·`AssetModule`을 조립한다. — `apps/api/src/app.module.ts:9`

| 모듈 | 컨트롤러 | 책임 | 근거 |
|------|----------|------|------|
| `AuthModule` | `AuthController` | passkey 등록/로그인/복구, 세션·백오프·챌린지, 전역 `AuthGuard`(APP_GUARD) 제공 | `apps/api/src/auth/auth.module.ts` |
| `VaultModule` | `SiteController`·`SecretController`·`SearchController`·`BackupController` | 사이트·비밀번호 CRUD, 라벨 검색, 백업 export/import | `apps/api/src/vault/vault.module.ts` |
| `AssetModule` | `IncomeController`·`ExpenseController`·`RecurringController`·`AssetCategoryController`·`SavingsAccountController`·`InvestmentController`·`SavingsBoxController` | 가계부(수입·지출·고정지출·카테고리)와 저축·투자·쌈짓돈 | `apps/api/src/asset/asset.module.ts` |
| `PrismaModule` | — | `PrismaService` 제공(인프라) | `apps/api/src/prisma/prisma.module.ts` |

- 모듈 간 의존은 모두 `PrismaModule` 단방향 의존이다. `VaultModule`·`AssetModule`은 `AuthModule`이 등록한 전역 가드로 보호되지만 import 의존은 없다(`APP_GUARD`는 전역 스코프). — `apps/api/src/auth/auth.module.ts:21`
- 비즈니스 도메인 문서는 모듈 디렉터리가 아니라 개념 단위로 나눈다: `authentication`(auth 모듈), `password-vault`(vault 모듈), `ledger`·`savings-investment`(asset 모듈을 둘로 분리).

## 요청 처리 흐름

대표적으로 보호된 쓰기 요청(`POST /expenses`)의 경로:

1. **보안 헤더 미들웨어**: CSP·`X-Content-Type-Options`·`Referrer-Policy` 설정. — `apps/api/src/main.ts:48`
2. **CORS**: `CORS_ORIGIN` 화이트리스트, `credentials: true`. — `apps/api/src/main.ts:66`
3. **CSRF 미들웨어**(도메인별): `AssetModule`/`VaultModule`은 `CsrfMiddleware`, `AuthModule`은 `AuthCsrfMiddleware`. 비안전 메서드에 대해 Origin 화이트리스트 + `X-Vault-Request: 1` 헤더를 요구한다. — `apps/api/src/common/csrf.middleware.ts:20`, `apps/api/src/asset/asset.module.ts:43`
4. **전역 세션 가드 `AuthGuard`**: `@Public()`이 아니면 `sm_session` 쿠키의 유효 세션을 요구한다. — `apps/api/src/auth/auth.guard.ts:23`
5. **`ValidationPipe`**(전역): `whitelist`·`forbidNonWhitelisted`·`transform`. DTO 위반 시 400. — `apps/api/src/main.ts:71`
6. **Controller → Service → Prisma**: 서비스가 base64url 블롭을 바이트로 디코드해 저장. — `apps/api/src/asset/expense.service.ts:133`
7. **응답**: 서비스 반환 객체를 JSON으로 직렬화. 예외는 `HttpExceptionFilter`가 한국어 형식으로 정규화. — `apps/api/src/common/http-exception.filter.ts:49`

- 미들웨어 실행 순서상 CSRF 미들웨어는 가드보다 먼저 돈다(NestJS 미들웨어 → 가드). 따라서 위조/오리진 위반은 인증 검사 전에 403으로 차단된다.
- 안전 메서드(GET/HEAD/OPTIONS)는 CSRF 미들웨어를 통과한다. — `apps/api/src/common/csrf.middleware.ts:22`

## 공통 인프라

| 관심사 | 위치 | 비고 |
|--------|------|------|
| 환경변수 선로드 | `apps/api/src/load-env.ts` | `main.ts` 최상단에서 dotenv로 `process.env`를 먼저 채운다(top-level env 상수 평가 순서 문제 회피) |
| 요청 검증 파이프 | `apps/api/src/main.ts:71` | 전역 `ValidationPipe` |
| 예외 정규화 | `apps/api/src/common/http-exception.filter.ts` | 전역 필터 |
| CSRF 정책 | `apps/api/src/common/csrf.middleware.ts`, `apps/api/src/auth/auth-csrf.middleware.ts` | Origin + 커스텀 헤더 |
| base64url 인코딩·검증 | `apps/api/src/common/base64url.ts` | `IsBase64url` 데코레이터 포함 |
| 세션/쿠키 | `apps/api/src/auth/session.service.ts`, `apps/api/src/auth/auth-cookies.ts` | 인메모리 세션, `sm_session`·`sm_recovery` 쿠키 |
| 클라이언트 암호화 계약 | `apps/web/lib/vault-crypto.ts` | AES-256-GCM·HKDF, `PRF_INFO`/`RC_INFO` 고정값·블롭 포맷은 변경 금지(루트 `CLAUDE.md` §3) |
| WebAuthn 세레모니(웹) | `apps/web/lib/webauthn.ts` | PRF 확장 출력 추출 |
