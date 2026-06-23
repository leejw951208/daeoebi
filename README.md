# Secrets Manager — 비밀번호 보관함

사이트별 비밀번호를 `사이트 → (카테고리) → 비밀번호` 구조로 보관하는 1인용 암호화 보관함. passkey(WebAuthn)로 인증하고, WebAuthn PRF로 도출한 키로 모든 항목을 AES-256-GCM 으로 암호화한다. 암호화 키는 서버에 저장하지 않으며 분실 대비 복구코드로 추가 래핑한다. 제품 정의는 `docs/PRD.md` 를 참조한다.

## 구조

```
secrets-manager/
├─ apps/
│  ├─ web/   Next.js 15 (App Router) — http://localhost:3000
│  └─ api/   NestJS 10 + Prisma + PostgreSQL — http://localhost:4000
├─ docs/PRD.md   제품 요구사항 정의서
├─ pnpm-workspace.yaml
└─ package.json (워크스페이스 스크립트)
```

## 필수 도구

- Node.js 24
- pnpm 11 (워크스페이스). 저장소 루트의 `mise.toml`에서 자동 설치 가능하다.

## 설치와 초기 셋업

```bash
pnpm install
docker compose up -d postgres                                  # 로컬 PostgreSQL 기동(127.0.0.1:5431)
cp apps/api/.env.example apps/api/.env.development             # DATABASE_URL 설정
pnpm --filter @secrets-manager/api exec prisma migrate deploy   # 마이그레이션 적용
```

DB는 `docker compose`의 PostgreSQL(`secrets_manager`)을 사용한다. 데이터는 `postgres-data` 볼륨에 저장되며 git에 포함되지 않는다.

## 개발 서버 실행

두 프로세스를 함께 띄운다.

```bash
pnpm dev
```

개별 실행이 필요하면 다음을 사용한다.

```bash
pnpm --filter @secrets-manager/api dev   # http://localhost:4000
pnpm --filter @secrets-manager/web dev   # http://localhost:3000
```

두 프로세스 모두 듀얼스택(`::`)으로 바인딩되어 `localhost` 와 `127.0.0.1` 양쪽으로 접속된다(로컬 개발 기준이라 LAN 인터페이스에도 열린다). API의 CORS는 `http://localhost:3000` 과 `http://127.0.0.1:3000` 을 허용한다.

## 테스트

```bash
pnpm --filter @secrets-manager/api exec jest                          # 단위 테스트
pnpm --filter @secrets-manager/api exec jest --config ./test/jest-e2e.json  # e2e
pnpm --filter @secrets-manager/web exec next build                    # 프런트 타입체크 + 빌드 검증
```

### 시각 회귀 + 접근성

`apps/web/tests/visual/` 의 Playwright spec 으로 3 viewport (375/768/1280) 의 스크린샷 baseline 과 axe-core WCAG AA 검사를 실행한다.

```bash
pnpm --filter @secrets-manager/web exec playwright install            # 최초 1회 — 브라우저 다운로드
pnpm --filter @secrets-manager/web exec next build && pnpm --filter @secrets-manager/web run test:visual:update  # baseline 최초 캡처
pnpm --filter @secrets-manager/web run test:visual                    # 회귀 검증
```

`tests/visual/accessibility.spec.ts` 는 각 페이지에서 WCAG 2.2 AA 위반 0건을 검증한다.

### API 엔드포인트

| 영역 | 엔드포인트 |
|------|-----------|
| passkey 등록·인증 | `POST /auth/register/options`·`/auth/register/verify`, `POST /auth/login/options`·`/auth/login/verify`, `POST /auth/logout`, `GET /auth/status` |
| 복구코드 | `POST /auth/recovery/verify`(복구코드로 잠금해제), 등록 시 1회 발급 |
| 잠금 | `GET /vault/status`, `POST /vault/lock` |
| 사이트 | `GET·POST /sites`, `GET·PATCH·DELETE /sites/:id` |
| 카테고리 | `GET /categories?siteId=`, `POST /categories`, `PATCH·DELETE /categories/:id` |
| 비밀번호 | `GET /secrets?siteId=`, `GET /secrets/:id`(복호화), `POST /secrets`, `PATCH·DELETE /secrets/:id` |
| 검색 | `GET /search?q=` |

`/sites`·`/categories`·`/secrets`·`/search` 는 passkey 인증 가드 + CSRF(Origin + `X-Vault-Request`)로 보호되고, 비밀번호 본문 작업(생성·열람·수정)은 잠금해제(PRF로 도출한 세션 키)가 필요하다.

> 웹 UI(`apps/web`)는 `사이트 → (카테고리) → 비밀번호` 구조로 재구성 예정이며, 현재는 이전 화면이 남아 있어 새 API와 어긋난 상태다.

## 환경 변수

실제 파일은 `NODE_ENV` 별로 분리한다. 개발은 `.env.development`, 운영은 `.env.production`(또는 compose 주입)을 우선 로드한다. **예시는 앱당 단일 `.env.example`** 하나이며, `[개발]`/`[운영]` 주석으로 환경별 값을 구분한다. 이 한 파일을 복사해 환경별 실파일을 만든다.

```bash
cp apps/api/.env.example apps/api/.env.development
cp apps/web/.env.example apps/web/.env.development
```

| 변수 | 개발 기본값 | 설명 |
|------|------------|------|
| `DATABASE_URL` (api) | `postgresql://secrets:secrets@127.0.0.1:5431/...` | PostgreSQL 연결 문자열 |
| `HOST` / `PORT` (api) | `::` / `4000` | API 바인드(듀얼스택). 컨테이너는 `HOST=0.0.0.0` |
| `CORS_ORIGIN` (api) | `http://localhost:3000` | 허용 웹 오리진 |
| `NEXT_PUBLIC_API_BASE_URL` (web) | `http://localhost:4000` | 백엔드 베이스 URL(빌드 시점 주입) |

운영 값은 각 `.env.example` 의 `[운영]` 주석과 `docs/DEPLOY.md` 를 참고한다.

## 데이터 백업

PostgreSQL은 `pg_dump`로 백업한다.

```bash
docker exec secrets-manager-postgres pg_dump -U secrets secrets_manager \
  > ~/backups/secrets-manager-$(date +%Y%m%d).sql
```

복원은 `psql ... < 백업.sql` 로 한다. 운영 시 정기 백업 주기를 확보한다.

## 비밀번호 보관함

사이트별 비밀번호를 `사이트 → (카테고리) → 비밀번호` 구조로 보관한다. 인증은 passkey(생체·기기), 본문 암호화는 WebAuthn PRF로 도출한 키(AES-256-GCM)로 한다. 암호화 키는 서버에 저장하지 않고 메모리에만 두며, 분실 대비로 복구코드가 키를 추가 래핑한다. 모든 항목은 암호화되어 PostgreSQL에 저장된다.

### API 스모크 테스트

passkey 등록·인증(`/auth/*`)은 WebAuthn 의식(challenge·서명·PRF)을 거치므로 브라우저(또는 WebAuthn 가상 인증기)가 필요하다. 단순 `curl`로는 인증을 완결할 수 없어, 인증 흐름은 웹 UI 또는 Playwright 가상 인증기로 검증한다. 잠금해제 이후 데이터 라우트만 쿠키로 확인할 수 있다.

```bash
# 잠금해제 세션 쿠키(/tmp/c.txt)를 확보한 뒤 — 사이트 → 비밀번호 등록 → 열람
SITE=$(curl -s -b /tmp/c.txt -H 'Origin: http://localhost:3000' -H 'X-Vault-Request: 1' \
  -H 'Content-Type: application/json' -d '{"label":"우리은행"}' http://localhost:4000/sites | jq -r .id)
SECRET=$(curl -s -b /tmp/c.txt -H 'Origin: http://localhost:3000' -H 'X-Vault-Request: 1' \
  -H 'Content-Type: application/json' -d "{\"siteId\":\"$SITE\",\"label\":\"로그인\",\"value\":\"pw-1234\"}" http://localhost:4000/secrets | jq -r .id)
curl -s -b /tmp/c.txt http://localhost:4000/secrets/$SECRET   # value 복호화 확인
```

복구코드 5회 연속 실패는 60초 잠금이 발동한다. passkey 인증 자체는 인증기 차원에서 무차별 대입을 막는다.

### Argon2 네이티브 빌드 안내

`argon2` 패키지는 C++ 네이티브 모듈을 빌드한다. 다음 환경이 필요하다.

- macOS. Xcode CLT (`xcode-select --install`).
- Linux. `build-essential`, `python3`.

설치 후 처음 한 번은 `pnpm rebuild argon2` 로 강제 재빌드할 수 있다. 워크스페이스의 `pnpm-workspace.yaml` 의 `allowBuilds.argon2` 가 `true` 로 설정돼야 빌드 스크립트가 실행된다.

### 키 회전(re-key) 절차

데이터 키(DEK)는 본문과 분리돼 있어, 본문을 재암호화하지 않고 **DEK 래핑만 교체**하면 회전이 끝난다. passkey를 새로 등록하거나 복구코드를 재발급할 때, 서버는 PRF·복구코드에서 도출한 키로 DEK를 다시 래핑해 `VaultKey.prfWrappedDek`·`recoveryWrappedDek` 를 갱신한다. 복구코드 KDF 파라미터(Argon2id, m=64MiB, t=3, p=1)는 `VaultKey.keyVersion` 으로 버전 관리한다.

본문 자체의 키를 바꾸는 전체 회전이 필요하면, 단일 트랜잭션 안에서 모든 `Secret` 본문을 새 DEK로 재암호화하고 래핑을 갱신한다.

### 알려진 한계

- 인증 모델을 PIN+마스터에서 passkey/WebAuthn PRF + 복구코드로 전환하기로 했고(`docs/PRD.md`·`DESIGN_BRIEF.md`), **백엔드(`/auth/*`)·웹 UI 구현은 진행 예정**이다. 현재 코드에는 이전 PIN/마스터 구현이 남아 있다.
- 데이터 라우트(`/sites`·`/categories`·`/secrets`·`/search`)는 passkey 인증 가드로 보호하고, 본문 작업은 잠금해제(PRF 세션 키)를 요구한다. 공개 노출 시 Cloudflare Access(앞단)가 1차 방어를 담당한다(`docs/DEPLOY.md`).
- 암호화 export/import(백업·복원)는 새 모델 기준으로 재구현 예정이다.
- 다중 사용자·다중 디바이스 동기화는 지원하지 않는다(단일 사용자는 여러 passkey를 등록할 수 있다).
