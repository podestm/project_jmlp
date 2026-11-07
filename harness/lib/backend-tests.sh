#!/usr/bin/env bash
# Run the backend test suite against a throwaway MySQL 8 container.
#
# Why a throwaway database: the suite drops and recreates every table in its
# target schema, and the shared test environment holds a copy of production
# data. The tests must never see either. This script gives them their own
# MySQL on a private Docker network, with data in RAM, removed afterwards.
#
# Usage: harness/lib/backend-tests.sh [pytest args...]
#   harness/lib/backend-tests.sh                      # whole suite
#   harness/lib/backend-tests.sh -k timekeeper -x     # subset, stop on first failure
#
# Env: HARNESS_KEEP_DB=1 keeps the database container for faster reruns.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
NET=jmlp-harness
DB=jmlp-harness-testdb
IMAGE=jmlp-harness-backend
# Throwaway credentials: the container is reachable only on the private network.
DB_PASS=harness

log() { printf '[backend-tests] %s\n' "$*" >&2; }

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  log "starting throwaway MySQL ($DB)"
  docker run -d --name "$DB" --network "$NET" \
    --tmpfs /var/lib/mysql:rw,size=512m \
    --memory 512m \
    -e MYSQL_ROOT_PASSWORD="$DB_PASS" \
    mysql:8.0 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
    --innodb-buffer-pool-size=32M --key-buffer-size=16M \
    --performance-schema=OFF --skip-log-bin >/dev/null
  for _ in $(seq 1 60); do
    if docker exec "$DB" mysql -uroot -p"$DB_PASS" -e 'SELECT 1' >/dev/null 2>&1; then break; fi
    sleep 1
  done
  # Same privilege model as real environments: the app user owns only jmlpcz_test*.
  docker exec "$DB" mysql -uroot -p"$DB_PASS" -e "
    CREATE DATABASE IF NOT EXISTS jmlpcz_test CHARACTER SET utf8mb4;
    CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY 'app';
    GRANT ALL PRIVILEGES ON \`jmlpcz_test%\`.* TO 'app'@'%';" 2>/dev/null
fi

# Rebuilds only when requirements.txt changes (Docker layer cache).
log "building test image ($IMAGE)"
docker build -q -t "$IMAGE" "$ROOT/backend" >/dev/null

cleanup() { [ "${HARNESS_KEEP_DB:-0}" = 1 ] || docker rm -f "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# The working tree is mounted, so tests run the code on disk, not the image copy.
docker run --rm --network "$NET" \
  -v "$ROOT/backend/app:/app/app" \
  -e DATABASE_URL="mysql+pymysql://app:app@$DB:3306/jmlpcz_test?charset=utf8mb4" \
  -e SECRET_KEY=harness-test-secret-key-at-least-32-chars \
  "$IMAGE" python -m pytest app/tests -q -p no:cacheprovider --disable-warnings "$@"
