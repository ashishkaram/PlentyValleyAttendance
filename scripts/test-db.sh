#!/usr/bin/env bash
# Smoke-test the Supabase migrations on a throwaway local Postgres (16+) database.
# Connection uses the standard libpq variables (PGHOST, PGPORT, PGUSER, ...).
# Example: PGHOST=localhost PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=pva_smoke
psql -d postgres -qc "drop database if exists $DB" -c "create database $DB"
trap 'psql -d postgres -qc "drop database if exists $DB"' EXIT
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/smoke_test.sql
