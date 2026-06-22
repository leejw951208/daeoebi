# Review: password-vault

## 리뷰 개요

- 일자. 2026-05-17
- Spec. docs/features/password-vault/spec.md
- Plan. docs/features/password-vault/plan.md

---

## 1. Spec 일치 여부

| # | 요구사항 | 상태 | 근거 |
|---|----------|------|------|
| S1 | 마스터 setup (Argon2id + verifyToken) | DONE | `apps/api/src/vault/vault.service.ts:96`, `vault-crypto.service.ts:25`, `vault.types.ts:15` |
| S2 | 마스터 unlock (verifyToken AEAD 검증) | DONE | `vault.service.ts:132`, `vault-crypto.service.ts:50` |
| S3 | idle 자동 잠금 (15분) | DONE | `vault.types.ts:41`, `vault-session.service.ts:39-58,95-101` |
| S4 | 5회/60초 backoff | DONE | `vault-backoff.service.ts:23-28`, `vault.service.ts:132-142` |
| S5 | unlock 응답 최소 시간 보장 (타이밍 누설 차단) | DONE | `vault.types.ts:42-43`, `vault.service.ts:610-616` — `MIN_UNLOCK_DURATION_MS=500` 으로 Argon2id 소요와 무관하게 총 500ms 이상 패딩 |
| S6 | 5종 카테고리 enum + OTHER | DONE | `vault.types.ts:3`, `dto/category-payload.dto.ts:54` |
| S7 | 카테고리별 CRUD + AES-256-GCM 암호화 | DONE | `vault.service.ts:255-327`, `vault-crypto.service.ts:38-47` |
| S8 | 라벨 평문 부분 일치 검색 | DONE | `vault.service.ts:200-205`, `prisma/schema.prisma:73-82` |
| S9 | OTHER 카테고리 key-value 최대 10쌍 + key 중복 거부 | DONE | `dto/category-payload.dto.ts:32-51,84-92` |
| S10 | 민감 필드 클립보드 복사 + 30초 자동 클리어 | DONE | `apps/web/app/vault/CopyField.tsx:26-56`, `apps/web/app/vault/clipboard-clear.ts:21-55` — `scheduleClipboardClear` 헬퍼로 분리되어 단위 테스트 5건으로 회귀 방지 |
| S11 | export 컨테이너 (magic "LIFEKEY-VAULT-EXPORT" + version + KDF + AEAD) | DONE | `vault.types.ts:38-39`, `vault.service.ts:436-479` |
| S12 | import 충돌 시 409, `?mode=replace` 옵트인 | DONE | `vault.service.ts:533-552`, `dto/import-query.dto.ts:9-13` (skip 모드 추가 지원) |
| S13 | import KDF 버전 다를 때 자동 재암호화 | DONE | `vault.service.ts:500-565` — import 키는 컨테이너 KDF 파라미터로 도출, 저장 시 현재 세션 키(KDF_V1)로 재암호화 |
| S14 | VaultLockGuard 401 VAULT_LOCKED | DONE | `vault-lock.guard.ts:16-30`, `vault.module.ts:21` |
| S15 | CSRF (SameSite=Strict 쿠키 + Origin 화이트리스트 + X-Vault-Request 헤더) | DONE | `vault-csrf.middleware.ts:9-54`, `vault-cookies.ts:6-15` |
| S16 | `/vault/status` state 분기 + idleSecondsRemaining | DONE | `vault.service.ts:86-94` |
| S17 | 에러 응답 통일 `{ code, message }` | DONE | `common/http-exception.filter.ts:26-51` + vault 도메인 전반의 HttpException 페이로드 |
| S18 | 마스터 NFKC 정규화 + trim + 12~256자 | DONE | `vault.service.ts:29-31,101-107`, `dto/master.dto.ts:5-8` |
| S19 | 423 VAULT_LOCKING (lock 처리 중 inflight) | DONE | `vault.service.ts:188-196`, `vault-session.service.ts:60-93` — `lockingPromise` + `LOCK_WINDOW_MS=100ms` |
| S20 | KDF migration 로직 (재키) | DONE | `vault.service.ts:331-427`, `dto/rekey.dto.ts:4-19` (P0 한정 endpoint 제공, README §"KDF migration" 안내) |

**요약.** DONE 20 / PARTIAL 0 / NOT DONE 0 / CHANGED 0

---

## 2. Plan 일치 여부

| 태스크 | 상태 | 비고 |
|--------|------|------|
| T001 Prisma 모델 + enum | 완료 | `apps/api/prisma/schema.prisma:51-82` |
| T002 migrate dev | 완료 | `apps/api/prisma/migrations/20260516135007_vault_init/migration.sql` |
| T003 VaultCryptoService | 완료 | Argon2id m=64MiB t=3 p=1, AES-256-GCM IV 12B / tag 16B |
| T004 VaultSessionService | 완료 | idle 15분 자동 잠금, `lock()` 내 키 zeroize, `lockingPromise` 로 inflight 차단 |
| T005 VaultController | 완료 | setup/unlock/lock/CRUD/search/status, 최소 500ms 패딩, 5회/60s backoff |
| T006 DTO + class-validator | 완료 | `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true })` 전역 적용 |
| T013 OTHER + key-value | 완료 | `UniqueKeys` 데코레이터로 중복 키 거부, ArrayMaxSize(10) |
| T014 export/import | 완료 | reject/skip/replace 3가지 모드, IMPORT_CORRUPT 400, CATEGORY_LABEL_CONFLICT 409 |
| T015 CSRF 미들웨어 | 완료 | controller-scoped 적용으로 다단계 라우트 누락 방지 |
| T007 잠금해제·마스터 설정 화면 | 완료 | typing/verifying/failed/rate-limited 상태 처리 (`UnlockScreen.tsx`) |
| T008 카테고리 폼 | 완료 | 카테고리 변경 시 fields 재설정, OTHER key 중복 클라이언트 측 사전 차단 |
| T009 목록·검색·CRUD | 완료 | category 필터, q 검색, VAULT_LOCKED 응답 시 status 재조회 |
| T012 클립보드 30초 자동 클리어 | 완료 | `scheduleClipboardClear` 순수 헬퍼 분리(`clipboard-clear.ts`) + `CopyField.tsx` 가 호출. ts-jest 단위 테스트 5건으로 회귀 방지 |
| T010 e2e 테스트 | 완료 | `apps/api/test/vault.e2e-spec.ts` 23건 — 모두 통과 |
| T011 README 업데이트 | 완료 | TTHW 체크리스트·argon2 빌드·KDF migration 절차 추가 |

**스코프 이탈.**

- `POST /vault/rekey` 와 `dto/rekey.dto.ts` 는 plan.md 의 P2 태스크 목록에 명시되지 않았으나 spec §"포함 범위(setup)" 의 "KDF migration 로직만 P0 에 준비" 와 정합. SCOPE_CREEP 아님.
- import `skip` 모드는 spec 명시 외 추가. 충돌 회피용 편의 옵션. SCOPE_CREEP 아님.
- `apps/web/app/vault/BackupPanel.tsx` 는 P3 태스크 목록에는 없지만 export/import UI 노출을 위해 추가됨. 합리적 확장.
- `apps/web/app/vault/clipboard-clear.ts` + `apps/web/jest.config.js` + `apps/web/app/vault/clipboard-clear.spec.ts` 는 plan 태스크로 분류되지 않은 보강 산출물(F1 패치). T012 테스트 가능성 확보를 위한 리팩터·인프라이므로 SCOPE_CREEP 아님.

---

## 3. 테스트 커버리지

| 요구사항 | 테스트 | 비고 |
|----------|--------|------|
| 1 첫 실행 setup | 있음. "setup 직후 status 가 unlocked..." | SameSite=Strict + HttpOnly 쿠키 검증 포함 |
| 2 setup 중복 → 409 | 있음. "setup 재호출은 409 SETUP_EXISTS" | |
| 3 unlock 정상 | 있음. 다수 시나리오 | |
| 4 unlock 실패 → 401 | 있음. "잘못된 마스터로 unlock 하면 401 MASTER_INVALID" | |
| 5 잠금 GET → 401 | 있음. "잠금 상태에서 entries 호출은 401 VAULT_LOCKED" | |
| 6 lock 후 GET → 401 | 있음. 위 케이스에 포함 | |
| 7 idle 타임아웃 자동 lock | 없음 | 시간 의존이라 e2e 미작성. 코드상 `scheduleAutoLock` 동작만 확인 |
| 8 등록·조회 왕복 | 있음. "CRUD 라운드트립이 동작한다" | |
| 9 카테고리 DTO 위반 → 400 | 있음. "카테고리 DTO 부적합..." | unknownField 로 forbidNonWhitelisted 검증 |
| 10 라벨 검색 | 있음. "CRUD 라운드트립" 의 `?q=국민` | |
| 11 재시작 후 잠금 | 있음. "재시작 후 평문은 노출되지 않는다" | |
| 12 빈 vault GET | 있음. "CRUD 라운드트립" 최종 단계 | |
| 13 1KB 라벨 | 있음. "1KB 라벨도 저장·검색이 가능하다" | |
| 14 유니코드 라벨 NFKC | 있음. "유니코드/이모지 라벨은 NFKC 정규화" | |
| 15 마스터 whitespace trim | 있음. "마스터 양쪽 whitespace 는 trim" | |
| 16 동시 lock/unlock → 423 | 있음. "동시 lock 호출 중 두 번째 요청은 423 VAULT_LOCKING" | |
| 17 AEAD 실패 평문 비노출 | 있음. "ciphertext 변조 시 500 으로 응답하고 평문은 노출되지 않는다" | |
| 18 5회 실패 → 429 | 있음. "5회 연속 unlock 실패..." | retryAfterSeconds 검증 |
| 19 CSRF 누락 → 403 | 있음. 4건 (헤더 단계1·다단계, 쿠키 누락, Origin 변조) | |
| 20 export 라운드트립 | 있음. "export → 새 DB import 라운드트립" | |
| 21 export 손상 → 400 | 있음. "손상된 컨테이너 import 는 400 IMPORT_CORRUPT" | |
| 22 import 충돌 | 있음. "import 충돌 - 기본은 409, mode=replace 는 덮어쓰기" | skip 모드까지 검증 |
| 23 OTHER key 중복 → 400 | 있음. "OTHER 카테고리에서 key 중복은 400" | |
| 24 클립보드 30초 만료 | 있음. `apps/web/app/vault/clipboard-clear.spec.ts` 5건 (cleared/changed/denied/cancel/onTick) | F1 패치로 추가. ts-jest(node 환경)로 헬퍼 단위 검증 |
| (보너스) unlock 최소 시간 패딩 | 있음. "마스터 미설정 상태에서도 unlock 응답은 최소 시간을 보장한다" | |
| (보너스) rekey 라운드트립 | 있음. "rekey 는 모든 entry 를 새 마스터로 재암호화한다" | |

**미테스트.** 1건 (#7 idle 자동 lock — 시간 의존).

---

## 4. 발견 항목

| 상태 | 심각도 | 신뢰도 | 위치 | 내용 |
|------|--------|--------|------|------|

(없음 — 신규 OPEN 항목 없음. F1 은 이전 라운드에서 FIXED 처리됨.)

### Appendix (confidence 5 미만)

| 심각도 | 신뢰도 | 위치 | 내용 |
|--------|--------|------|------|
| Info | 2 | `apps/api/src/vault/vault-session.service.ts:33-37` | `getKey()` 가 호출자에게 Buffer 참조 그대로 반환. 현재 호출 경로는 즉시 사용 후 폐기하므로 실효 영향 없음. |
| Info | 2 | `apps/api/src/vault/vault.service.ts:582-590` | `toPayload` 가 DTO 의 모든 옵션 필드를 그대로 직렬화. forbidNonWhitelisted 로 차단되지만, DTO 차원 카테고리별 분기 검증이면 더 견고. |
| Info | 2 | `apps/api/src/vault/vault.service.ts:331-427` | `rekey` 트랜잭션 내 entry 별 순차 복호화·재암호화. 1000건 이하 가정에서는 충분하나 1만건 이상에서는 트랜잭션 timeout 위험. |
| Info | 2 | `apps/web/app/vault/clipboard-clear.ts:24` | `Math.ceil(totalMs / intervalMs)` 로 tick 횟수를 산출. 기본값(30000/1000=30) 에서는 정확히 30회. 비정수 나눗셈일 경우 onTick 최종값이 음수가 될 수 있으나 onComplete 발화 후 cancel 되므로 실효 영향 없음. |
| Info | 1 | `apps/web/app/vault/clipboard-clear.ts:41` | 성공 경로에서 `clipboard.writeText('')` 실패 시 `denied` 로 분기되지만 이미 read 성공 후 비교까지 완료된 상황이라 빈 string 쓰기가 실패할 확률은 매우 낮음. |

---

## 5. 기능 검증

라이브 사이트 QA 는 dev 서버(127.0.0.1:3000, 127.0.0.1:4000)가 실행 중이 아니어서 수행하지 못했다. 대신 동일 코드 경로를 커버하는 자동화 스위트 두 개를 실행해 기능을 검증했다.

**실행 결과 (API e2e).**

- 명령. `pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json`.
- 결과. **2 suites / 36 tests 전부 통과** (vault.e2e-spec.ts 23건 + expenses.e2e-spec.ts 13건).
- 커버 시나리오. setup·중복setup·잠금 GET·잘못된 마스터·CRUD 라운드트립·CSRF(헤더/쿠키/다단계 라우트/Origin 변조)·export 라운드트립·손상 import·import 충돌(reject/replace/skip)·재시작 후 잠금·5회 실패 backoff·OTHER key 중복·DTO 미허용 필드·1KB 라벨·유니코드 NFKC·whitespace trim·ciphertext 변조시 평문 비노출·unlock 최소 시간 패딩·동시 lock 423·rekey 라운드트립.

**실행 결과 (web 단위).**

- 명령. `pnpm --filter @secrets-manager/web test`.
- 결과. **1 suite / 5 tests 전부 통과** (clipboard-clear.spec.ts).
- 커버 시나리오. cleared(만료 시 비움) / changed(외부에서 값 교체 시 그대로 둠) / denied(권한 거부) / cancel(타이머 중단) / onTick(매 초 남은 시간 통지).

**Typecheck.**

- `pnpm --filter @secrets-manager/api typecheck` / `pnpm --filter @secrets-manager/web typecheck` 둘 다 통과.

**라이브에서 별도 검증이 필요한 잔존 항목.** (a) `/vault` UI 의 setup → unlock → 등록 → 복사 → 30초 자동 클리어 시퀀스(통합 흐름), (b) idle 카운트다운 표시(`잠금까지 N초`)와 자동 lock 후 화면 전이, (c) `/vault/rekey` 호출 후 마스터 변경 UI 흐름 부재(README §"KDF migration" 명시 한계).

---

## 6. 보안 감사

**KDF / AEAD.**

- Argon2id m=64MiB(65536 KiB) / t=3 / p=1, salt 16B → OWASP 권장 파라미터 충족 (`vault.types.ts:15-22`, `vault-crypto.service.ts:25-35`).
- AES-256-GCM, key 32B, IV 12B(`randomBytes`), authTag 16B (`vault-crypto.service.ts:8-11,38-47`). nonce 재사용 없음.
- AEAD 인증 실패 시 `open()` 이 try/catch 후 null 반환, 호출자는 InternalServerErrorException 으로 500 응답 (`vault-crypto.service.ts:50-58`, `vault.service.ts:213-219`). e2e "ciphertext 변조 시 500..." 으로 평문 비노출 검증.

**세션·키 보관.**

- 단일 사용자·단일 키 인메모리 보관. idle 만료 또는 명시적 lock 시 `state.key.fill(0)` 후 null 화 (`vault-session.service.ts:82-93`).
- `OnModuleDestroy` 에서 `lock()` 호출 → 정상 종료 경로에서 키 폐기 보장.
- 비정상 종료(SIGKILL/패닉) 시 메모리 덤프에 키가 잔존할 수 있으나 spec 위협 모델 범위 외(OS 계정 탈취/디스크 이미징 제외).
- `lock()` 은 `lockingPromise` 단일 화살표로 직렬화되어 LOCK_WINDOW_MS=100ms 윈도우 동안 inflight 호출자에게 423 VAULT_LOCKING 을 반환.

**브루트포스·타이밍.**

- 5회 실패 후 60초 잠금 (`vault-backoff.service.ts:23-28`). e2e 검증됨.
- `MIN_UNLOCK_DURATION_MS=500` 으로 마스터 미설정·실패·성공 분기의 시간 차이를 패딩. e2e "unlock 응답은 최소 시간을 보장한다" 로 회귀 방지.

**CSRF.**

- 3중 방어. SameSite=Strict 쿠키 + Origin 화이트리스트 + X-Vault-Request 헤더 (`vault-csrf.middleware.ts:9-54`).
- `forRoutes(VaultController)` 단위 적용으로 다단계 라우트(PATCH /vault/entries/:id) 까지 자동 커버.
- 안전 메서드(GET/HEAD/OPTIONS)는 CSRF 미들웨어 제외, `VaultLockGuard` 로 보호.
- `VAULT_ALLOWED_ORIGINS` 환경 변수로 화이트리스트 덮어쓰기 가능. 미설정 시 `127.0.0.1:3000,localhost:3000` 기본값.

**검증·DoS.**

- `MasterDto` 12~256자, label 1024자, customFields 최대 10쌍, value 4096자, memo 4096자 (`dto/category-payload.dto.ts`, `dto/master.dto.ts`).
- `ValidationPipe({ forbidNonWhitelisted: true })` 로 미선언 필드 차단 (`main.ts:24-30`, e2e "카테고리 DTO 부적합" 확인).
- import body 는 `ImportBodyDto` 로 ValidationPipe 처리. master/container 누락 시 400 자동 응답.

**바인딩·CORS.**

- API 127.0.0.1:4000, web 127.0.0.1:3000 바인딩 (`main.ts:34`).
- CORS 는 `http://127.0.0.1:3000` 단일 origin + credentials (`main.ts:19-22`).

**의존성·빌드.**

- argon2 ^0.44.0 네이티브 모듈 (`apps/api/package.json:24`).
- `pnpm-workspace.yaml` 의 `allowBuilds` 화이트리스트로 임의 패키지의 빌드 스크립트 실행을 차단.
- 본 라운드 추가 devDeps. `jest ^29.7.0` / `ts-jest ^29.2.5` / `@types/jest ^29.5.13` (`apps/web/package.json`). 모두 잘 알려진 표준 패키지. allowBuilds 화이트리스트 변동 없음.

**클립보드 헬퍼 (F1 패치 신규 코드).**

- `apps/web/app/vault/clipboard-clear.ts` 는 순수 TypeScript 모듈로 네트워크·디스크 접근 없음.
- 만료 직전 사용자가 의도적으로 클립보드를 다른 내용으로 교체한 경우(`changed`) 비우지 않는다 → 사용자 작업물 보존.
- 권한 거부(`denied`) 시 조용히 처리하고 status 텍스트만 사용자에게 안내 → 클립보드 권한이 영구적으로 거부된 환경에서 무한 retry 발생 안 함.
- 콜백/상태에 평문 비밀번호가 직접 노출되지 않음(value 는 옵션으로만 전달되고 비교 후 폐기, 콜백 인자는 결과 enum 뿐).

**잔존 이슈 요약.**

- 없음. F1 은 `scheduleClipboardClear` 헬퍼 분리 + ts-jest 단위 테스트 5건 추가로 해소.

---

## 7. 디자인 적합성 (design.md 존재 시에만)

없음 (디자인 단계 미실행)
