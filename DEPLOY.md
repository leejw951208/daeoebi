# 배포 가이드 (Vultr + Cloudflare Tunnel)

보안 우선 single-VPS 운영 구성이다. **공개 인바운드 포트 0** — 웹·API·SSH 모두 Cloudflare Tunnel(outbound)로만 들어온다.

```
브라우저 ──TLS──▶ Cloudflare 엣지 ──암호화 터널──▶ cloudflared(VPS) ──▶ web / api / ssh
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

## 3. Cloudflare Tunnel 생성

브라우저가 있는 환경에서 1회 수행한다(서버에서 해도 됨).

```bash
cloudflared tunnel login                       # 브라우저로 도메인 인가
cloudflared tunnel create daeoebi      # 터널 + credentials.json(UUID) 생성
cloudflared tunnel route dns daeoebi DOMAIN
cloudflared tunnel route dns daeoebi ssh.DOMAIN
```

생성된 자격증명을 서버의 `cloudflared/` 로 옮긴다.

```bash
cp ~/.cloudflared/<UUID>.json /opt/daeoebi/cloudflared/credentials.json
```

`cloudflared/config.yml` 을 편집한다.

- `tunnel:` → 위 `<UUID>` (또는 `daeoebi`)
- `example.com` → 실제 `DOMAIN`, `ssh.example.com` → `ssh.DOMAIN`

> `credentials.json` 과 `*.pem` 은 `.gitignore` 로 추적 제외된다. 절대 커밋하지 않는다.

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

## 6. 기동

```bash
docker compose up -d --build
docker compose ps          # 모든 서비스 healthy 확인
docker compose logs -f cloudflared
```

`https://DOMAIN` 접속 → passkey 등록 흐름 확인.

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

## 운영 명령 (Makefile)

```bash
make prod-up        # 빌드 + 기동
make prod-down      # 종료(데이터 유지)
make prod-logs      # 로그 추적
make prod-ps        # 상태
make prod-backup    # 즉시 백업
```

---

## 환경 변수 요약

운영 값은 모두 `apps/api/.env.production` 한 파일에 둔다(compose 가 env_file 로 주입).
`NODE_ENV=production` 만 docker-compose 가 정적으로 넣는다.

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | 컨테이너 내부 postgres 연결 문자열 | `postgresql://secrets:…@postgres:5432/daeoebi?schema=public` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres 컨테이너 자격증명(`${}` 치환에도 사용) | `secrets` / `openssl rand -base64 24` / `daeoebi` |
| `HOST` / `PORT` | API 바인딩 | `0.0.0.0` / `4000` |
| `API_GLOBAL_PREFIX` | API 경로 프리픽스 | `api` |
| `TRUST_PROXY` / `COOKIE_SECURE` | 프록시 신뢰 홉 / secure 쿠키 강제 | `1` / `true` |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` | WebAuthn RP 식별자(도메인) / 표시명 | `vault.example.com` / `대외비` |
| `VAULT_ALLOWED_ORIGINS` / `CORS_ORIGIN` | WebAuthn·CSRF 허용 오리진 | `https://vault.example.com` |
| `BOOTSTRAP_TOKEN` | 패스키 첫 등록 1회용 게이트 토큰(길고 무작위) | `openssl rand -hex 24` |
| `RCLONE_REMOTE` / `R2_BUCKET` | (선택) R2 백업 대상 | `r2` / `daeoebi-backups` |
