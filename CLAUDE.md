# CLAUDE.md

## 1. 프로젝트 한 줄 설명
대외비는 사용자의 개인 비밀번호를 관리하는 서비스이다.

## 2. 건드리지 말 것
- `node_modules/`, `dist/` — 빌드 산출물
- `pnpm-lock.yaml` — 직접 편집 금지, `pnpm install`로만 갱신
- `apps/api/prisma/migrations/` — 기존 파일 수정 대신 새 migration 생성
- `.env.*` — 시크릿

## 3. 금지 명령어
- `rm` - 파일/폴더 삭제
- `*install` - 사용자 동의없는 의존 패키지 설치

## 4. 브랜치 전략
- **main 브랜치 머지는 사용자가 직접 진행**
- develop 브랜치를 기준으로 feat, fix, chore... 브랜치를 생성하여 작업
- develop 브랜치에 머지 시 사용자 동의 후 진행

## 5. 의미 단위로 커밋
- 사용자가 커밋을 요청한 경우에만 커밋한다.
- 하나의 논리적 변경이 완료될 때마다 커밋한다.
- 좋은 예. "auth 미들웨어 추가"
- 나쁜 예. "auth 추가하고 UI도 고치고 버그도 수정" → 이 경우 세 개의 커밋으로 분리한다.
- 서로 무관한 편집을 누적하면 개별 단위로 롤백할 수 없게 된다.
- 커밋을 위한 커밋은 만들지 않는다. 의미 있는 단위가 형성되었을 때만 커밋한다.

## 6. 참고 문서
- https://www.typescriptlang.org/docs
- https://docs.nestjs.com
- https://nextjs.org/docs