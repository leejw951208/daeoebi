# 개발 환경 전용 명령 모음. (운영 배포는 docker-compose.yml 로 별도 관리)
# 개발 구성: DB 는 도커(docker-compose.dev.yml), web·API 는 호스트에서 직접 실행.
.PHONY: help db-down db-reset migrate generate dev lint typecheck test build clean

DEV_COMPOSE := docker compose -f docker-compose.dev.yml

help:
	@echo "개발 환경 명령:"
	@echo "  make dev        DB(도커) 기동 + 마이그레이션 후 web·API(로컬) 동시 실행"
	@echo ""
	@echo "  make db-down    개발 DB 컨테이너 종료 (데이터 유지)"
	@echo "  make db-reset   개발 DB 컨테이너 종료 + 데이터 삭제"
	@echo "  make migrate    Prisma 마이그레이션 적용 (DB 자동 기동)"
	@echo "  make generate   Prisma Client 재생성 (schema 변경 후)"
	@echo ""
	@echo "  make lint       전체 린트"
	@echo "  make typecheck  전체 타입체크"
	@echo "  make test       전체 테스트"
	@echo "  make build      전체 빌드"
	@echo "  make clean      node_modules / 빌드 산출물 제거"

# ── DB (도커) ──────────────────────────────────────────
db-down:
	$(DEV_COMPOSE) down

db-reset:
	$(DEV_COMPOSE) down -v

# ── Prisma ─────────────────────────────────────────────
migrate:
	$(DEV_COMPOSE) up -d --wait
	pnpm --filter @secrets-manager/api exec prisma migrate dev

generate:
	pnpm --filter @secrets-manager/api exec prisma generate

# ── 앱 (호스트) ────────────────────────────────────────
# DB(도커) 기동 → 마이그레이션 적용 → web·API 병렬 실행을 한 번에 수행한다.
# --wait 로 DB 헬스체크 통과를 기다린 뒤 migrate 한다(연결 거부 방지).
dev:
	$(DEV_COMPOSE) up -d --wait
	pnpm --filter @secrets-manager/api exec prisma migrate deploy
	pnpm -r --parallel run dev

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
