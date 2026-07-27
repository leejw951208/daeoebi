# Password Vault 도메인

> 한 줄 요약: 사이트별로 비밀번호(암호문 본문)를 보관하고, 라벨 평문으로 검색하며, 전체를 암호문 그대로 백업 export/import한다. 서버는 본문을 복호화하지 않는다.

## 1. 용어 정의

| 용어 (코드 식별자) | 의미 |
|--------------------|------|
| `Site` | 비밀번호를 묶는 최상위 단위. `label`(평문 검색용)·`icon`. `apps/api/prisma/schema.prisma:41` |
| `Secret` | 사이트 하위 비밀번호 1건. `label`(평문) + 암호문 본문(`iv`/`ciphertext`/`authTag`). `apps/api/prisma/schema.prisma:182` |
| `SiteService` / `SecretService` | 사이트/비밀번호 CRUD. `apps/api/src/vault/site.service.ts`·`secret.service.ts` |
| `SearchService` | 사이트·비밀번호 라벨 부분검색. `apps/api/src/vault/search.service.ts` |
| `BackupService` | 전체 export / id 충돌 모드별 import. `apps/api/src/vault/backup.service.ts` |
| `ImportMode` | 백업 import 충돌 처리 모드: `"reject"` \| `"skip"` \| `"replace"`. `apps/api/src/vault/dto/backup.dto.ts:104` |
| `kdfVersion` | Secret 본문 KDF 버전(default 1, 현재 코드 분기 없음). `apps/api/prisma/schema.prisma:190` |

## 2. 핵심 엔티티와 애그리게이트

- **엔티티 목록**:
  - `Site` — 비밀번호 그룹(라벨·아이콘, 평문).
  - `Secret` — 사이트에 속한 비밀번호 1건(라벨 평문 + 암호문 본문).
- **애그리게이트**: `Site`가 `Secret[]`을 소유한다.
- **애그리게이트 루트**: `Site`. `Secret`은 항상 `siteId`로 사이트에 종속되며, 사이트 삭제 시 하위 Secret이 cascade 삭제된다(경계·수명 일관성). — `apps/api/prisma/schema.prisma:185`
- 근거: `apps/api/prisma/schema.prisma:41`·`:182`

## 3. 불변식 (invariant)

- INV-1: `Secret`은 존재하는 `Site`를 참조해야 한다. 생성 시 `ensureSite`로 사전 확인하고, DB에서도 FK로 강제된다. — `apps/api/src/vault/secret.service.ts:126`, `schema.prisma:185`
- INV-2: 본문 암호문은 `iv`·`ciphertext`·`authTag` 3필드가 전부 있거나 전무여야 한다. 일부만 갱신 시 `CIPHERTEXT_INCOMPLETE`로 거부(부분 암호문 방지). — `apps/api/src/vault/secret.service.ts:90`
- INV-3: 서버는 본문을 복호화하지 않는다. 상세 조회는 base64url 블롭을 그대로 반환하고 복호화는 클라이언트가 한다. — `apps/api/src/vault/secret.service.ts:49`
- INV-4: 백업 import 시 `Secret.siteId` 참조는 백업 페이로드 안에서 닫혀 있어야 한다(참조 사이트 부재면 `IMPORT_INVALID`). — `apps/api/src/vault/backup.service.ts:65`
- INV-5(코드상 강제): Site 삭제 시 하위 Secret은 cascade 삭제. — `schema.prisma:185`

## 4. 상태와 상태 전이 규칙

명시적 상태 머신 없음. `Site`·`Secret`은 생성/수정/삭제만 있고 상태 필드가 없다. — `apps/api/src/vault/site.service.ts`, `secret.service.ts`

백업 import의 충돌 처리만 모드 분기가 있다:

| Mode | 충돌(id 중복) 처리 | 근거 |
|------|--------------------|------|
| `reject` | 충돌 1건이라도 있으면 전체 409로 거부 | `backup.service.ts:83` |
| `skip` | 충돌 행은 건너뜀(`skipped`) | `backup.service.ts:103`·`:131` |
| `replace` | 충돌 행 덮어씀(`replaced`) | `backup.service.ts:106`·`:134` |

- 비충돌 신규 행은 테이블별 `createMany`로 일괄 삽입한다(사이트 → 비밀번호 순). — `apps/api/src/vault/backup.service.ts:114`·`:150`

## 5. 비즈니스 규칙/정책

- RULE-1: 사이트 목록은 `label` 오름차순, 하위 secret 개수(`_count`)를 포함해 반환한다. — `apps/api/src/vault/site.service.ts#list`(`:11`)
- RULE-2: 비밀번호 목록(사이트별)은 본문 없이 메타만(`LIST_SELECT`), 상세만 암호문 포함(`DETAIL_SELECT`). — `apps/api/src/vault/secret.service.ts:12`·`:20`
- RULE-3: 검색은 `Site.label`·`Secret.label`에 대해 대소문자 무시 부분일치, 각 최대 50건. 본문은 검색 대상 아님. — `apps/api/src/vault/search.service.ts#search`(`:12`), `LIMIT`(`:6`)
- RULE-4: 검색/백업 응답의 `categories`는 레거시 호환용 빈 배열이다(비밀번호 분류 기능 제거됨). — `apps/api/src/vault/search.service.ts:37`, `backup.service.ts:39`
- RULE-5: 백업 export는 `version: "1"`, `exportedAt`(ISO) 메타와 함께 전체 Site·Secret을 `createdAt` 오름차순으로 내보낸다. — `apps/api/src/vault/backup.service.ts:23`
- RULE-6: import 페이로드는 `version` `"1"` 고정, 배열당 최대 1000건(`MAX_IMPORT_ITEMS`), 레거시 `categories`는 수용만 하고 무시. — `apps/api/src/vault/dto/backup.dto.ts:78`·`:91`
- RULE-7: 쓰기 요청은 `CsrfMiddleware`(Origin + `X-Vault-Request: 1`) + 전역 세션 가드로 보호된다. `SearchController`는 CSRF 미들웨어 대상이 아니다(GET 전용). — `apps/api/src/vault/vault.module.ts:26`

## 6. 도메인 이벤트

구현된 도메인 이벤트 없음. CRUD·백업은 이벤트 발행 없이 서비스에서 직접 Prisma로 처리한다. — `apps/api/src/vault/secret.service.ts`, `backup.service.ts`

## 7. 컨텍스트 경계와 책임

- **다루는 범위**: 사이트·비밀번호 CRUD, 라벨 검색, 암호문 그대로의 백업 export/import.
- **다루지 않는 범위 / 위임**:
  - 본문 암복호화·VK 관리는 `authentication` 도메인 + 웹 크립토가 담당. 이 도메인은 암호문 블롭 저장소다.
  - 인증/세션 보호는 `authentication`의 전역 `AuthGuard`에 위임.
- **다른 도메인과의 관계**: `ledger`·`savings-investment`와 데이터 공유 없음(별도 테이블). 백업 export/import는 이 도메인(Site·Secret)만 대상이며 가계부 데이터는 포함하지 않는다. — `apps/api/src/vault/backup.service.ts:23`

## 8. 예외/에러 케이스

에러 코드는 `VAULT_ERRORS`(`apps/api/src/vault/vault.types.ts:2`).

| 상황 | 처리 | 에러 코드 / 예외 | 근거 |
|------|------|------------------|------|
| 사이트 없음 | 404 | `SITE_NOT_FOUND` | `site.service.ts:69`, `secret.service.ts:131` |
| 비밀번호 없음 | 404 | `SECRET_NOT_FOUND` | `secret.service.ts:147` |
| 부분 암호문(일부 필드만) | 400 | `CIPHERTEXT_INCOMPLETE` | `secret.service.ts:92` |
| import: secret이 없는 사이트 참조 | 400 | `IMPORT_INVALID` | `backup.service.ts:68` |
| import: mode 값 오류 | 400 | `IMPORT_INVALID` | `backup.controller.ts:30` |
| import(reject): id 충돌 | 409 | `IMPORT_CONFLICT` | `backup.service.ts:88` |
| Prisma P2025(수정/삭제 대상 없음) | 404로 매핑 | `SITE_NOT_FOUND`/`SECRET_NOT_FOUND` | `site.service.ts:47`, `secret.service.ts:112` |
