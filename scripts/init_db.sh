#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${1:-health_records}"
SQL_SOURCE="$(cd "$(dirname "$0")/../infra/db" && pwd)/001_schema.sql"
SQL_TMP="/tmp/001_schema.sql"

if ! sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb "$DB_NAME"
fi

cp "$SQL_SOURCE" "$SQL_TMP"

sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SQL_TMP"

printf '\nTable count in %s:\n' "$DB_NAME"
sudo -u postgres psql -d "$DB_NAME" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
