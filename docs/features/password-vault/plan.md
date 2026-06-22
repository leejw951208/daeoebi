<!-- /autoplan restore point: /Users/leejinwoo/.gstack/projects/leejw951208-my-vault/main-autoplan-restore-20260516-201723.md -->
# Plan. Password Vault (개인 비밀번호 관리)

## 단계 구성

| Phase | 이름 | 목표 |
|-------|------|------|
| P1 | Prisma 모델 + 마이그레이션 | vault 저장 스키마가 SQLite 에 적용된다 |
| P2 | NestJS vault 모듈 | 잠금 해제·암복호·CRUD·export·CSRF API 가 동작한다 |
| P3 | Next.js UI | 웹에서 setup·unlock·카테고리별 CRUD·검색·클립보드 복사가 가능하다 |
| P4 | e2e 테스트 + 문서 | 핵심 시나리오가 자동 검증되고 README 가 onboarding 을 안내한다 |

## 구현 태스크

### P1. Prisma 모델 + 마이그레이션

- [ ] **T001** VaultMaster, VaultEntry, VaultCategory enum 추가 (KDF 파라미터, IV, label 검색 인덱스)
  - 선행. 없음 · 예상. 0.5h
- [ ] **T002** `prisma migrate dev --name vault-init` 실행하고 생성 SQL 검증
  - 선행. T001 · 예상. 0.25h

### P2. NestJS vault 모듈

- [ ] **T003** VaultCryptoService (Argon2id m=64MiB t=3 p=1, AES-256-GCM IV 12B / tag 16B, kdfVersion 버전닝)
  - 선행. T002 · 예상. 1.5h
- [ ] **T004** VaultSessionService (인메모리 키 보관, idle 타임아웃, lock/unlock, lock 중 inflight 요청 423 처리)
  - 선행. T003 · 예상. 1h
- [ ] **T005** VaultController (setup/unlock/lock/CRUD/search/status, 잠금 가드, fixed 200ms delay, 5회/60s backoff)
  - 선행. T004 · 예상. 2h
- [ ] **T006** DTO + class-validator 로 카테고리별 메타데이터 JSON 스키마 검증 (마스터는 NFKC + trim)
  - 선행. T005 · 예상. 1h
- [ ] **T013** OTHER 카테고리 + 자유 key-value 쌍 (최대 10, key 중복 400)
  - 선행. T006 · 예상. 0.5h
- [ ] **T014** 암호화 export/import 엔드포인트 (`POST /vault/export`, `POST /vault/import`, magic "LIFEKEY-VAULT-EXPORT", IMPORT_CORRUPT 400, conflict 409 / `?mode=replace`)
  - 선행. T005 · 예상. 1.5h
- [ ] **T015** CSRF 미들웨어 (SameSite=Strict 쿠키, Origin 화이트리스트, `X-Vault-Request: 1` 요구)
  - 선행. T005 · 예상. 0.5h

### P3. Next.js UI

- [ ] **T007** 잠금해제·마스터 설정 화면 (status 분기, idle/typing/verifying/failed/rate-limited/setup-mode 상태)
  - 선행. T005 · 예상. 1.5h
- [ ] **T008** 카테고리 선택 + 카테고리별 폼 (BANK/CARD/SECURITIES/SHOPPING/OTHER, validation-error 표시)
  - 선행. T007 · 예상. 2h
- [ ] **T009** 목록·검색·수정·삭제 (empty/loaded/search-no-results/locked/idle-warning/decrypt-failed 상태, AA 대비, 360~1440px 반응형)
  - 선행. T008 · 예상. 2h
- [ ] **T012** 민감 필드 클립보드 복사 + 30초 자동 클리어 (navigator.clipboard, aria-live 알림)
  - 선행. T009 · 예상. 0.5h

### P4. e2e 테스트 + 문서

- [ ] **T010** e2e 테스트 (잠금 상태 → 401, 재시작 후 평문 미노출, 잘못된 마스터 → 401, export 라운드트립, CSRF 차단)
  - 선행. T009 · 예상. 1.5h
- [ ] **T011** README 에 마스터 설정·TTHW 체크리스트(5분)·argon2 native 빌드 안내·KDF migration 절차 추가
  - 선행. T010 · 예상. 0.5h

## 아키텍처 다이어그램

```
                        +---------------------------+
                        |    apps/web (Next.js)     |
                        |  - UnlockScreen           |
                        |  - VaultListPage          |
                        |  - CategoryForm           |
                        +-------------+-------------+
                                      | HTTP (127.0.0.1:4000)
                                      | JSON, X-Vault-Request: 1
                                      v
                        +-----------------------------+
                        |   apps/api (NestJS)         |
                        |                             |
                        |  VaultController            |
                        |    POST /vault/setup        |
                        |    POST /vault/unlock       |
                        |    POST /vault/lock         |
                        |    GET  /vault/status       |
                        |    GET  /vault/entries      |
                        |    POST /vault/entries      |
                        |    PATCH /vault/entries/:id |
                        |    DELETE /vault/entries/:id|
                        |    POST /vault/export       |
                        |    POST /vault/import       |
                        |                             |
                        |  VaultSessionService        |
                        |    + in-memory key store    |
                        |    + idle timeout guard     |
                        |                             |
                        |  VaultCryptoService         |
                        |    Argon2id → AES-256-GCM   |
                        |                             |
                        |  PrismaService              |
                        +-------------+---------------+
                                      |
                                      v
                        +---------------------------+
                        |   SQLite                  |
                        |   apps/api/data/secrets-manager.db|
                        |                           |
                        |   VaultMaster (1 row)     |
                        |   VaultEntry  (N rows)    |
                        +---------------------------+
```

## 테스트 매트릭스

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|----------|
| 1 | 첫 실행 setup | `POST /vault/setup { master: "x" }` | 201, VaultMaster 1행, 세션 unlock |
| 2 | setup 중복 | 이미 master 존재 | 409 SETUP_EXISTS |
| 3 | unlock 정상 | 올바른 master | 200, 세션 키 발급 |
| 4 | unlock 실패 | 잘못된 master | 401 MASTER_INVALID |
| 5 | 잠금 CRUD | unlock 전 `GET /vault/entries` | 401 VAULT_LOCKED |
| 6 | lock 후 CRUD | `POST /vault/lock` 후 GET | 401 VAULT_LOCKED |
| 7 | idle 타임아웃 | unlock 후 N 분 대기 | 자동 lock, 다음 요청 401 |
| 8 | 등록·조회 왕복 | 카드 1건 등록 후 GET | 평문 필드 복원 |
| 9 | 카테고리 DTO | BANK 에 카드번호 필드 | 400 VALIDATION_FAILED |
| 10 | 라벨 검색 | `GET /vault/entries?q=국민` | 라벨 부분 일치 결과 |
| 11 | 재시작 미노출 | API 재기동 후 GET | 401 VAULT_LOCKED |
| 12 | 빈 vault | unlock 후 GET | 200, `{ entries: [] }` |
| 13 | 매우 긴 라벨 | label 1KB | 정상 저장 |
| 14 | 유니코드 라벨 | "🔑 메인 계좌" | NFKC 정규화 후 저장·검색 일치 |
| 15 | 마스터 whitespace | "  pw  " | trim 후 unlock 성공 |
| 16 | 동시 lock/unlock | unlock 진행 중 lock | 423 VAULT_LOCKING |
| 17 | AEAD 실패 | ciphertext 손상 | 500 + 평문 0바이트 노출 없음 |
| 18 | backoff 발동 | 5회 연속 실패 | 6번째 429 RATE_LIMITED, 60초 후 해제 |
| 19 | CSRF 누락 | `X-Vault-Request` 없이 POST | 403 CSRF_INVALID |
| 20 | export 라운드트립 | export → import | 정상 복원 |
| 21 | export 손상 | magic 변조 | 400 IMPORT_CORRUPT |
| 22 | import 충돌 | 같은 카테고리·라벨 존재 | 409 (기본) / replace 모드는 덮어쓰기 |
| 23 | OTHER key 중복 | key-value 동일 key 2개 | 400 VALIDATION_FAILED |
| 24 | 클립보드 만료 | 복사 30초 경과 | clipboard 자동 clear (권한 있을 때) |
