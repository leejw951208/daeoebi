# Authentication 도메인

> 한 줄 요약: passkey(WebAuthn) + PRF로 Vault Key(VK)를 래핑·복원하고, 복구코드 break-glass와 인메모리 세션을 관리한다. 서버는 VK·PRF 출력·복구코드 평문을 절대 보관하지 않는다.

## 1. 용어 정의

| 용어 (코드 식별자) | 의미 |
|--------------------|------|
| `WebauthnCredential` | passkey 자격증명 + 이 자격증명의 `prfSalt`·`wrappedVkPrf`(PRF로 래핑한 VK). `apps/api/prisma/schema.prisma:14` |
| `RecoveryWrap` | 복구코드로 래핑한 VK 단일 행(`id="singleton"`) + `verifier`. `apps/api/prisma/schema.prisma:31` |
| VK (Vault Key) | 256-bit AES-GCM 키. 모든 본문 암호화의 루트 키. 서버 미보유. `apps/web/lib/vault-crypto.ts:67` |
| `wrappedVkPrf` / `wrappedVkRc` | PRF 출력 / 복구코드로 각각 래핑한 VK 블롭(packed `iv‖ct‖tag`). `apps/api/prisma/schema.prisma:23`·`:34` |
| `prfSalt` / `rcSalt` | HKDF salt(자격증명별 / 복구용). `apps/web/lib/vault-crypto.ts:154`·`:174` |
| `verifier` | `SHA-256(복구코드 20바이트)`. 복구 검증 상수시간 비교용. `apps/api/src/auth/recovery-code.ts:10` |
| `SessionService` | 일반 세션(`sm_session`, idle 15분)·복구 세션(`sm_recovery`, TTL 5분) 인메모리 관리. `apps/api/src/auth/session.service.ts` |
| `ChallengeService` | 등록/로그인 WebAuthn 챌린지 인메모리 보관(1회용, TTL 60초). `apps/api/src/auth/challenge.service.ts` |
| `BackoffService` | 로그인/복구/부트스트랩 실패 글로벌 백오프(5회/60초). `apps/api/src/auth/backoff.service.ts` |
| `getBootstrapToken()` | 첫 등록 게이트 토큰(`BOOTSTRAP_TOKEN`) 조회. `apps/api/src/auth/auth.types.ts:55` |
| `AuthGuard` | 전역 세션 가드(APP_GUARD). `@Public()` 외 라우트 보호. `apps/api/src/auth/auth.guard.ts` |

## 2. 핵심 엔티티와 애그리게이트

- **엔티티 목록**:
  - `WebauthnCredential` — passkey 1개당 1행. 다중 기기 등록 허용.
  - `RecoveryWrap` — 시스템 전체에 1행(break-glass 백업).
- **애그리게이트**: 단일 사용자 모델이라 "이 볼트의 인증 상태"가 하나의 애그리게이트다. `WebauthnCredential`(0..N)과 `RecoveryWrap`(0..1)이 함께 VK로의 접근 경로를 이룬다.
- **애그리게이트 루트**: 명시적 루트 엔티티는 없다(사용자/계정 테이블 없음). 일관성 경계는 첫 등록 트랜잭션이 잡는다 — 새 자격증명과 `RecoveryWrap`을 한 트랜잭션에서 커밋한다. — `apps/api/src/auth/auth.service.ts:184`
- 근거: `apps/api/prisma/schema.prisma:14`·`:31`, `apps/api/src/auth/auth.service.ts`

## 3. 불변식 (invariant)

- INV-1: 첫 등록(자격증명 0개)에는 복구 래핑(`dto.recovery`)이 필수다. 없으면 `RECOVERY_REQUIRED`. — `apps/api/src/auth/auth.service.ts:150`
- INV-2: 첫 등록은 `BOOTSTRAP_TOKEN` 상수시간 비교를 통과해야 한다. 서버 토큰 미설정이면 첫 등록 자체가 차단된다(fail-closed). — `apps/api/src/auth/auth.service.ts:137`·`:454`
- INV-3: 기기 추가 등록(자격증명 ≥ 1)은 유효 일반 세션 또는 유효 복구 세션을 요구한다. — `apps/api/src/auth/auth.service.ts:425`(`assertRegisterAllowed`)
- INV-4: 복구 검증은 `verifier`를 `timingSafeEqual`로 비교하며, 길이 불일치면 비교 없이 실패 처리한다(길이 누출·throw 방지). — `apps/api/src/auth/auth.service.ts:404`·`:407`
- INV-5: 등록/로그인 챌린지는 1회용이다. `consume`이 즉시 삭제하고, 만료(60초)면 무효. — `apps/api/src/auth/challenge.service.ts:26`
- INV-6: 서버는 VK·PRF 출력·복구코드 평문·HKDF 키를 저장하지 않는다. `RecoveryWrap.verifier`는 SHA-256 해시일 뿐 원문 복원 불가. — `apps/api/prisma/schema.prisma:35`, `apps/api/src/auth/auth.service.ts:369`
- INV-7: 복구 재등록(`isRecovery=true`)은 기존 자격증명 전체를 삭제한 뒤 새 자격증명을 만든다(분실 기기 무효화). — `apps/api/src/auth/auth.service.ts:186`

## 4. 상태와 상태 전이 규칙

명시적 상태 enum은 없다. 상태는 (a) 볼트 등록 여부, (b) 세션 유효성, (c) 백오프 차단 여부로 표현된다.

- **볼트 등록 상태**: `registered = webauthnCredential.count() > 0`. — `apps/api/src/auth/auth.service.ts:76`
- **세션 종류**: 일반 세션(idle 갱신, 15분), 복구 세션(고정 TTL 5분, 갱신 없음). — `apps/api/src/auth/session.service.ts:14`·`:38`
- **챌린지 종류**: `"register"` / `"login"`. — `apps/api/src/auth/challenge.service.ts:6`

| From | To | 트리거 | 조건 | 근거 |
|------|----|--------|------|------|
| 미등록 | 등록됨(일반 세션 발급) | `POST /auth/register/verify` | 부트스트랩 토큰 일치 + WebAuthn 검증 + 복구 래핑 존재 | `apps/api/src/auth/auth.controller.ts:58`, `auth.service.ts:125` |
| 등록됨(무세션) | 일반 세션 | `POST /auth/login/verify` | WebAuthn 인증 검증 성공 | `apps/api/src/auth/auth.controller.ts:88` |
| 등록됨(무세션) | 복구 세션(5분) | `POST /auth/recovery/verify` | verifier 상수시간 일치 | `apps/api/src/auth/auth.controller.ts:101` |
| 복구 세션 | 일반 세션 + 복구 세션 폐기 | `POST /auth/register/verify`(복구 컨텍스트) | 복구 세션 유효 → 기존 자격증명 전체 삭제·새 등록·복구 세션 one-shot 폐기 | `apps/api/src/auth/auth.controller.ts:71`, `auth.service.ts:186` |
| 일반/복구 세션 | 무세션 | `POST /auth/logout` | 항상 | `apps/api/src/auth/auth.controller.ts:127` |
| 유효 세션 | 만료 | 마지막 접근 후 15분 경과 | idle 타임아웃 | `apps/api/src/auth/session.service.ts:24` |
| 정상 | 백오프 차단(429) | 실패 누적 | `MAX_LOGIN_FAILURES`(5) 도달 → 60초 차단 | `apps/api/src/auth/backoff.service.ts:23` |
| 백오프 차단 | 정상 | 60초 경과 또는 성공 | `reset()` | `apps/api/src/auth/backoff.service.ts:11`·`:30` |

- 인메모리 세션·챌린지·백오프는 프로세스 재시작 시 전부 폐기된다. — `apps/api/src/auth/session.service.ts:1`

## 5. 비즈니스 규칙/정책

- RULE-1: 로그인 검증 성공 시 해당 자격증명의 `wrappedVkPrf`·`prfSalt`를 반환한다(클라가 PRF 출력으로 언랩). — `apps/api/src/auth/auth.service.ts#loginVerify`(`:361`)
- RULE-2: 로그인 옵션은 등록된 각 자격증명의 `prfSalt`로 `evalByCredential`을 구성한다(다중 기기 PRF eval). — `apps/api/src/auth/auth.service.ts#loginOptions`(`:238`)
- RULE-3: 등록 옵션의 `excludeCredentials`는 복구 재등록이면 비운다(같은 인증기 재사용 허용), 아니면 기존 자격증명을 넣어 중복 등록을 막는다. — `apps/api/src/auth/auth.service.ts:106`
- RULE-4: 옵션 생성(챌린지 발급)은 레이트리밋한다 — 60초 윈도우당 20회 초과 시 429(`OPTIONS_MAX_PER_WINDOW`). — `apps/api/src/auth/auth.service.ts#assertOptionsRate`(`:509`), `auth.types.ts:31`
- RULE-5: 복구 검증은 별도 슬라이딩 윈도우(60초/10회)로 추가 제한한다(무인증 break-glass 오프라인 대입 완화). — `apps/api/src/auth/auth.service.ts#assertRecoveryRate`(`:486`)
- RULE-6: WebAuthn counter가 비증가(new ≤ stored, 단 둘 다 0 제외)면 복제 authenticator 의심 경고 로그만 남기고 진행한다. — `apps/api/src/auth/auth.service.ts:345`
- RULE-7: `POST /auth/dev/login`은 `NODE_ENV=production`이면 404(fail-closed), 비운영에서만 WebAuthn 없이 세션 발급. — `apps/api/src/auth/auth.controller.ts:120`
- RULE-8: 세션 쿠키는 `httpOnly`·`sameSite=strict`·`path=/`, secure는 `COOKIE_SECURE=true` 또는 `NODE_ENV=production`일 때. — `apps/api/src/auth/auth-cookies.ts:9`·`:13`
- RULE-9: 부트스트랩 토큰 값은 로그/예외 메시지에 싣지 않으며 SHA-256으로 고정 길이화 후 상수시간 비교한다. — `apps/api/src/auth/auth.service.ts:469`

## 6. 도메인 이벤트

구현된 도메인 이벤트 없음. 이벤트 버스/발행 시스템이 없고(EventEmitter·메시지 브로커 미사용), 모든 상태 변화는 서비스에서 직접 처리한다. 관측 가능한 부수효과는 로그(`Logger.warn`, 예 `apps/api/src/auth/auth.service.ts:347`)뿐이다.

## 7. 컨텍스트 경계와 책임

- **다루는 범위**: passkey 등록/로그인/복구 세레모니, VK 래핑 블롭 저장·반환, 세션·복구 세션·챌린지·백오프·부트스트랩 게이트, 전역 세션 가드.
- **다루지 않는 범위 / 위임**:
  - VK 생성·언랩·본문 암복호화는 전적으로 웹(`apps/web/lib/vault-crypto.ts`)이 수행한다. 서버는 블롭 저장소일 뿐이다.
  - Base32(Crockford) 복구코드 인코딩/디코딩은 웹만 구현한다. 서버는 base64url 20바이트를 받아 SHA-256만 비교한다(상호운용 확정). — `apps/api/src/auth/recovery-code.ts:1`, `apps/web/lib/vault-crypto.ts:239`
- **다른 도메인과의 관계**: `AuthGuard`가 APP_GUARD로 전역 등록돼 `password-vault`·`ledger`·`savings-investment`의 모든 비-`@Public` 라우트를 보호한다. 그 도메인들은 auth를 import하지 않는다(전역 스코프 의존). — `apps/api/src/auth/auth.module.ts:21`

## 8. 예외/에러 케이스

에러 코드는 `AUTH_ERRORS`(`apps/api/src/auth/auth.types.ts:4`), CSRF는 `auth-csrf.middleware.ts`.

| 상황 | 처리 | 에러 코드 / 예외 | 근거 |
|------|------|------------------|------|
| 등록된 passkey 없음(로그인 옵션) | 404 | `NOT_REGISTERED` | `auth.service.ts:232` |
| 첫 등록에 복구 래핑 누락 | 400 | `RECOVERY_REQUIRED` | `auth.service.ts:151` |
| 챌린지 만료/무효 | 400 | `CHALLENGE_INVALID` | `auth.service.ts:143`·`:294` |
| WebAuthn 등록/인증 검증 실패 | 400/401 | `VERIFICATION_FAILED` | `auth.service.ts:167`·`:337` |
| 인증 응답 credential id 무효 | 400 | `VALIDATION_FAILED` | `auth.service.ts:285` |
| 미등록 자격증명으로 로그인 | 401 | `CREDENTIAL_NOT_FOUND` | `auth.service.ts:305` |
| 복구 래핑 없음(복구 검증) | 404 | `RECOVERY_NOT_FOUND` | `auth.service.ts:389` |
| 기기 추가에 세션 없음 | 401 | `SESSION_REQUIRED` | `auth.service.ts:431`, `auth.guard.ts:33` |
| 부트스트랩 토큰 미설정/누락 | 401 | `BOOTSTRAP_REQUIRED` | `auth.service.ts:457`·`:465` |
| 부트스트랩 토큰 불일치 | 401 | `BOOTSTRAP_INVALID` | `auth.service.ts:479` |
| 백오프/레이트리밋 초과 | 429(+`retryAfterSeconds`) | `RATE_LIMITED` | `auth.service.ts:271`·`:376`·`:496`·`:519` |
| CSRF(Origin/헤더 위반) | 403 | `CSRF_INVALID` | `auth-csrf.middleware.ts:23`·`:32` |

- 정의는 있으나 서비스에서 throw되지 않는 코드: `ALREADY_REGISTERED`(`auth.types.ts:6`)는 상수만 존재하고 실제 throw 경로가 확인되지 않음.
