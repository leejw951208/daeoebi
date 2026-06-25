#!/usr/bin/env bash
# 로컬 PC 백업 스크립트. Cloudflare 터널 SSH 로 서버에 붙어 DB 덤프를 끌어와(pull)
# 로컬에 gzip 압축본으로 저장한다. 서버는 인바운드가 없으므로 R2(push) 대신 이 방식을 쓴다.
#
# 사전 준비:  ~/.ssh/config 에 ssh.DOMAIN 의 cloudflared ProxyCommand 설정(DEPLOY.md 4단계)
# 실행:       ./scripts/backup-local.sh
# cron/launchd 자동화 시 Access 토큰 만료에 주의(Service Token 권장).
set -euo pipefail

# 환경변수로 덮어쓸 수 있다(기본값은 운영 구성과 일치).
SSH_HOST="${SSH_HOST:-ssh.leejw.dev}"
SSH_USER="${SSH_USER:-root}"
CONTAINER="${CONTAINER:-daeoebi-postgres}"
POSTGRES_USER="${POSTGRES_USER:-secrets}"
POSTGRES_DB="${POSTGRES_DB:-daeoebi}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/daeoebi-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/daeoebi-${STAMP}.sql.gz"

# 서버에서 pg_dump → gzip 까지 끝낸 결과를 SSH 스트림으로 받아 로컬에 저장한다.
ssh "${SSH_USER}@${SSH_HOST}" \
    "docker exec -i ${CONTAINER} pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} --no-owner --clean --if-exists | gzip -9" \
    > "$FILE"

# 무결성 확인(깨진 덤프면 즉시 실패).
gzip -t "$FILE"

# 보존 정책: RETENTION_DAYS 초과 백업 정리.
find "$BACKUP_DIR" -name 'daeoebi-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "백업 완료: $FILE"
