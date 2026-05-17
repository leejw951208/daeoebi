# Spec. Password Vault (개인 비밀번호 관리)

> 한국 금융·쇼핑 자격증명을 도메인 메타데이터(계좌번호·카드번호·OTP 등)와 함께 한 로컬 vault 에 보관하는 Life Key 기능.

## 배경

은행, 카드, 증권 계좌, 쇼핑몰 같은 개인 자격증명을 한곳에 정리해 두는 도구가 필요하다. 범용 비밀번호 관리자(Bitwarden, 1Password, Keychain)는 비밀번호는 보관해 주지만, 한국 금융 도메인 특유의 메타데이터(은행 계좌번호, 카드번호, 증권 OTP 주기, 쇼핑몰 URL)를 일등 시민으로 다루지 못한다.

Life Key 는 이미 "내 재무생활"을 한 곳에서 다루는 로컬 단일 사용자 도구이므로, 같은 도메인 관점으로 자격증명을 합류시킨다. 이로써 추후 "이 카드의 결제 계정은 이 계좌" 같은 도메인 조인을 같은 SQLite 안에서 만들 수 있다.

## 기능 목록

### 마스터 패스워드 setup / unlock / lock

vault 전체를 보호하는 단일 마스터 패스워드를 첫 실행에 설정하고, 이후 접근 전마다 unlock 한다. idle 일정 시간이 지나면 메모리에서 키를 폐기해 자동으로 lock 한다.

**동작 방식**

- 첫 실행. `POST /vault/setup` 으로 마스터 입력 → Argon2id 로 키 도출 → verifyToken(고정 평문의 AEAD) 저장 → 세션 키 메모리 보관.
- 이후 실행. `POST /vault/unlock` 으로 같은 절차 → verifyToken 복호화 성공 시 unlock 상태.
- 자동 잠금. idle N 분 후 키 폐기 → 이후 vault API 는 401 VAULT_LOCKED.

**포함 범위**

- 단일 사용자·단일 마스터
- 잘못된 마스터 5회 연속 시 60초 backoff
- unlock 응답에 fixed 200ms 지연으로 타이밍 누설 차단

**제외 범위**

- 마스터 변경(re-key) UI. 다음 단계로 미룬다. KDF migration 로직만 P0 에 준비.
- 다중 사용자

### 카테고리별 자격증명 CRUD

5종 카테고리(BANK, CARD, SECURITIES, SHOPPING, OTHER)에 자격증명을 등록·조회·수정·삭제한다.

**동작 방식**

- 사용자가 카테고리를 선택하면 카테고리별 폼이 표시된다.
- 저장 시 서버가 DTO 를 검증하고 AES-256-GCM 으로 암호화해 VaultEntry 행으로 저장한다.
- 조회 시 세션 키로 복호화해 평문 필드를 반환한다.
- 라벨 검색은 평문 컬럼(label)에 부분 일치한다.

**포함 범위**

- BANK. 은행명·계좌번호·로그인 ID·비밀번호·OTP 시드 등.
- CARD. 카드사·카드번호·유효기간·CVC·카드 비밀번호.
- SECURITIES. 증권사·계좌번호·로그인·OTP·공인인증서 비밀번호.
- SHOPPING. 사이트명·URL·로그인.
- OTHER. 라벨 + 사용자 정의 key-value(최대 10쌍).
- 민감 필드는 클립보드 복사 버튼(30초 자동 클리어)을 노출.

**제외 범위**

- 브라우저 자동입력·모바일·PWA
- 사용자 정의 카테고리 추가. 현재는 enum 닫힘 + OTHER.

### 암호화 export / import

마스터 패스워드 분실·재키 마이그레이션·기기 이동에 대비해 백업과 복원을 제공한다.

**동작 방식**

- export. 모든 VaultEntry 를 자체 컨테이너 포맷(magic "LIFEKEY-VAULT-EXPORT" + version + KDF params + AEAD blob)으로 직렬화해 다운로드.
- import. 컨테이너 검증 → 같은 카테고리·라벨 entry 가 존재하면 기본 409. `?mode=replace` 옵트인 시 덮어쓰기.
- KDF 버전이 다르면 import 시 자동 재암호화.

**포함 범위**

- export 컨테이너는 vault master 로 보호
- import 손상 시 400 IMPORT_CORRUPT 반환

**제외 범위**

- 자동 백업 스케줄
- 클라우드 동기화. setup 직후 1회 백업 안내(README + UI 1차 CTA)만 제공.

### 잠금 상태와 보안 헤더

vault API 는 unlock 상태일 때만 접근 가능하다. 모든 write 요청은 CSRF 정책을 통과해야 한다.

**동작 방식**

- 모든 보호 엔드포인트는 NestJS 가드가 세션 키 보유 여부 확인 → 없으면 401 VAULT_LOCKED.
- CSRF 정책. 세션 쿠키 SameSite=Strict + Origin 화이트리스트(127.0.0.1:3000, localhost:3000) + 커스텀 헤더 `X-Vault-Request: 1` 요구.
- UI 초기 분기. `GET /vault/status` → `{ state: "setup-required" | "locked" | "unlocked", idleSecondsRemaining? }`.

**포함 범위**

- 모든 vault API 의 에러 응답을 `{ code, message }` 형태로 통일

**제외 범위**

- TLS 강제. 127.0.0.1 한정이므로 HTTPS 강제하지 않음. 외부 노출 시 별도 검토.

## 입출력

**입력**

- 마스터 패스워드. min 8, max 256, NFKC 정규화, 양끝 trim.
- 카테고리별 폼 필드. JSON DTO.
- import 파일. export 컨테이너 바이너리.
- 검색 쿼리. label 부분 일치 문자열.

**출력**

- vault 항목 평문 JSON. unlock 상태일 때.
- export 컨테이너 파일
- `/vault/status` 상태 객체
- 표준 에러. `{ code, message }`.

## 제약 조건

- 단일 사용자·로컬 1대 사용 가정
- 바인딩. apps/api 는 127.0.0.1:4000, apps/web 은 127.0.0.1:3000.
- 저장소. 기존 SQLite(`apps/api/data/life-key.db`) 의 새 테이블.
- 스택. NestJS 10 + Prisma 5 + Next.js 15 + React 19.
- argon2 native 빌드가 가능한 환경 필요

## 예외 케이스

- 잘못된 마스터 → 401 MASTER_INVALID
- 잠금 상태에서 보호 엔드포인트 호출 → 401 VAULT_LOCKED
- 이미 VaultMaster 가 있는데 setup 재호출 → 409 SETUP_EXISTS
- CSRF 토큰 누락 또는 Origin 거부 → 403 CSRF_INVALID
- 5회 연속 unlock 실패 후 추가 시도 → 429 RATE_LIMITED (60초 잠금)
- lock 처리 중 inflight 요청 → 423 VAULT_LOCKING
- export 매직/버전 불일치 또는 AEAD 실패 → 400 IMPORT_CORRUPT
- DTO 검증 실패 → 400 VALIDATION_FAILED

## 채택 근거

**핵심 이유**

- 서버측 암호화 + API 세션 키 보관(Approach A)을 택했다. 127.0.0.1 바인딩 로컬 1인용이라 "API 메모리에 키가 존재"하는 단점이 실효 위협이 낮고, recurring-expenses 와 동일한 NestJS/Prisma 패턴을 그대로 재사용해 P0 공수가 가장 작다.

**보조 이유**

- 서버측 인덱스로 검색 복잡도를 프론트에 두지 않는다.
- KDF (Argon2id) + AEAD (AES-256-GCM) 는 업계 표준. 파라미터 버전 번호로 추후 강화 경로 확보.
- 카테고리는 BANK/CARD/SECURITIES/SHOPPING 4종 + 누락 보완용 OTHER → 6개월 lock-in 회피.
- 민감 필드 클립보드 복사 + 30초 자동 클리어를 P0 에 포함해 "적어두고 안 쓰는 vault" 회피.

**기각된 대안**

- 브라우저 E2E 암호화(Approach B). 더 안전하지만 argon2-wasm + WebCrypto AEAD 직접 구현 필요하고 서버측 검색 불가 → P0 공수 큼.
- 클라이언트 전용 IndexedDB(Approach C). 가장 단순하지만 recurring-expenses 와의 도메인 조인이 단절.
- Bitwarden 어댑터 + Life Key 메타만 저장. 두 리뷰어가 추천했으나 도메인 메타 일등 시민이라는 Builder 모드 방향을 유지하기 위해 기각.
- bcrypt/scrypt. Argon2id 의 메모리 하드함 우위에 밀림.
- 평이한 JSON export 포맷. 손상 감지·KDF migration 분기가 어려워 자체 컨테이너로 결정.

## 비기능 요건

**성능**

- unlock 응답. fixed 200ms 지연 포함 500ms 미만.
- CRUD 응답. 로컬 100ms 미만.
- 라벨 검색. 1000건까지 200ms 미만.
- Argon2id 파라미터. m=64MiB (65536 KiB), t=3, p=1, salt 16 bytes.

**보안**

- 위협 모델 보호 범위. 노트북 분실, SQLite 파일 도난.
- 범위 외. OS 계정 탈취, 디스크 이미징(hibernation/swap 포함), 악성 npm 패키지, 브라우저 XSS. macOS FileVault 가 켜져 있다고 가정.
- AEAD 인증 실패 시 평문 0바이트도 노출 금지.
- 타이밍 누설은 fixed delay, brute force 는 5회/60초 backoff 로 차단.
- CSRF 는 SameSite=Strict + Origin 화이트리스트 + 커스텀 헤더 3중.
- GCM nonce 12 bytes, auth tag 16 bytes. 매 암호화마다 신규 난수.

**확장성**

- 단일 사용자 1000건 이하 일상 사용 규모 가정. 그 이상은 재검토.
- KDF 파라미터 버전닝으로 향후 강화 경로 확보.

## 용어 정의

- **마스터 패스워드.** vault 전체를 보호하는 유일한 인증 수단. KDF 입력이며 메모리에만 존재.
- **KDF.** Key Derivation Function. 본 vault 는 Argon2id (m=64MiB, t=3, p=1).
- **AEAD.** Authenticated Encryption with Associated Data. 본 vault 는 AES-256-GCM.
- **Argon2id.** 메모리 하드 KDF. 패스워드를 32바이트 키로 도출.
- **verifyToken.** 마스터 정확성 검증용. 고정 평문(예 "VAULT_VERIFY")의 AEAD 출력.
- **KDF 버전닝.** Argon2id 파라미터 변경 대비. VaultMaster.kdfVersion 컬럼으로 분기.
- **Vault entry.** 카테고리·라벨·암호화된 자격증명 본문·IV·kdfVersion 으로 구성된 1건.
- **Unlock 상태.** 세션 메모리에 도출된 키가 보관된 상태. idle 타임아웃까지 유지.
- **Lock 상태.** 키가 메모리에서 폐기된 상태. 보호 엔드포인트는 401.
- **위협 모델.** 어떤 공격을 막고 어떤 공격은 안 막는지의 명시적 경계.
