# Secrets Manager — 비밀번호 보관함

사이트별 비밀번호를 `사이트 → (카테고리) → 비밀번호` 구조로 보관하는 1인용 암호화 보관함. 마스터 패스워드 한 개로 보호되며 모든 항목은 AES-256-GCM 으로 암호화된다. 제품 정의는 `docs/PRD.md` 를 참조한다.

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
| 접속(PIN) | `POST /pin/setup`·`/pin/login`·`/pin/logout`, `GET /pin/status` |
| 마스터 | `GET /vault/status`, `POST /vault/setup`·`/vault/unlock`·`/vault/lock`·`/vault/rekey` |
| 사이트 | `GET·POST /sites`, `GET·PATCH·DELETE /sites/:id` |
| 카테고리 | `GET /categories?siteId=`, `POST /categories`, `PATCH·DELETE /categories/:id` |
| 비밀번호 | `GET /secrets?siteId=`, `GET /secrets/:id`(복호화), `POST /secrets`, `PATCH·DELETE /secrets/:id` |
| 검색 | `GET /search?q=` |

`/sites`·`/categories`·`/secrets`·`/search` 는 PIN 로그인(`PinGuard`) + CSRF(Origin + `X-Vault-Request`)로 보호되고, 비밀번호 본문 작업(생성·열람·수정)은 마스터 해제(세션 키)가 필요하다.

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

사이트별 비밀번호를 `사이트 → (카테고리) → 비밀번호` 구조로 보관한다. 접속은 6자리 PIN, 본문 암호화는 별도 마스터에서 도출한 키(AES-256-GCM)로 한다. PIN과 마스터는 분리되어 PIN이 유출돼도 본문은 마스터 없이 열리지 않는다. 모든 항목은 암호화되어 PostgreSQL에 저장된다.

### API 스모크 테스트

```bash
# 1) PIN 설정(쿠키 저장)
curl -c /tmp/c.txt -H 'Origin: http://localhost:3000' -H 'X-Pin-Request: 1' \
  -H 'Content-Type: application/json' -d '{"pin":"123456"}' http://localhost:4000/pin/setup
# 2) 마스터 설정(보관함 해제)
curl -H 'Origin: http://localhost:3000' -H 'X-Vault-Request: 1' \
  -H 'Content-Type: application/json' -d '{"master":"super-strong-master-12345"}' http://localhost:4000/vault/setup
# 3) 사이트 → 비밀번호 등록 → 열람
SITE=$(curl -s -b /tmp/c.txt -H 'Origin: http://localhost:3000' -H 'X-Vault-Request: 1' \
  -H 'Content-Type: application/json' -d '{"label":"우리은행"}' http://localhost:4000/sites | jq -r .id)
SECRET=$(curl -s -b /tmp/c.txt -H 'Origin: http://localhost:3000' -H 'X-Vault-Request: 1' \
  -H 'Content-Type: application/json' -d "{\"siteId\":\"$SITE\",\"label\":\"로그인\",\"value\":\"pw-1234\"}" http://localhost:4000/secrets | jq -r .id)
curl -s -b /tmp/c.txt http://localhost:4000/secrets/$SECRET   # value 복호화 확인
```

5회 연속 잘못된 PIN/마스터는 60초 잠금이 발동한다.

### Argon2 네이티브 빌드 안내

`argon2` 패키지는 C++ 네이티브 모듈을 빌드한다. 다음 환경이 필요하다.

- macOS. Xcode CLT (`xcode-select --install`).
- Linux. `build-essential`, `python3`.

설치 후 처음 한 번은 `pnpm rebuild argon2` 로 강제 재빌드할 수 있다. 워크스페이스의 `pnpm-workspace.yaml` 의 `allowBuilds.argon2` 가 `true` 로 설정돼야 빌드 스크립트가 실행된다.

### KDF migration 절차

`KDF_V1` 파라미터(Argon2id, m=64MiB, t=3, p=1)는 `VaultMaster.kdfVersion` 컬럼으로 버전 관리된다. 같은 마스터로 파라미터를 강화하거나(`KDF_V2` 도입) 마스터 자체를 바꿀 때는 `POST /vault/rekey` 한 번으로 끝난다.

```jsonc
POST /vault/rekey
{
  "currentMaster": "기존 마스터",
  "newMaster": "새 마스터(선택)",
  "newKdfVersion": 2 // 선택. 생략 시 KDF_V1
}
```

서버는 단일 트랜잭션 안에서 모든 `Secret` 본문을 새 키로 재암호화하고 `VaultMaster` 의 KDF 파라미터·salt·verifyToken 을 갱신한 뒤 새 세션 키를 발행한다. 파라미터 정의 자체는 `apps/api/src/vault/vault.types.ts` 의 `KDF_V1` 옆에 `KDF_V2` 를 추가해 사용한다.

### 알려진 한계

- 데이터 라우트(`/sites`·`/categories`·`/secrets`·`/search`)는 `PinGuard` 로, vault 마스터 라우트는 `VaultLockGuard` 로 보호된다. 전역 `AuthGuard` 는 자리만 비워둔 통과 구현이며, 공개 노출 시 Cloudflare Access(앞단)가 1차 방어를 담당한다(`docs/DEPLOY.md`).
- 마스터 변경 UI 는 아직 노출되지 않는다. 위 `/vault/rekey` 엔드포인트를 직접 호출한다.
- 암호화 export/import(백업·복원)는 새 모델 기준으로 재구현 예정이다.
- 다중 사용자·다중 디바이스 동기화는 지원하지 않는다.
