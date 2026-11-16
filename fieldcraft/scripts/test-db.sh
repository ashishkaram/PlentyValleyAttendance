#!/usr/bin/env bash
# Run the migration and the security tests on a throwaway local Postgres (16+).
# Uses the standard libpq variables (PGHOST, PGPORT, PGUSER, ...).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=fieldcraft_test
psql -d postgres -qc "drop database if exists $DB" -c "create database $DB"
trap 'psql -d postgres -qc "drop database if exists $DB"' EXIT
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/security_test.sql
