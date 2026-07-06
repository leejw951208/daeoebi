# API 도메인 모듈 리팩토링 설계

> 일자: 2026-06-29 · 대상: `apps/api` · 성격: 내부 구조 리팩토링(동작·API 계약 불변)

## 1. 목적
`store` 모듈이 비밀번호 도메인(site·category·secret·search·backup)과 자산 도메인(income·expense·recurring) 두 가지를 한 모듈에 담은 god-module 상태다. NestJS가 권장하는 **피처 모듈**(기능/도메인별 컨트롤러·서비스 묶음으로 경계를 명확히)에 맞춰 도메인 단위로 분리한다.

엔드포인트·요청/응답 형태·인증·CSRF 동작은 **변경하지 않는다**. 파일 위치와 모듈 조립, 공유 유틸 위치만 바꾼다.

## 2. 분리 단위 (확정: 도메인 2개 모듈)
- **VaultModule** — site·category·secret·search·backup. 같은 Site/Secret 데이터를 공유하고 backup이 셋을 한꺼번에 내보내므로 한 도메인으로 묶는다.
- **AssetModule** — income·expense·recurring. 자산(가계부) 도메인 안에서만 엮인다.

리소스별 8개 모듈/하이브리드는 단일 사용자 PWA 규모에 과해 채택하지 않는다. 기존 `auth` 모듈의 "디렉터리 1개 + 평면 파일 + dto/ 하위" 컨벤션과 맞춘다.

## 3. 목표 디렉터리 구조
```
src/
  common/
    base64url.ts            # auth/ 에서 이동 (인코딩 공용 유틸)
    base64url.spec.ts
    csrf.middleware.ts      # store-csrf.middleware.ts 이동·개명 (두 도메인 공유)
  auth/                     # 변경 없음 (base64url import 경로만 갱신)
  vault/
    vault.module.ts         # store.module.ts 대체
    vault.types.ts          # SITE/CATEGORY/SECRET/IMPORT 에러
    site.controller.ts  site.service.ts  site.service.spec.ts
    category.*  secret.*  search.*  backup.*
    dto/
      site.dto.ts category.dto.ts secret.dto.ts backup.dto.ts
  asset/
    asset.module.ts
    asset.types.ts          # EXPENSE/RECURRING/INVALID_MONTH 에러
    income.*  expense.*  recurring.*
    dto/
      income.dto.ts expense.dto.ts recurring.dto.ts
```
`store/` 디렉터리는 제거된다.

## 4. 공유 유틸 정리 (추천안에 포함)
1. **`base64url` 이동**: `auth/base64url.ts` → `common/base64url.ts`. 현재 store 서비스 5개(secret·backup·income·expense·recurring)와 auth가 함께 쓰는 인코딩 유틸이라 공용 위치가 맞다. import 경로를 모든 사용처에서 갱신한다.
2. **`STORE_ERRORS` 분리**:
   - `vault.types.ts` → `VAULT_ERRORS`: SITE_NOT_FOUND, CATEGORY_NOT_FOUND, CATEGORY_SITE_MISMATCH, SECRET_NOT_FOUND, CIPHERTEXT_INCOMPLETE, IMPORT_CONFLICT, IMPORT_INVALID
   - `asset.types.ts` → `ASSET_ERRORS`: EXPENSE_NOT_FOUND, EXPENSE_DUPLICATE, RECURRING_NOT_FOUND, CIPHERTEXT_INCOMPLETE_ASSET, INVALID_MONTH
   - CSRF_INVALID은 두 도메인이 공유하는 `common/csrf.middleware.ts`가 유일 사용처이므로 미들웨어 파일 안에 상수로 둔다(`CSRF_INVALID = "CSRF_INVALID"`). asset→vault 결합을 피한다.

## 5. 모듈 조립
- CSRF 미들웨어(`common/csrf.middleware.ts`)는 두 모듈이 공유한다. provider가 아니므로 모듈 export가 필요 없고, 각 모듈이 클래스를 import해 `forRoutes`로 적용한다. 기존 store.module의 forRoutes 목록(GET 전용인 search 제외)을 도메인별로 나눠 그대로 적용한다.
- `vault.module.ts`: imports `[PrismaModule]`, controllers 5개(site·category·secret·search·backup), providers 5개, `configure`에서 CSRF를 site·category·secret·backup에 적용.
- `asset.module.ts`: imports `[PrismaModule]`, controllers 3개, providers 3개, `configure`에서 CSRF를 income·expense·recurring에 적용.
- `app.module.ts`: `StoreModule` import → `VaultModule`, `AssetModule` 두 개로 교체.

## 6. 동작 불변 보장
- 모든 `@Controller("...")` prefix 유지: sites·categories·secrets·search·store·income·expenses·recurring.
- 전역 세션 가드(AuthModule), 응답 형태, DTO 검증, base64url 패스스루 로직은 코드 그대로 이동만 한다.
- `.spec.ts`는 대상 코드와 같은 디렉터리로 함께 이동하고 import 경로만 갱신한다.

## 7. 검증
1. `make typecheck` — import 경로 누락 즉시 검출.
2. `make lint`.
3. `make test` — 기존 단위/통합 테스트가 이동 후에도 전부 통과(동작 불변의 핵심 증거).
4. (선택) `make dev-up` 후 보관함·자산 화면 스모크.

## 8. 작업 순서 (커밋 단위)
`develop`에서 `refactor/api-domain-modules` 브랜치 생성. 의미 단위 커밋:
1. `common/base64url` 이동 + 사용처 import 갱신 (typecheck/test 통과).
2. `vault` 도메인 분리(파일 이동, vault.types, vault.module).
3. `asset` 도메인 분리(파일 이동, asset.types, asset.module).
4. CSRF 미들웨어 common 이동 + app.module 교체 + store/ 제거.

각 커밋 후 typecheck/test 통과 확인. 커밋·develop 머지는 사용자 요청 시에만, main 머지 금지.

## 9. 범위 밖
- 엔드포인트/응답 형태 변경, 새 기능, 비즈니스 로직 수정.
- web(`apps/web`) 변경 — API 계약 불변이므로 클라이언트는 손대지 않는다.
- prisma 스키마/마이그레이션 변경.
