#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# scripts/bulk-track-only-migrations.sh
# ════════════════════════════════════════════════════════════════════════════════
#
# WHAT THIS SCRIPT DOES
#
#   Registers disk-side SQL migration files (`supabase/migrations/*.sql`) as
#   tracked-rows in the `supabase_migrations.schema_migrations` table WITHOUT
#   executing any DDL. This is a *track-only* operation: it brings the schema-
#   tracking table into agreement with the on-disk migration-files so that
#   `npx supabase db push` reports "0 pending" once everything is reconciled.
#
# IT DOES NOT
#   - Run DDL on tables (no `CREATE`, `ALTER`, `DROP`)
#   - Run `npx supabase db push` (separate operation)
#   - Modify any `.sql` files on disk
#   - Revert anything; strictly additive (only `INSERT ... ON CONFLICT DO
#     NOTHING`)
#
# PK SEMANTICS (per ADR-007)
#
#   `schema_migrations.version` is the single-column PRIMARY KEY. Multiple
#   `.sql` files with the same `YYYYMMDD_` prefix collapse into ONE tracked
#   row, and any second/third file on that date becomes an `ON CONFLICT-Skip`.
#   This is intentional per `docs/decisions/adr-007-schema-migrations-composite-pk.md`
#   § Begründung — Status-Quo belassen, Composite-Key nicht erforderlich.
#
# AUDIT-FIX CONSISTENCY (per ADR-002)
#
#   This script is FORENSIC GROUND-TRUTH, not aspirational-planning. Output
#   never promises forward work, never lies about success, and never claims a
#   result it didn't compute. The transcript-header `_audit_fix:ADR-002_`
#   binds each script-run to its provenance-commit (see `git log` for the
#   audit-fix chain).
#
# DEFAULT BEHAVIOR
#
#   `--dry-run` is the *default* and ONLY `--no-dry-run` enables database
#   writes. This is an inversion of the typical "opt-in to dry-run" pattern
#   deliberately chosen per ADR-002: there is no scenario where you want this
#   script to write to a production schema without an explicit, deliberate
#   flag.
#
# ════════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Output transcript stamp (forensic traceability to audit-fix Commit e30ac29) ───
TRANSCRIPT_STAMP="_audit_fix:ADR-002_"

# ─── Constants ───
MIGRATIONS_DIR="supabase/migrations"
TODAY_PREFIX="20260628"   # YYYYMMDD; used to filter "future-dated" files
CREATED_BY="bulk-track-only-script"  # Provenance-marker; matches existing 25 rows
SCHEMA="supabase_migrations"
TABLE="schema_migrations"
# ADR-007 invariant: schema_migrations.version is the single-column PK.
REQUIRED_PK_COLUMNS="version"
# Validation: only files matching YYYYMMDD_*.sql convention are processed.
DATE_PREFIX_REGEX='^[0-9]{8}$'

# ─── Globals (set by arg-parse) ───
DRY_RUN=true

# ─── Globals (cleaned up at exit) ───
TMP_FILES=()

# Single EXIT-trap registered once; cleans up all temp files we accumulate.
# Bash's trap captures variable VALUES at fire-time, so array-membership is correct.
TMP_FILES=()
trap 'if [[ ${#TMP_FILES[@]} -gt 0 ]]; then rm -f "${TMP_FILES[@]}" 2>/dev/null || true; fi' EXIT

# ─── CLI ───
print_usage() {
  cat <<'USAGE'
Usage: bash scripts/bulk-track-only-migrations.sh [--dry-run | --no-dry-run | --help]

  --dry-run       (default) enumerate candidates only; no DB writes
  --no-dry-run    perform INSERT statements (idempotent; safe to re-run)
  --help          this help

DRY-RUN is the default. Pass --no-dry-run explicitly to actually write.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-dry-run)
      DRY_RUN=false
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown flag: $1" >&2
      print_usage >&2
      exit 2
      ;;
  esac
done

# ─── Logging helpers ───
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
section() { printf '\n═══════ %s ═══════\n' "$*" >&2; }

# ─── Pre-Flight #1: psql binary (exit 1 if missing) ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: psql-binary"
if ! command -v psql >/dev/null 2>&1; then
  log "FATAL: psql not found in PATH"
  exit 1
fi
PSQL_VERSION=$(psql --version 2>&1 | head -1)
log "psql binary: $PSQL_VERSION"

# ─── Pre-Flight #2: DATABASE_URL (exit 1 if missing/invalid) ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: DATABASE_URL"
if [[ -z "${DATABASE_URL:-}" ]]; then
  log "FATAL: DATABASE_URL is unset"
  exit 1
fi
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
  log "FATAL: DATABASE_URL does not start with postgres:// or postgresql://"
  exit 1
fi
# Mask the password before any echo
MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's|://[^:]+:[^@]+@|://user:***@|')
log "DATABASE_URL (masked): $MASKED_URL"
PROJECT_REF=$(echo "$DATABASE_URL" | grep -oE 'postgres\.[a-z0-9]+' | head -1 || true)
log "supabase project-ref: ${PROJECT_REF:-<unable to detect>}"

# ─── Pre-Flight #3: migrations directory (exit 1 if missing) ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: migrations-directory"
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  log "FATAL: $MIGRATIONS_DIR not found (cwd must be repo root)"
  exit 1
fi
TOTAL_SQL=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | wc -l)
log "disk-files total: $TOTAL_SQL"

# ─── Pre-Flight #4: DB connection (exit 1 if unreachable) ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: db-connection"
if ! psql "$DATABASE_URL" -c 'SELECT 1' -A -t -q >/dev/null 2>&1; then
  log "FATAL: cannot connect to database (SELECT 1 failed)"
  exit 1
fi
log "SELECT 1: OK"

# ─── Pre-Flight #5: schema + PK-shape verification
# (Fix #2 from code-review: substring-match was fragile; use information_schema) ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: schema-and-pk"
TABLE_EXISTS=$(psql "$DATABASE_URL" -t -A -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = '$SCHEMA' AND table_name = '$TABLE';
" 2>&1 | head -1 | tr -d ' ')
if [[ "$TABLE_EXISTS" != "1" ]]; then
  log "FATAL: $SCHEMA.$TABLE not present (count=$TABLE_EXISTS)"
  exit 1
fi
PK_COLS=$(psql "$DATABASE_URL" -t -A -c "
SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position)
FROM information_schema.key_column_usage kcu
JOIN information_schema.table_constraints tc
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = '$SCHEMA'
  AND tc.table_name = '$TABLE'
  AND tc.constraint_type = 'PRIMARY KEY';
" 2>&1 | head -1 | tr -d ' ')
log "PK columns (ordered): ${PK_COLS:-<none>}"
if [[ "$PK_COLS" != "$REQUIRED_PK_COLUMNS" ]]; then
  log "FATAL: PK is not ($REQUIRED_PK_COLUMNS). This script relies on ADR-007 status-quo. Found: ${PK_COLS:-<none>}"
  exit 1
fi
log "ADR-007 PK invariant ($REQUIRED_PK_COLUMNS) verified"

# ─── Enumerate future-dated disk files (idempotency-enumeration) ───
section "$TRANSCRIPT_STAMP ENUMERATE: future-dated-files"
FUTURE_FILES_FILE=$(mktemp); TMP_FILES+=("$FUTURE_FILES_FILE")
# List all future-dated files (date-prefix > TODAY_PREFIX)
find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | \
  xargs -n1 basename | \
  awk -v today="$TODAY_PREFIX" -F'_' '$1 > today' | \
  sort > "$FUTURE_FILES_FILE"

CANDIDATE_COUNT=$(wc -l < "$FUTURE_FILES_FILE" | tr -d ' ')
log "candidate-files (date > $TODAY_PREFIX): $CANDIDATE_COUNT"
if [[ "$CANDIDATE_COUNT" -eq 0 ]]; then
  log "No future-dated files to process. Exiting cleanly."
  printf '{"candidate_count": 0, "would_insert": 0, "inserts": 0, "skips": 0, "errors": 0, "skipped_non_date_files": 0, "dry_run": %s}\n' "$DRY_RUN"
  exit 0
fi

# ─── Pull existing DB versions ONCE (idempotency-baseline) ───
section "$TRANSCRIPT_STAMP BASELINE: db-version-snapshot"
DB_VERSIONS_FILE=$(mktemp); TMP_FILES+=("$DB_VERSIONS_FILE")
psql "$DATABASE_URL" -t -A -c "
SELECT DISTINCT version FROM $SCHEMA.$TABLE;
" > "$DB_VERSIONS_FILE" 2>&1 || {
  log "FATAL: failed to read version-snapshot from $SCHEMA.$TABLE"
  exit 1
}
# Strip blank lines (defensive, in case psql emitted warnings into our file)
sed -i '/^$/d' "$DB_VERSIONS_FILE"
DB_VERSION_COUNT=$(wc -l < "$DB_VERSIONS_FILE" | tr -d ' ')
log "db-rows with non-null version: $DB_VERSION_COUNT"

# ─── Classify candidates: INSERT-CANDIDATE vs ON-CONFLICT-SKIP
# (Fix #4 from code-review: validate VERSION matches ^[0-9]{8}$ before classifying) ───
section "$TRANSCRIPT_STAMP CLASSIFY: candidates-vs-existing"
CLASSIFY_FILE=$(mktemp); TMP_FILES+=("$CLASSIFY_FILE")

INSERT_CANDIDATE_FILE_COUNT=0     # files whose VERSION was not in DB
ON_CONFLICT_SKIP_FILE_COUNT=0     # files whose VERSION was already in DB
SKIPPED_NON_DATE_FILE_COUNT=0     # files whose prefix is not YYYYMMDD (Fix #4)
NON_DATE_FILE_LIST=()

# Header
printf '%-50s | %-9s | %-30s | %s\n' "FILE" "VERSION" "NAME" "STATUS" >&2
printf '%-50s-+-%-9s-+-%-30s-+-%s\n' \
  "$(printf '%.0s-' {1..50})" "$(printf '%.0s-' {1..9})" \
  "$(printf '%.0s-' {1..30})" "$(printf '%.0s-' {1..26})" >&2

while IFS= read -r fname; do
  VERSION=$(echo "$fname" | awk -F'_' '{print $1}')

  # Fix #4: validate VERSION is YYYYMMDD-shaped; non-conformant = skip-with-warning.
  if ! [[ "$VERSION" =~ $DATE_PREFIX_REGEX ]]; then
    SKIPPED_NON_DATE_FILE_COUNT=$((SKIPPED_NON_DATE_FILE_COUNT + 1))
    NON_DATE_FILE_LIST+=("$fname")
    display_fname=$(echo "$fname" | LC_ALL=C cut -c1-50)
    printf '%-50s | %-9s | %-30s | %s\n' \
      "$display_fname" "$VERSION" "-" "SKIPPED-NON-DATE-FILENAME" >&2
    continue
  fi

  # short tag = filename minus YYYYMMDD_ prefix and .sql suffix
  NAME_SHORT=$(echo "$fname" | sed -E "s/^${VERSION}_//; s/\.sql$//")

  if grep -qx "$VERSION" "$DB_VERSIONS_FILE"; then
    STATUS="ON-CONFLICT-SKIP"
    ON_CONFLICT_SKIP_FILE_COUNT=$((ON_CONFLICT_SKIP_FILE_COUNT + 1))
  else
    STATUS="INSERT-CANDIDATE"
    INSERT_CANDIDATE_FILE_COUNT=$((INSERT_CANDIDATE_FILE_COUNT + 1))
    echo "$fname|$VERSION|$NAME_SHORT|$STATUS" >> "$CLASSIFY_FILE"
  fi

  display_fname=$(echo "$fname" | LC_ALL=C cut -c1-50)
  display_name=$(echo "$NAME_SHORT" | LC_ALL=C cut -c1-30)
  printf '%-50s | %-9s | %-30s | %s\n' \
    "$display_fname" "$VERSION" "$display_name" "$STATUS" >&2
done < "$FUTURE_FILES_FILE"

# ─── Stats so far ───
section "$TRANSCRIPT_STAMP INTERIM-STATS"
log "candidate-files (disk, future-dated)              : $CANDIDATE_COUNT"
log "INSERT-CANDIDATE-files (version not in DB)       : $INSERT_CANDIDATE_FILE_COUNT"
log "ON-CONFLICT-SKIP-files (version already in DB)    : $ON_CONFLICT_SKIP_FILE_COUNT"
log "SKIPPED-NON-DATE-files (Fix #4)                   : $SKIPPED_NON_DATE_FILE_COUNT"
if [[ ${#NON_DATE_FILE_LIST[@]} -gt 0 ]]; then
  log "  (skipped filenames: ${NON_DATE_FILE_LIST[*]})"
fi

# Fix #1 (Stat-Bug): dedupe CLASSIFY_FILE by VERSION before build.
# ADR-007 single-column PK means N files sharing the same YYYYMMDD-prefix only ever
# produce ONE inserted row; the other N-1 INSERTs are silent ON CONFLICT skims that
# the user previously could not distinguish in the stats. Count distinct versions.
DEDUPED_FILE=$(mktemp); TMP_FILES+=("$DEDUPED_FILE")
# CLASSIFY_FILE:  fname|VERSION|NAME_SHORT|STATUS ; key on col 2 (VERSION), keep first row per version
sort -t'|' -k2,2 -u "$CLASSIFY_FILE" > "$DEDUPED_FILE"
mv "$DEDUPED_FILE" "$CLASSIFY_FILE"
DISTINCT_MISSING_VER_COUNT=$(wc -l < "$CLASSIFY_FILE" | tr -d ' ')
log "distinct-versions-missing (Fix #1 dedupe)         : $DISTINCT_MISSING_VER_COUNT"

# ─── Build batch SQL (only if there are version-candidates) ───
BATCH_FILE=$(mktemp); TMP_FILES+=("$BATCH_FILE")

if [[ "$DISTINCT_MISSING_VER_COUNT" -gt 0 ]]; then
  echo "BEGIN;" > "$BATCH_FILE"
  echo "-- bulk-track-only-migrations batch (audit-fix: e30ac29)" >> "$BATCH_FILE"
  echo "-- distinct-versions: $DISTINCT_MISSING_VER_COUNT" >> "$BATCH_FILE"

  while IFS='|' read -r fname version name_short status; do
    # Filename-derived version/name_slug are under repo-convention control
    # (slug = letters/digits/_) and additionally validated by Fix #4 (version).
    # Defensive escape for single-quotes (none expected, paranoid layer only).
    safe_version=$(echo "$version"  | sed "s/'/''/g")
    safe_name=$(echo "$name_short" | sed "s/'/''/g")
    cat >> "$BATCH_FILE" <<SQLENTRY
INSERT INTO $SCHEMA.$TABLE (version, name, statements, created_by)
VALUES ('$safe_version', '$safe_name', ARRAY['-- bulk-tracked; not executed via bulk-track-script']::text[], '$CREATED_BY')
ON CONFLICT (version) DO NOTHING;
SQLENTRY
  done < "$CLASSIFY_FILE"

  echo "COMMIT;" >> "$BATCH_FILE"
fi

# ─── Execute (or simulate) ───
LANDING_ROW_COUNT=0
ERROR_COUNT=0

if [[ "$DISTINCT_MISSING_VER_COUNT" -gt 0 ]]; then
  section "$TRANSCRIPT_STAMP EXECUTE: mode"
  if [[ "$DRY_RUN" == true ]]; then
    log "MODE: --dry-run (default). NOT executing batch."
    log "Batch-SQL would be (omitted from this run; re-run with --no-dry-run to apply):"
    log "  $(wc -l < "$BATCH_FILE") SQL lines prepared (BEGIN + $DISTINCT_MISSING_VER_COUNT INSERTs + COMMIT)"
  else
    log "MODE: --no-dry-run. Executing batch..."
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$BATCH_FILE" >/dev/null 2>&1; then
      # Fix #1: report NEW-ROWS-INSERTED from actual post-execute row-count delta
      POST_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM $SCHEMA.$TABLE;" | head -1 | tr -d ' ')
      log "Post-execute $SCHEMA.$TABLE row-count: $POST_COUNT (was: $DB_VERSION_COUNT)"
      # Defensive numeric-guard (Crash-Risk #1 from code-review v2): if psql returned
      # empty/non-numeric despite execute-success, fall back to baseline to avoid
      # `(( "" - 49 ))` arithmetic-error under `set -e`.
      if ! [[ "$POST_COUNT" =~ ^[0-9]+$ ]]; then
        log "WARN: post-execute SELECT COUNT(*) returned non-numeric ('$POST_COUNT'); falling back to baseline"
        POST_COUNT=$DB_VERSION_COUNT
      fi
      LANDING_ROW_COUNT=$((POST_COUNT - DB_VERSION_COUNT))
      # LANDING_ROW_COUNT can be 0 (other writer added rows in parallel; ON CONFLICT skipped all)
      if [[ "$LANDING_ROW_COUNT" -lt 0 ]]; then
        log "WARN: Post-count < Pre-count ($POST_COUNT < $DB_VERSION_COUNT); concurrent writes? Reporting 0 landing."
        LANDING_ROW_COUNT=0
      fi
      log "Landing-rows (delta = post-count − baseline): $LANDING_ROW_COUNT"
      log "Submission-count (distinct INSERT-stmts attempted): $DISTINCT_MISSING_VER_COUNT"
      log "Errors: 0"
    else
      log "FATAL: batch execution failed (non-zero exit). ON_ERROR_STOP=1 ⇒ ROLLBACK."
      ERROR_COUNT=1
    fi
  fi
else
  log "Zero distinct-version-missing. Nothing to execute."
fi

# ─── Final Stats (ASCII) ───
section "$TRANSCRIPT_STAMP FINAL-STATS"
printf '  candidate-files (disk, future-dated)            : %s\n' "$CANDIDATE_COUNT" >&2
printf '  skipped-non-date-files (Fix #4)                 : %s\n' "$SKIPPED_NON_DATE_FILE_COUNT" >&2
if [[ "$DRY_RUN" == true ]]; then
  printf '  would-submit (distinct INSERT-VERSIONS, Fix #1) : %s (dry-run; no DB-writes)\n' "$DISTINCT_MISSING_VER_COUNT" >&2
  printf '  inserted (landing-rows)                         : 0\n' >&2
else
  printf '  submitted (distinct INSERT-VERSIONS)            : %s\n' "$DISTINCT_MISSING_VER_COUNT" >&2
  printf '  inserted (landing-rows, post-delta Fix #1)       : %s\n' "$LANDING_ROW_COUNT" >&2
fi
printf '  on-conflict-skips (files with version in DB)     : %s\n' "$ON_CONFLICT_SKIP_FILE_COUNT" >&2
printf '  errors                                          : %s\n' "$ERROR_COUNT" >&2

# ─── Final Stats (JSON, last line of stdout) ───
if [[ "$DRY_RUN" == true ]]; then
  printf '{"candidate_count": %s, "skipped_non_date": %s, "would_submit": %s, "inserted": 0, "on_conflict_skips": %s, "errors": %s, "dry_run": true, "transcript_stamp": "%s"}\n' \
    "$CANDIDATE_COUNT" "$SKIPPED_NON_DATE_FILE_COUNT" \
    "$DISTINCT_MISSING_VER_COUNT" "$ON_CONFLICT_SKIP_FILE_COUNT" \
    "$ERROR_COUNT" "$TRANSCRIPT_STAMP"
else
  printf '{"candidate_count": %s, "skipped_non_date": %s, "submitted": %s, "inserted": %s, "on_conflict_skips": %s, "errors": %s, "dry_run": false, "transcript_stamp": "%s"}\n' \
    "$CANDIDATE_COUNT" "$SKIPPED_NON_DATE_FILE_COUNT" \
    "$DISTINCT_MISSING_VER_COUNT" "$LANDING_ROW_COUNT" \
    "$ON_CONFLICT_SKIP_FILE_COUNT" "$ERROR_COUNT" "$TRANSCRIPT_STAMP"
fi

# Exit-status: 0 if no errors, 1 if errors
if [[ "$ERROR_COUNT" -gt 0 ]]; then
  exit 1
fi
exit 0
