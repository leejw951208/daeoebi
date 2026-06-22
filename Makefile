.PHONY: help install migrate dev dev-api dev-web build test lint typecheck clean

help:
	@echo "사용 가능한 타깃:"
	@echo "  make install    pnpm 의존성 설치"
	@echo "  make migrate    Prisma 마이그레이션 실행"
	@echo "  make dev        프론트(웹) + 백(API)을 동시에 실행"
	@echo "  make dev-api    API만 실행 (http://127.0.0.1:4000)"
	@echo "  make dev-web    웹만 실행  (http://127.0.0.1:3000)"
	@echo "  make build      전체 빌드"
	@echo "  make test       전체 테스트"
	@echo "  make lint       전체 린트"
	@echo "  make typecheck  전체 타입체크"
	@echo "  make clean      node_modules / 빌드 산출물 제거"

install:
	pnpm install

migrate:
	pnpm --filter @secrets-manager/api exec prisma migrate dev

dev:
	pnpm -r --parallel run dev

dev-api:
	pnpm --filter @secrets-manager/api dev

dev-web:
	pnpm --filter @secrets-manager/web dev

build:
	pnpm -r run build

test:
	pnpm -r run test

lint:
	pnpm -r run lint

typecheck:
	pnpm -r run typecheck

clean:
	rm -rf node_modules apps/*/node_modules apps/*/dist apps/web/.next
