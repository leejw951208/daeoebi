# 개발 환경 전용 명령 모음. (운영 배포는 docker-compose.yml 로 별도 관리)
# 개발 구성: DB 는 도커(docker-compose.dev.yml), web·API 는 호스트에서 직접 실행.
# 명명 규칙: 개발 환경 타깃은 dev-, 운영 배포 타깃은 prod- 프리픽스. 검증(lint/typecheck/test/build/clean)은 환경 무관.
.PHONY: help dev-db-down dev-db-reset dev-migrate dev-generate dev-up dev-stop-app dev-down dev-down-reset lint typecheck test build clean prod-up prod-down prod-logs prod-ps prod-backup

# 개발 DB 컨테이너 자격증명도 apps/api/.env.development 를 ${} 치환 출처로 쓴다(운영과 동일 패턴).
DEV_COMPOSE := docker compose -f docker-compose.dev.yml --env-file apps/api/.env.development
# 운영은 apps/api/.env.production 을 env_file 주입 + ${} 치환 출처로 함께 사용한다.
PROD_COMPOSE := docker compose -f docker-compose.yml --env-file apps/api/.env.production

help:
	@echo "개발 환경 명령:"
	@echo "  make dev-up         DB(도커) 기동 + 마이그레이션 후 web·API(로컬) 동시 실행"
	@echo "  make dev-down       web·API(로컬) 종료 + 개발 DB 컨테이너 종료 (데이터 유지)"
	@echo "  make dev-down-reset web·API(로컬) 종료 + 개발 DB 컨테이너 종료 + 데이터 삭제"
	@echo ""
	@echo "  make dev-stop-app   web·API(로컬) 개발 서버만 종료 (DB 유지)"
	@echo "  make dev-db-down    개발 DB 컨테이너 종료 (데이터 유지)"
	@echo "  make dev-db-reset   개발 DB 컨테이너 종료 + 데이터 삭제"
	@echo "  make dev-migrate    Prisma 마이그레이션 적용 (DB 자동 기동)"
	@echo "  make dev-generate   Prisma Client 재생성 (schema 변경 후)"
	@echo ""
	@echo "  make lint           전체 린트"
	@echo "  make typecheck      전체 타입체크"
	@echo "  make test           전체 테스트"
	@echo "  make build          전체 빌드"
	@echo "  make clean          node_modules / 빌드 산출물 제거"
	@echo ""
	@echo "운영 배포 명령 (VPS, docker-compose.yml — DEPLOY.md 참고):"
	@echo "  make prod-up     빌드 + 기동"
	@echo "  make prod-down   종료 (데이터 유지)"
	@echo "  make prod-logs   로그 추적"
	@echo "  make prod-ps     서비스 상태"
	@echo "  make prod-backup DB 즉시 백업 (R2)"

# ── DB (도커) ──────────────────────────────────────────
dev-db-down:
	$(DEV_COMPOSE) down

dev-db-reset:
	$(DEV_COMPOSE) down -v

# ── Prisma ─────────────────────────────────────────────
dev-migrate:
	$(DEV_COMPOSE) up -d --wait
	pnpm --filter @daeoebi/api exec prisma migrate dev

dev-generate:
	pnpm --filter @daeoebi/api exec prisma generate

# ── 앱 (호스트) ────────────────────────────────────────
# DB(도커) 기동 → 마이그레이션 적용 → web·API 병렬 실행을 한 번에 수행한다.
# --wait 로 DB 헬스체크 통과를 기다린 뒤 migrate 한다(연결 거부 방지).
dev-up:
	$(DEV_COMPOSE) up -d --wait
	pnpm --filter @daeoebi/api exec prisma migrate deploy
	pnpm -r --parallel run dev

# ── 종료 ───────────────────────────────────────────────
# 호스트에서 떠 있는 web(:3010)·API(:4010) 개발 서버를 포트 점유 프로세스 기준으로 종료한다.
# 프로세스가 없어도 실패하지 않는다.
dev-stop-app:
	@echo "▶ web·API 개발 서버 종료"
	@pids="$$(lsof -ti tcp:3010 2>/dev/null; lsof -ti tcp:4010 2>/dev/null)"; \
		if [ -n "$$pids" ]; then kill $$pids 2>/dev/null || true; else echo "  (실행 중인 개발 서버 없음)"; fi

# 서비스(web·API) + DB 를 함께 내린다. DB 데이터는 유지한다.
dev-down: dev-stop-app dev-db-down

# 서비스(web·API) + DB 를 함께 내리고 DB 데이터까지 삭제한다.
dev-down-reset: dev-stop-app dev-db-reset

# ── 검증 ───────────────────────────────────────────────
lint:
	pnpm -r run lint

typecheck:
	pnpm -r run typecheck

test:
	pnpm -r run test

build:
	pnpm -r run build

clean:
	rm -rf node_modules apps/*/node_modules apps/*/dist apps/web/.next

# ── 운영 배포 (VPS) ────────────────────────────────────
# docker-compose.yml + apps/api/.env.production + cloudflared/ 가 준비된 상태에서 실행한다(DEPLOY.md).
prod-up:
	$(PROD_COMPOSE) up -d --build

prod-down:
	$(PROD_COMPOSE) down

prod-logs:
	$(PROD_COMPOSE) logs -f

prod-ps:
	$(PROD_COMPOSE) ps

prod-backup:
	./scripts/backup-db.sh
