#!/usr/bin/env bash
# =====================================================================
# Database Validation & Schema Consistency Test Runner
# =====================================================================
# Tests:
#   1. Current database schema against test_schema.sql
#   2. Fresh database creation from 001_schema.sql + 002_runtime_alignment.sql
#   3. Migration execution and schema consistency from baseline 001_schema.sql
# =====================================================================

set -euo pipefail

DB_NAME="${1:-mediclaim}"
DB_USER="${POSTGRES_USER:-mediclaim}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra/db"

PSQL_CMD=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1)

echo "=== 1. Validating active schema on database: ${DB_NAME} ==="
"${PSQL_CMD[@]}" -d "$DB_NAME" -f "$INFRA_DIR/test_schema.sql"

echo ""
echo "=== 2. Testing Fresh Database Creation ==="
TEST_FRESH_DB="test_fresh_validation_${RANDOM}"
"${PSQL_CMD[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_FRESH_DB};" || true
"${PSQL_CMD[@]}" -d postgres -c "CREATE DATABASE ${TEST_FRESH_DB};"

echo "Applying 001_schema.sql..."
"${PSQL_CMD[@]}" -d "$TEST_FRESH_DB" -f "$INFRA_DIR/001_schema.sql"
echo "Applying 002_runtime_alignment.sql..."
"${PSQL_CMD[@]}" -d "$TEST_FRESH_DB" -f "$INFRA_DIR/002_runtime_alignment.sql"

echo "Running schema tests on fresh database..."
"${PSQL_CMD[@]}" -d "$TEST_FRESH_DB" -f "$INFRA_DIR/test_schema.sql"

echo ""
echo "=== 3. Testing Migration Execution and Schema Consistency ==="
TEST_MIGRATED_DB="test_migrated_validation_${RANDOM}"
"${PSQL_CMD[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_MIGRATED_DB};" || true
"${PSQL_CMD[@]}" -d postgres -c "CREATE DATABASE ${TEST_MIGRATED_DB};"

# Extract baseline schema without runtime extensions
git -C "$REPO_ROOT" show HEAD~2:infra/db/001_schema.sql > "/tmp/baseline_001.sql" 2>/dev/null || \
  git -C "$REPO_ROOT" show HEAD~1:infra/db/001_schema.sql > "/tmp/baseline_001.sql" 2>/dev/null || \
  cp "$INFRA_DIR/001_schema.sql" "/tmp/baseline_001.sql"

echo "Applying baseline schema..."
"${PSQL_CMD[@]}" -d "$TEST_MIGRATED_DB" -f "/tmp/baseline_001.sql"

echo "Applying migration 002_runtime_alignment.sql..."
"${PSQL_CMD[@]}" -d "$TEST_MIGRATED_DB" -f "$INFRA_DIR/002_runtime_alignment.sql"

echo "Re-applying 002_runtime_alignment.sql to verify idempotency..."
"${PSQL_CMD[@]}" -d "$TEST_MIGRATED_DB" -f "$INFRA_DIR/002_runtime_alignment.sql"

echo "Running schema tests on migrated database..."
"${PSQL_CMD[@]}" -d "$TEST_MIGRATED_DB" -f "$INFRA_DIR/test_schema.sql"

echo ""
echo "Comparing table count between fresh and migrated databases:"
FRESH_COUNT=$("${PSQL_CMD[@]}" -d "$TEST_FRESH_DB" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
MIGRATED_COUNT=$("${PSQL_CMD[@]}" -d "$TEST_MIGRATED_DB" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "  Fresh database table count:    $FRESH_COUNT"
echo "  Migrated database table count: $MIGRATED_COUNT"

if [ "$FRESH_COUNT" -ne "$MIGRATED_COUNT" ]; then
    echo "ERROR: Table count mismatch between fresh ($FRESH_COUNT) and migrated ($MIGRATED_COUNT)!"
    exit 1
fi

echo "Cleaning up temporary test databases..."
"${PSQL_CMD[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_FRESH_DB};"
"${PSQL_CMD[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_MIGRATED_DB};"
rm -f "/tmp/baseline_001.sql"

echo ""
echo "============================================================"
echo "SUCCESS: All database tests & validation routines completed!"
echo "============================================================"
