#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${1:-health_records}"
INFRA_DIR="$(cd "$(dirname "$0")/../infra/db" && pwd)"

if ! sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb "$DB_NAME"
fi

for sql_file in $(find "$INFRA_DIR" -maxdepth 1 -name "*.sql" | sort); do
  echo "Applying $(basename "$sql_file") to ${DB_NAME}..."
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$sql_file"
done

printf '\nTable count in %s:\n' "$DB_NAME"
sudo -u postgres psql -d "$DB_NAME" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
