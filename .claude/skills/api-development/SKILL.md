---
name: api-development
description: NestJS 백엔드 모듈·컨트롤러·서비스·DTO 작성과 Prisma 스키마·마이그레이션 작업을 수행. apps/api에서 엔드포인트 추가·수정, DTO 검증, Prisma 모델 변경, 가드·미들웨어 연동, 백엔드 버그 수정, API 재작업·보완 시 반드시 이 스킬을 사용할 것.
---

# API 개발 (NestJS + Prisma)

`apps/api`의 백엔드를 구현하는 절차와 규약. 이 프로젝트는 **암호화 비밀번호 보관함**이므로 모든 작업에서 시크릿 누출과 인증 우회를 우선 경계한다.

## 작업 전 확인
1. 손댈 모듈의 기존 파일을 먼저 읽는다. 모듈 구성은 `module → controller → service → dto → types` 패턴을 따른다.
2. 비슷한 기능이 이미 있는지 본다 (`store`, `vault`, `pin`). 패턴을 복제하고 재발명하지 않는다.
3. Prisma 모델은 `apps/api/prisma/schema.prisma`에서 확인한다. 단일 사용자 모델이라 `VaultMaster`/`PinCredential`은 `id="singleton"` 단일 행을 강제한다.

## 모듈 구현 규약
- **컨트롤러**: 얇게 유지한다. 라우팅·DTO 바인딩만 하고 로직은 서비스로 내린다. 클래스 단위 `@UseGuards(PinGuard)` 등 보호 가드를 빠짐없이 건다 (`store/secret.controller.ts` 참고).
- **DTO**: 모든 입력 필드에 `class-validator` 데코레이터를 건다. 검증 없는 `@Body()` 통과는 금지. 부분 수정 DTO는 `@nestjs/mapped-types`의 `PartialType`을 쓴다.
- **서비스**: Prisma 접근은 `PrismaService`(`prisma/prisma.service.ts`)를 주입해 사용한다. 직접 `PrismaClient`를 생성하지 않는다.
- **예외**: 도메인 에러는 NestJS 표준 예외(`NotFoundException` 등)를 던진다. 전역 `common/http-exception.filter.ts`가 응답 형태를 통일한다.

## 보안 필수 규칙
- 평문 비밀번호·암호화 키·복구코드·verifyToken을 **로그·응답·에러 메시지**에 절대 싣지 않는다. 암호문 본문(`ciphertext`/`iv`/`authTag`)은 복호화가 인가된 경로에서만 다룬다.
- 암호화/복호화는 `vault/vault-crypto.service.ts`의 기존 서비스를 재사용한다. 새 암호 로직을 직접 작성하면 security-reviewer 검토를 반드시 요청한다.
- 쓰기 요청 보호는 CSRF 미들웨어(`*-csrf.middleware.ts`)와 가드를 그대로 따른다. 새 라우트가 보호 범위에서 빠지지 않게 한다.
- 세션·쿠키 취급은 `vault/vault-cookies.ts`, `pin/pin-cookies.ts` 패턴을 따른다 (httpOnly·sameSite·secure 유지).

## Prisma 스키마 변경
- 스키마 수정 후 **새 마이그레이션을 생성**한다: `make migrate` (= `prisma migrate dev`). `apps/api/prisma/migrations/`의 기존 파일은 절대 수정하지 않는다.
- 스키마만 바꾸고 클라이언트 타입이 필요하면 `make generate`.
- 마이그레이션 충돌·데이터 손실 위험이 보이면 멈추고 리더에게 보고한다.

## 검증
- 변경 후 `make typecheck`로 타입을 확인한다. 테스트가 있으면 `pnpm --filter @daeoebi/api test`.
- API 계약(메서드·경로·요청/응답 shape)이 바뀌면 변경 요약을 `_workspace/`에 남기고 web-engineer에게 통보한다.

## 파일 헤더
새 `.ts` 파일 첫 줄에 역할을 설명하는 한국어 주석 한 줄을 단다.
