# Secrets Manager — 비밀번호 금고

사이트별 비밀번호를 `사이트 → (카테고리) → 비밀번호` 구조로 보관하는 1인용 암호화 금고. 마스터 패스워드 한 개로 보호되며 모든 항목은 AES-256-GCM 으로 암호화된다. 제품 정의는 `docs/PRD-secrets-manager.md` 를 참조한다.

## 구조

```
secrets-manager/
├─ apps/
│  ├─ web/   Next.js 15 (App Router) — http://127.0.0.1:3000
│  └─ api/   NestJS 10 + Prisma + SQLite — http://127.0.0.1:4000
├─ docs/PRD-secrets-manager.md   제품 요구사항 정의서
├─ pnpm-workspace.yaml
└─ package.json (워크스페이스 스크립트)
```

## 필수 도구

- Node.js 24
- pnpm 11 (워크스페이스). 저장소 루트의 `mise.toml`에서 자동 설치 가능하다.

## 설치와 초기 셋업

```bash
pnpm install
pnpm --filter @secrets-manager/api exec prisma migrate dev --name init
```

SQLite 파일은 `apps/api/data/secrets-manager.db` 에 생성되며 git ignore된다.

## 개발 서버 실행

두 프로세스를 함께 띄운다.

```bash
pnpm dev
```

개별 실행이 필요하면 다음을 사용한다.

```bash
pnpm --filter @secrets-manager/api dev   # http://127.0.0.1:4000
pnpm --filter @secrets-manager/web dev   # http://127.0.0.1:3000
```

두 프로세스 모두 `127.0.0.1`에만 바인딩되어 외부 인터페이스로는 접속할 수 없다. API의 CORS는 `http://127.0.0.1:3000` 만 허용한다.

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

### 라우트 맵

보관함은 목록 / 신규 / 상세를 별도 라우트로 분리해 모바일 뒤로가기·새로고침·딥링크와 자연스럽게 결합된다.

```
/vault                         보관함 entries 목록 + URL 기반 필터(cat, q)
/vault/new                     vault entry 신규
/vault/[id]                    vault entry 상세 3섹션 + view↔edit + 삭제
/vault/categories              카테고리 정의 reference (read-only)
/vault/backup                  export/import 패널
```

`/vault/*` 는 `apps/web/app/vault/layout.tsx` 의 segment layout 이 잠금 상태와 idle 카운트다운을 공유한다. 잠금 상태에서 어떤 vault 서브라우트로 진입해도 layout 이 `<UnlockScreen />` 으로 fallback 한다.

## 환경 변수

| 위치 | 변수 | 기본값 | 설명 |
|------|------|--------|------|
| `apps/api/.env` | `DATABASE_URL` | `file:./data/secrets-manager.db` | SQLite 파일 경로 |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:4000` | 백엔드 베이스 URL |

## 데이터 백업

SQLite 단일 파일이므로 백업은 파일 복사로 끝난다.

```bash
cp apps/api/data/secrets-manager.db ~/backups/secrets-manager-$(date +%Y%m%d).db
```

DB 파일 권한은 OS 사용자 권한(예. `chmod 600`)으로 두는 것을 권장한다.

## 비밀번호 보관함 (Vault)

은행·카드·증권·쇼핑 자격증명을 한 보관함에서 도메인 메타데이터(계좌번호·카드번호·OTP 등)와 함께 관리한다. 마스터 패스워드 한 개로 보호되며 모든 항목은 AES-256-GCM 으로 암호화되어 SQLite 에 저장된다.

### TTHW 체크리스트 (5분)

1. `pnpm install` 과 `pnpm --filter @secrets-manager/api exec prisma migrate dev` 가 완료되어 있어야 한다.
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

- 인증 가드 자리만 비워둔 `AuthGuard` 는 비 vault 라우트를 무조건 통과시킨다. 127.0.0.1 바인딩 단일 사용자 가정에서만 안전하며, 외부 노출 시 가드 교체가 선행되어야 한다. vault 모듈은 `VaultLockGuard` 로 별도 보호된다.
- 마스터 변경 UI 는 아직 노출되지 않는다. 위 `/vault/rekey` 엔드포인트를 직접 호출한다.
- 다중 사용자·다중 디바이스 동기화는 지원하지 않는다.
