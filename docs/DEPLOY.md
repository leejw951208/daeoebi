# 배포 가이드

단일 서버 한 대에 `postgres + api + web`를 올리고, 준비되면 Cloudflare Tunnel·Access를 앞단에 붙인다. 매니지드 서비스는 쓰지 않는다.

## 1. 구성 요소

| 서비스 | 역할 | 포트(내부) |
|--------|------|-----------|
| postgres | 암호화된 비밀번호 저장 | 5432 |
| api | NestJS. 인증·암호화·CRUD | 4000 |
| web | Next.js. UI | 3000 |
| cloudflared | Cloudflare Tunnel (선택, 프로파일) | - |

`docker compose`로 한 묶음으로 관리한다.

## 2. 로컬·서버에서 바로 실행 (Cloudflare 없이)

```bash
docker compose up -d --build
```

- `postgres + api + web`만 뜬다. cloudflared는 `cloudflare` 프로파일이라 제외된다.
- api는 기동 시 `prisma migrate deploy`로 마이그레이션을 적용한 뒤 서버를 띄운다.
- 접속. 웹 `http://localhost:3000`, API `http://localhost:4000`.
- 포트는 `127.0.0.1`에만 publish되어 외부에 노출되지 않는다.

종료·정리.

```bash
docker compose down        # 컨테이너 중지(데이터 보존)
docker compose down -v     # 볼륨(DB)까지 삭제
```

## 3. Cloudflare 추가 (도메인·DNS·Tunnel)

> 아직 Cloudflare 계정·도메인이 없으면 이 절은 나중에 진행한다. 위 2번만으로도 동작한다.

1. Cloudflare에서 도메인을 등록(Registrar)하거나 기존 도메인을 옮긴다.
2. Zero Trust → Networks → **Tunnels**에서 터널을 생성하고 **토큰**을 발급받는다.
3. 터널의 **Public Hostname**을 설정한다.
   - `myvault.example.com` → 서비스 `http://web:3000` (compose 내부 네트워크 이름)
   - 필요 시 API를 별도 호스트네임이나 `/api` 경로로 매핑한다.
4. 토큰을 환경 변수로 주고 cloudflare 프로파일로 띄운다.

```bash
export CLOUDFLARE_TUNNEL_TOKEN="<발급받은 토큰>"
docker compose --profile cloudflare up -d --build
```

5. **도메인 확정 후 web 재빌드.** 브라우저가 호출할 API 주소(`NEXT_PUBLIC_API_BASE_URL`)는 빌드 시점에 박히므로, 공개 도메인으로 다시 빌드한다.
   - `docker-compose.yml`의 `web.build.args.NEXT_PUBLIC_API_BASE_URL`와 `api.environment.CORS_ORIGIN`을 내 도메인으로 바꾼 뒤 `--build`.
6. Tunnel을 쓰면 `api`·`web`의 `ports` publish는 제거하고 내부 네트워크로만 노출한다(공개 표면 축소).

## 4. Cloudflare Access 적용 (필수)

> **Access 설정 누락은 배포 차단 사유다.** 빠지면 6자리 PIN만 남아 공개 보관함이 매우 취약해진다.

1. Zero Trust → Access → **Applications**에서 Self-hosted 앱을 추가하고 도메인을 지정한다.
2. **Policy**를 만든다. 예. 내 이메일만 허용(Emails) + One-time PIN 또는 IdP.
3. 적용 후 도메인 접근 시 Cloudflare Access 인증(1차) → 앱의 6자리 PIN(2차) → 마스터(암호화 해제) 순서로 통과한다.

## 5. 배포 체크리스트

- [ ] `docker compose up -d --build`로 3개 서비스가 healthy.
- [ ] `apps/api/.env.production`(또는 compose env)에 강한 `DATABASE_URL`. 기본 `secrets:secrets`는 운영 전 변경. `apps/api/.env.example` 의 `[운영]` 주석 참고.
- [ ] DB 볼륨 백업 주기 확보(`pg_dump`).
- [ ] Cloudflare Tunnel 연결 확인(공개 도메인 접속).
- [ ] **Cloudflare Access 정책 활성화 확인**(미설정 시 배포 중단).
- [ ] 도메인 확정 후 `NEXT_PUBLIC_API_BASE_URL`·`CORS_ORIGIN`을 내 도메인으로 갱신·재빌드.
- [ ] Tunnel 사용 시 api·web의 호스트 포트 publish 제거.

## 6. 운영 메모

- 마이그레이션은 api 컨테이너 기동 시 자동 적용된다. 수동 적용은 `docker compose run --rm api node_modules/.bin/prisma migrate deploy`.
- 마스터 분실 시 비밀번호 본문은 복구 불가다. setup 직후 백업을 권장한다.
- 단일 사용자 전제다. 다중 사용자는 별도 설계가 필요하다.
