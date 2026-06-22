# AGENTS.md
## 1. 이 프로젝트의 한 줄 설명
Secrets Manager는 로컬 1인 사용자를 위한 정기 지출 관리와 암호화된 비밀번호 보관함 앱이다.

## 2. 건드리지 말 것
- `node_modules/`, `dist/` — 빌드 산출물
- `pnpm-lock.yaml` — 직접 편집 금지, `pnpm install`로만 갱신
- `apps/api/prisma/migrations/` — 기존 파일 수정 대신 새 migration 생성
- `.env.*` — 시크릿

## 3. 자주 쓰는 명령

```bash
pnpm install                                           # 의존성 설치
pnpm dev                                               # 웹 + API 개발 서버
pnpm typecheck                                         # 변경 후 기본 검증
pnpm lint                                              # ESLint
pnpm test                                              # 전체 테스트
pnpm --filter @secrets-manager/api run test:e2e               # API E2E
pnpm --filter @secrets-manager/api exec prisma migrate dev    # DB 마이그레이션
pnpm --filter @secrets-manager/api run prisma:generate        # schema.prisma 변경 후 필수
pnpm --filter @secrets-manager/web run test:visual            # 시각 회귀 + 접근성
```

## 4. 의미 단위로 커밋

- 사용자가 커밋을 요청한 경우에만 커밋한다.
- 하나의 논리적 변경이 완료될 때마다 커밋한다.
- 좋은 예. "auth 미들웨어 추가"
- 나쁜 예. "auth 추가하고 UI도 고치고 버그도 수정" → 이 경우 세 개의 커밋으로 분리한다.
- 서로 무관한 편집을 누적하면 개별 단위로 롤백할 수 없게 된다.
- 커밋을 위한 커밋은 만들지 않는다. 의미 있는 단위가 형성되었을 때만 커밋한다.

## 5. 중요한 도메인 사실

- 정기 지출은 매월, 매주, 매년 반복 지출 등록, 조회, 결제 처리를 다룬다.
- 정기 지출은 다중 통화 환산, 외부 은행 동기화, 복합 반복 규칙을 지원하지 않는다.
- Vault는 마스터 패스워드 하나로 보호되며 항목은 AES-256-GCM으로 암호화된다.
- Vault KDF V1은 Argon2id, 64MiB, iteration 3, parallelism 1이다.
- 잘못된 마스터 입력 5회 후 60초 잠금이 발동한다.
- 마스터 변경 UI는 아직 제공하지 않는다.
