#!/usr/bin/env sh
# PostgreSQL 덤프를 gzip 압축해 Cloudflare R2 로 업로드하는 백업 스크립트(호스트에서 실행).
# cron 예시:  0 3 * * *  cd /opt/daeoebi && ./scripts/backup-db.sh >> /var/log/daeoebi-backup.log 2>&1
set -eu

# 스크립트 위치 기준 프로젝트 루트로 이동해 .env 를 읽는다.
cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

: "${POSTGRES_USER:=secrets}"
: "${POSTGRES_DB:=daeoebi}"
: "${RCLONE_REMOTE:=r2}"
: "${R2_BUCKET:?R2_BUCKET 를 .env 에 설정하세요}"

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="daeoebi-${STAMP}.sql.gz"
TMP="$(mktemp -t daeoebi-backup.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

# 컨테이너 안에서 pg_dump 실행 → gzip 압축 → 임시파일.
docker exec -i daeoebi-postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists \
    | gzip -9 > "$TMP"

# R2 업로드(egress 무료). rclone remote 는 사전 설정이 필요하다(DEPLOY.md 참고).
rclone copyto "$TMP" "${RCLONE_REMOTE}:${R2_BUCKET}/db/${FILE}"

# 30일 초과 백업 정리(보존 정책).
rclone delete --min-age 30d "${RCLONE_REMOTE}:${R2_BUCKET}/db/" || true

echo "백업 완료: ${FILE}"
