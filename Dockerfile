# syntax=docker/dockerfile:1
# 멀티 타깃 Dockerfile. build 스테이지에서 워크스페이스 전체를 설치·빌드하고
# api/web 타깃이 각각 런타임 이미지를 만든다. (단일 서버 self-host 전제)
#
# 최적화: 매니페스트(package.json·lockfile)만 먼저 복사해 의존성 설치 레이어를 캐시한다.
# 소스만 바뀐 배포는 pnpm install 을 건너뛰어 빌드가 크게 빨라진다. pnpm store 는 캐시 마운트로 유지.

# ---- 빌드 스테이지: 워크스페이스 전체 설치·빌드 ----
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

# 1) 매니페스트만 먼저 복사 → 소스가 바뀌어도 이 install 레이어는 재사용된다.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 2) 소스 복사 후 빌드 (node_modules 는 .dockerignore 로 제외되어 위 레이어가 유지된다).
COPY . .
# prisma 클라이언트 생성(연결 불필요, 더미 URL 로 충분)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN pnpm --filter @daeoebi/api exec prisma generate
RUN pnpm --filter @daeoebi/api run build
# NEXT_PUBLIC_* 는 빌드 시점에 주입된다. Cloudflare 도메인 확정 후 이 값을 바꿔 재빌드한다.
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN pnpm --filter @daeoebi/web run build

# ---- API 런타임 ----
FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000
# 기동 시 마이그레이션을 적용한 뒤 서버를 띄운다.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]

# ---- WEB 런타임 ----
FROM node:24-bookworm-slim AS web
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
