# Life Key — 정기 지출 관리

로컬 1인용 정기 지출 관리 도구. 카드값, 관리비, 구독료, 월세 등 매월/매주/매년 반복되는 지출을 한 곳에서 등록·조회·결제 처리한다.

## 구조

```
life-key/
├─ apps/
│  ├─ web/   Next.js 15 (App Router) — http://127.0.0.1:3000
│  └─ api/   NestJS 10 + Prisma + SQLite — http://127.0.0.1:4000
├─ docs/features/recurring-expenses/   기능 사양·계획·진행 상태
├─ pnpm-workspace.yaml
└─ package.json (워크스페이스 스크립트)
```

## 필수 도구

- Node.js 24
- pnpm 11 (워크스페이스). 저장소 루트의 `mise.toml`에서 자동 설치 가능하다.

## 설치와 초기 셋업

```bash
pnpm install
pnpm --filter @life-key/api exec prisma migrate dev --name init
```

SQLite 파일은 `apps/api/data/life-key.db` 에 생성되며 git ignore된다.

## 개발 서버 실행

두 프로세스를 함께 띄운다.

```bash
pnpm dev
```

개별 실행이 필요하면 다음을 사용한다.

```bash
pnpm --filter @life-key/api dev   # http://127.0.0.1:4000
pnpm --filter @life-key/web dev   # http://127.0.0.1:3000
```

두 프로세스 모두 `127.0.0.1`에만 바인딩되어 외부 인터페이스로는 접속할 수 없다. API의 CORS는 `http://127.0.0.1:3000` 만 허용한다.

## 테스트

```bash
pnpm --filter @life-key/api exec jest                          # 단위 테스트 (recurrence, expense.service)
pnpm --filter @life-key/api exec jest --config ./test/jest-e2e.json  # e2e
pnpm --filter @life-key/web exec next build                    # 프런트 타입체크 + 빌드 검증
```

### 시각 회귀 + 접근성

`apps/web/tests/visual/` 의 Playwright spec 으로 5개 페이지 × 3 viewport (375/768/1280) 의 스크린샷 baseline 과 axe-core WCAG AA 검사를 실행한다.

```bash
pnpm --filter @life-key/web exec playwright install            # 최초 1회 — 브라우저 다운로드
pnpm --filter @life-key/web exec next build && pnpm --filter @life-key/web run test:visual:update  # baseline 최초 캡처
pnpm --filter @life-key/web run test:visual                    # 회귀 검증
```

`tests/visual/accessibility.spec.ts` 는 5개 페이지에서 WCAG 2.2 AA 위반 0건을 검증한다.

## 환경 변수

| 위치 | 변수 | 기본값 | 설명 |
|------|------|--------|------|
| `apps/api/.env` | `DATABASE_URL` | `file:./data/life-key.db` | SQLite 파일 경로 |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:4000` | 백엔드 베이스 URL |

## 데이터 백업

SQLite 단일 파일이므로 백업은 파일 복사로 끝난다.

```bash
cp apps/api/data/life-key.db ~/backups/life-key-$(date +%Y%m%d).db
```

DB 파일 권한은 OS 사용자 권한(예. `chmod 600`)으로 두는 것을 권장한다.

## 정기 지출 알려진 한계

- 다중 통화 환산 없음. 입력 통화로만 표시한다.
- 격주, 매월 마지막 영업일 같은 복합 규칙은 미지원이다.
- 외부 은행/카드 동기화 없음.

## 비밀번호 보관함 (Vault)

은행·카드·증권·쇼핑 자격증명을 한 보관함에서 도메인 메타데이터(계좌번호·카드번호·OTP 등)와 함께 관리한다. 마스터 패스워드 한 개로 보호되며 모든 항목은 AES-256-GCM 으로 암호화되어 SQLite 에 저장된다.

### TTHW 체크리스트 (5분)

1. `pnpm install` 과 `pnpm --filter @life-key/api exec prisma migrate dev` 가 완료되어 있어야 한다.
2. `pnpm dev` 로 두 프로세스를 띄운다.
3. `http://127.0.0.1:3000/vault` 에 접속한다.
4. "마스터 패스워드 설정" 화면에서 **12자 이상** 의 패스워드를 입력하고 확인란까지 채워 설정한다.
5. 카테고리(예. CARD)를 선택해 한 건 등록 → 목록에서 펼쳐 "복사" 버튼으로 카드번호를 클립보드에 복사한다(30초 후 자동 비움).
6. "잠그기" 버튼으로 잠근 뒤, 다시 마스터로 unlock 한다. 잘못된 마스터를 5회 입력하면 60초 잠금이 발동한다.
7. (선택) `POST /vault/export` 로 백업, `POST /vault/import` 로 복원이 가능하다.

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

서버는 단일 트랜잭션 안에서 모든 `VaultEntry` 를 새 키로 재암호화하고 `VaultMaster` 의 KDF 파라미터·salt·verifyToken 을 갱신한 뒤 새 세션 키를 발행한다. 파라미터 정의 자체는 `apps/api/src/vault/vault.types.ts` 의 `KDF_V1` 옆에 `KDF_V2` 를 추가해 사용한다.

### 알려진 한계

- 인증 가드 자리만 비워둔 `AuthGuard` 는 모든 비 vault 라우트(`/expenses`, `/occurrences`, `/summary`, `/export`)를 무조건 통과시킨다. 127.0.0.1 바인딩 단일 사용자 가정에서만 안전하며, 외부 노출 시 가드 교체가 선행되어야 한다. vault 모듈은 `VaultLockGuard` 로 별도 보호된다.
- 마스터 변경 UI 는 아직 노출되지 않는다. 위 `/vault/rekey` 엔드포인트를 직접 호출한다.
- 다중 사용자·다중 디바이스 동기화는 지원하지 않는다.
