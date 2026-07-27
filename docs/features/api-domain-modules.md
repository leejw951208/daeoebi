# API 도메인 모듈 리팩토링

| 항목 | 내용 |
|------|------|
| 상태 | ✅ 완료 |
| 브랜치 | `refactor/api-domain-modules` |
| 작성일 | 2026-06-29 |
| 관련 문서 | 없음 (본 문서가 요약) |

## 1. 무엇을 만들었나
`apps/api`의 god-module `store`를 비밀번호 도메인 `VaultModule`(site·category·secret·search·backup)과 자산 도메인 `AssetModule`(income·expense·recurring)로 분리하고, 공용 유틸을 `common/`으로 옮겼다. 엔드포인트·요청/응답·인증·CSRF 동작은 그대로이며, 파일 위치와 모듈 조립만 도메인 단위로 정리됐다.

## 2. 왜 (배경·목표)
- `store` 모듈이 성격이 다른 두 도메인(비밀번호·자산)을 한곳에 담아 경계가 흐려진 god-module 상태였다.
- NestJS 권장인 피처 모듈 구조에 맞춰 도메인별로 경계를 명확히 나누는 것이 목표다. 동작·API 계약은 불변으로 유지한다.

## 3. 핵심 결정

| 결정 | 이유 | 대안(버린 것) |
|------|------|----------------|
| 도메인 2개 모듈(Vault·Asset)로 분리 | Vault는 Site/Secret 데이터를 공유하고 backup이 셋을 함께 내보내며, Asset은 가계부 안에서만 엮임 | 리소스별 8개 모듈/하이브리드 — 단일 사용자 PWA 규모에 과함 |
| `base64url`을 `common/`으로 이동 | auth와 store 서비스 5개가 함께 쓰는 인코딩 공용 유틸이라 공용 위치가 맞음 | `auth/`에 유지 — 자산·보관함이 auth에 결합됨 |
| CSRF 미들웨어를 `common/`으로 이동·개명(`CsrfMiddleware`) | 두 도메인이 공유하므로 공용 위치가 맞음 | store 아래 유지 — asset이 store에 결합됨 |
| `CSRF_INVALID`를 미들웨어 파일에 인라인 | 미들웨어가 유일 사용처라 도메인 에러 모듈과 분리 | 공유 types 모듈 신설 — asset→vault 결합 유발 |
| 새 테스트 없이 기존 테스트 전부 통과로 검증 | 순수 구조 리팩토링이라 이동 후 green이 동작 보존의 증거 | 신규 테스트 추가 — 범위 밖 |

## 4. 바뀐 것
| 영역 | 파일·변경 | 비고 |
|------|-----------|------|
| API(공용) | `apps/api/src/common/base64url.ts`·`base64url.spec.ts` | `auth/`에서 이동 |
| API(공용) | `apps/api/src/common/csrf.middleware.ts` | `store/store-csrf.middleware.ts`를 이동·개명(`CsrfMiddleware`), `CSRF_INVALID` 인라인 |
| API(자산) | `apps/api/src/asset/asset.module.ts`·`asset.types.ts` | 신규(`AssetModule`, `ASSET_ERRORS`) |
| API(자산) | `apps/api/src/asset/{income,expense,recurring}.{controller,service,service.spec}.ts` + `dto/` | `store/`에서 이동 |
| API(보관함) | `apps/api/src/vault/vault.module.ts`·`vault.types.ts` | `store.module`·`store.types`에서 개명(`VaultModule`, `VAULT_ERRORS`) |
| API(보관함) | `apps/api/src/vault/{site,category,secret,search,backup}.*` + `dto/` | `store/`에서 이동 |
| API(조립) | `apps/api/src/app.module.ts` | `StoreModule` → `VaultModule`·`AssetModule`로 교체 |

`store/` 디렉터리는 제거됐다. web(`apps/web`)·prisma 스키마·마이그레이션은 변경 없음(API 계약 불변).

## 5. 확인 방법
- [x] `pnpm --filter @daeoebi/api typecheck` · `lint` · `test` 통과 (이동 전후 테스트 수 동일이 동작 보존의 증거)
- [ ] `make dev-up` 후 보관함·자산 화면에서 사이트/비밀번호 CRUD·검색·백업과 수입/지출/고정지출이 이전과 동일하게 동작한다.
