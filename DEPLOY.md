# 배포 가이드 (Vultr + Cloudflare Tunnel)

보안 우선 single-VPS 운영 구성이다. **공개 인바운드 포트 0** — 웹·API·SSH 모두 Cloudflare Tunnel(outbound)로만 들어온다.

```
브라우저 ──TLS──▶ Cloudflare 엣지 ──암호화 터널──▶ cloudflared(호스트 systemd) ──▶ 127.0.0.1 → web / api / ssh
```

- `https://DOMAIN/` → web (Next.js)
- `https://DOMAIN/api/*` → api (NestJS, `API_GLOBAL_PREFIX=api`)
- `ssh://ssh.DOMAIN` → 호스트 SSH(22), Cloudflare Access 게이트

---

## 0. 사전 준비

- Cloudflare 계정 + 구입 도메인(Cloudflare Registrar). DNS 가 Cloudflare 로 위임된 상태.
- Vultr 인스턴스(권장 2GB / High Performance). Docker + docker compose 설치.
- 로컬(또는 서버)에서 `cloudflared` CLI 설치.

> 비용 개요. Vultr 2GB ~$10/월 + 도메인 ~$10.11/년. Tunnel·Zero Trust(SSH Access)·R2 백업은 무료 한도 내.

---

## 1. VPS 기본 보안

```bash
# 방화벽: 아웃바운드만 허용, 인바운드 전부 차단(SSH 포함 — 이후 Tunnel 로 접속).
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

> 주의. SSH Tunnel(3단계)을 먼저 검증한 뒤 인바운드 22 를 닫는다. 검증 전이면 콘솔(Vultr 웹 VNC) 접근 수단을 확보해 둔다.

---

## 2. 코드·환경 배치

```bash
git clone <repo> /opt/daeoebi && cd /opt/daeoebi
cp apps/api/.env.example apps/api/.env.production
# apps/api/.env.production 편집: [운영 환경] 블록만 남기고 주석 풀어 값 채우기
#   - POSTGRES_PASSWORD(openssl rand -base64 24) + DATABASE_URL 의 비밀번호를 동일하게
#   - WEBAUTHN_RP_ID=<도메인>, VAULT_ALLOWED_ORIGINS·CORS_ORIGIN=https://<도메인>
#   - BOOTSTRAP_TOKEN(길고 무작위인 1회용 게이트 토큰)
# 개발·운영 모두 .env.{NODE_ENV} 한 파일을 출처로 쓴다. 운영은 compose 가 env_file 로 주입한다.
```

---

## 3. Cloudflare Tunnel 생성 (cloudflared 는 별도 compose)

cloudflared 는 앱 docker 스택과 **분리된 별도 compose**(`docker-compose.cloudflared.yml`)로 돌린다.
그래야 앱이 죽거나 재배포돼도 터널·SSH 가 끊기지 않는다(라이프라인 분리). 두 스택은 외부 네트워크
`daeoebi-net` 을 공유하므로 cloudflared 가 `web:3000`·`api:4000` 서비스명으로 라우팅한다.

```bash
cloudflared tunnel login                   # 브라우저로 도메인 인가
cloudflared tunnel create daeoebi          # 터널 + ~/.cloudflared/<UUID>.json 생성
cloudflared tunnel route dns daeoebi DOMAIN
cloudflared tunnel route dns daeoebi ssh.DOMAIN
```

자격증명을 프로젝트 `cloudflared/` 로 옮기고 config 를 편집한다(기동은 6단계).

```bash
cp ~/.cloudflared/<UUID>.json /opt/daeoebi/cloudflared/credentials.json
# cloudflared/config.yml 편집: tunnel:<UUID>, example.com→DOMAIN, ssh.example.com→ssh.DOMAIN
```

> `credentials.json` 과 `*.pem` 은 `.gitignore` 추적 제외. 절대 커밋하지 않는다.

---

## 4. SSH 를 Tunnel + Access 로 보호

1. Cloudflare Zero Trust 대시보드 → **Access → Applications → Add** → Self-hosted.
    - Application domain: `ssh.DOMAIN`
    - Policy: 본인 이메일(또는 IdP)만 Allow.
2. 로컬 `~/.ssh/config` 에 추가.

```
Host ssh.DOMAIN
  ProxyCommand cloudflared access ssh --hostname %h
```

3. 접속 검증: `ssh user@ssh.DOMAIN` → 브라우저 인증 후 연결.
4. 검증되면 VPS 인바운드 22 를 닫는다(1단계 ufw 로 이미 차단됨).

---

## 5. Cloudflare 대시보드 보안 설정

- SSL/TLS → **Full (strict)**. (Flexible 금지)
- Edge Certificates → **Always Use HTTPS**, **HSTS** on, **Minimum TLS 1.2**.
- DNS → **DNSSEC** on.
- (선택) WAF 기본 관리 룰셋 on, `/api/auth/*` 에 Rate Limiting 룰.

---

## 6. 기동 (앱 + 터널, 분리된 두 스택)

```bash
docker network create daeoebi-net          # 1회: 두 스택이 공유할 외부 네트워크
echo $GHCR_PAT | docker login ghcr.io -u leejw951208 --password-stdin   # 1회: GHCR 이미지 pull 권한
make prod-deploy                           # 앱 스택: GHCR 이미지 pull + 기동 (postgres·api·web)
make tunnel-up                             # 터널 스택: cloudflared (별도 프로젝트)
make prod-ps                               # 앱 상태
make tunnel-logs                           # 터널 엣지 연결 로그
```

`https://DOMAIN` 접속 → passkey 등록 흐름 확인.

> 앱 재배포는 `git pull && make prod-deploy` — CI 가 빌드한 이미지를 pull 만 하므로 **1코어 VPS 에서도 빌드 부하가 없다**. **터널은 건드리지 않으므로 SSH 유지**. 터널만 재시작은 `make tunnel-restart`.
> 서버에서 직접 빌드해야 할 때(CI 미사용·핫픽스)만 `make prod-up` 폴백을 쓴다.
> 도메인을 바꿔도 web 빌드 인자 `NEXT_PUBLIC_API_BASE_URL=/api` 는 그대로 둔다(상대경로 same-origin).

---

## 7. R2 백업

R2 버킷 생성 후 rclone 을 1회 설정한다.

```bash
rclone config    # remote 이름 r2, type=s3, provider=Cloudflare, endpoint=<account>.r2.cloudflarestorage.com
```

cron 등록(매일 03:00).

```bash
crontab -e
# 0 3 * * * cd /opt/daeoebi && ./scripts/backup-db.sh >> /var/log/sm-backup.log 2>&1
```

복구.

```bash
rclone cat r2:daeoebi-backups/db/<파일>.sql.gz | gunzip \
  | docker exec -i daeoebi-postgres psql -U secrets -d daeoebi
```

---

## CI 빌드 (GitHub Actions → GHCR)

서버(1코어 VPS)에서 빌드하지 않는다. `main` 푸시 시 `.github/workflows/build.yml` 이
GitHub 러너에서 api·web 이미지를 빌드해 GHCR(`ghcr.io/leejw951208/daeoebi-{api,web}`)에 올린다.

- 태그: `latest` + 커밋 SHA. buildx 캐시(type=gha)로 의존성 레이어 재사용.
- 서버는 `make prod-deploy` 로 `latest` 를 pull 만 한다(빌드 0).
- 워크플로 권한은 `GITHUB_TOKEN`(packages: write)으로 충분 — 별도 시크릿 불필요.

서버 1회 준비 — GHCR 이미지를 pull 하려면 로그인이 필요하다(패키지가 private 인 경우).

```bash
# read:packages 스코프의 PAT(classic) 발급 후
echo <GHCR_PAT> | docker login ghcr.io -u leejw951208 --password-stdin
```

> 패키지를 GitHub 에서 public 으로 바꾸면 서버 로그인 없이 pull 된다.

---

## CD 배포 (GitHub Actions → VPS, 터널 SSH)

`main` 푸시로 이미지가 GHCR 에 올라가면, 같은 워크플로(`build.yml`)의 `deploy` 잡이 VPS 에 접속해
`git pull && make prod-deploy` 를 실행한다. api 컨테이너 CMD 가 기동 시 `prisma migrate deploy` 를
돌리므로 **마이그레이션도 자동 적용**된다.

공개 인바운드 0 구성을 깨지 않기 위해, 러너는 **Cloudflare Access 서비스 토큰**으로 터널 SSH
(`ssh.DOMAIN`)에 비대화식 접속한다(브라우저 인증 없음).

### 1회 준비 ① Cloudflare 서비스 토큰 + Access 정책

1. Zero Trust → Access → **Service Auth → Create Service Token**. Client ID / Client Secret 발급(시크릿은 이때만 표시되므로 즉시 보관).
2. SSH 애플리케이션(`ssh.DOMAIN`) 정책에 **Include → Service Token** 규칙을 추가해 위 토큰을 허용한다.
   기존 본인 이메일 정책은 그대로 두면 사람·CI 둘 다 접속 가능하다.

### 1회 준비 ② 배포용 SSH 키

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""                        # 로컬에서 생성
ssh user@ssh.DOMAIN 'cat >> ~/.ssh/authorized_keys' < deploy_key.pub   # 공개키를 서버에 등록
# 개인키(deploy_key 내용)는 아래 SSH_PRIVATE_KEY 시크릿으로 넣고 로컬 파일은 폐기한다.
```

### 1회 준비 ③ GitHub Secrets (Settings → Secrets and variables → Actions)

| 시크릿                    | 값                                    |
| ------------------------- | ------------------------------------- |
| `CF_ACCESS_CLIENT_ID`     | 서비스 토큰 Client ID (`xxxx.access`) |
| `CF_ACCESS_CLIENT_SECRET` | 서비스 토큰 Client Secret             |
| `SSH_PRIVATE_KEY`         | 배포용 개인키 전체(PEM)               |
| `SSH_HOST`                | `ssh.DOMAIN`                          |
| `SSH_USER`                | 서버 배포 사용자명                    |
| `DEPLOY_PATH`             | (선택) 기본 `/opt/daeoebi`            |

### 서버 전제

- `/opt/daeoebi` 가 `main` 을 추적하는 git 클론이고 `git pull` 인증이 설정돼 있어야 한다(기존 수동 배포와 동일).
- `docker network create daeoebi-net`·`docker login ghcr.io`·`apps/api/.env.production` 가 이미 준비된 상태(위 6단계).

### 안전장치

- `deploy` 잡은 GitHub **Environment `production`** 에 묶여 있다. 저장소 설정에서 이 환경에
  **Required reviewers** 를 걸면 배포 직전 수동 승인 게이트가 된다(권장).
- cloudflared 는 서비스 토큰 회귀(cloudflare/cloudflared#1673)를 피해 워크플로에서 버전을 고정한다 — 정상 동작 확인 후 상향 가능.
- 배포는 직전에 빌드된 `:latest` 를 pull 한다. 푸시가 연달아 겹치면 의도와 다른 이미지가 배포될 수 있어 `deploy` 잡을 `concurrency` 로 직렬화한다.

---

## 운영 명령 (Makefile)

```bash
make prod-deploy    # GHCR 이미지 pull + 기동 (권장, 서버 빌드 없음)
make prod-deploy-api  # api 만 pull + 재기동
make prod-deploy-web  # web 만 pull + 재기동
make prod-up        # 서버에서 직접 빌드 + 기동 (폴백)
make prod-down      # 종료(데이터 유지)
make prod-logs      # 로그 추적
make prod-ps        # 상태
make prod-backup    # 즉시 백업
```

---

## 환경 변수 요약

운영 값은 모두 `apps/api/.env.production` 한 파일에 둔다(compose 가 env_file 로 주입).
`NODE_ENV=production` 만 docker-compose 가 정적으로 넣는다.

| 변수                                                  | 설명                                            | 예시                                                         |
| ----------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                                        | 컨테이너 내부 postgres 연결 문자열              | `postgresql://secrets:…@postgres:5432/daeoebi?schema=public` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres 컨테이너 자격증명(`${}` 치환에도 사용) | `secrets` / `openssl rand -base64 24` / `daeoebi`            |
| `HOST` / `PORT`                                       | API 바인딩                                      | `0.0.0.0` / `4000`                                           |
| `API_GLOBAL_PREFIX`                                   | API 경로 프리픽스                               | `api`                                                        |
| `TRUST_PROXY` / `COOKIE_SECURE`                       | 프록시 신뢰 홉 / secure 쿠키 강제               | `1` / `true`                                                 |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME`                 | WebAuthn RP 식별자(도메인) / 표시명             | `vault.example.com` / `대외비`                               |
| `VAULT_ALLOWED_ORIGINS` / `CORS_ORIGIN`               | WebAuthn·CSRF 허용 오리진                       | `https://vault.example.com`                                  |
| `BOOTSTRAP_TOKEN`                                     | 패스키 첫 등록 1회용 게이트 토큰(길고 무작위)   | `openssl rand -hex 24`                                       |
| `RCLONE_REMOTE` / `R2_BUCKET`                         | (선택) R2 백업 대상                             | `r2` / `daeoebi-backups`                                     |
