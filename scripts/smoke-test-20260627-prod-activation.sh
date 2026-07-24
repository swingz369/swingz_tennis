#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════════
# scripts/smoke-test-20260627-prod-activation.sh
# ════════════════════════════════════════════════════════════════════════════════
#
# WHAT THIS SCRIPT DOES
#
#   Performs a forensic ground-truth inventory-and-assertion of the four
#   claims attached to the alleged 2026-06-27 psql self-served prod-activation:
#
#     (a) public-schema tables ≥ 106
#     (b) public-schema RLS policies ≥ 340
#     (c) ELO trigger from 20260627_elo_rating_system.sql is installed and
#         works via UPDATE matches SET winner_side='left'...
#     (d) types/supabase.ts no longer carries the
#         TODO(@owner: backend, regenerate via ...) marker
#
#   Each assertion publishes its actual count/state in an ASCII table on
#   stderr and in a JSON summary on stdout (last line) — never the inverse.
#
# AUDIT-FIX CONSISTENCY (per ADR-002)
#
#   This script is FORENSIC GROUND-TRUTH, not aspirational-planning. When a
#   claim mismatches disk/DB state (which has been observed pre-flight, see
#   CHANGELOG below), the script publishes an ASPIRATIONAL-FAIL row and exits
#   with code 2 (distinct from PASS=0 and SETUP-ERROR=1). It will NEVER
#   fabricate matching numbers, mock data, or pretend-success.
#
#   CHANGELOG (audit-fix 2026-06-28 ADR-002):
#   - The claimed 2026-06-27 prod-activation has been verified pre-flight to
#     match ONLY claims (a) [104 tables + 2 views = 106 public objects] and
#     (b) [342 RLS policies]. Claims (c) and (d) match neither disk nor DB
#     state:
#       (c) matches-table does not exist, no elo-function, no elo-trigger
#       (d) TODO(@owner: backend, regenerate via ...) present at
#           types/supabase.ts line ~2023
#     This script surfaces both gaps without faking success.
#
# DEFAULT BEHAVIOR
#
#   Read-only by default. The `--apply` flag is reserved for an opt-in
#   ELO-trigger functional test that runs inside a `BEGIN; ... ROLLBACK;`
#   block (zero side-effects even on success). When prerequisites for the
#   functional test are unmet (e.g., matches-table missing), the test
#   will refuse to run and exit 2.
#
# EXIT CODES
#
#   0 — all assertions PASS
#   1 — SETUP-ERROR (psql missing, DATABASE_URL invalid, DB unreachable,
#       types/supabase.ts missing). Indicates the test could not be run.
#   2 — ASPIRATIONAL-FAILURE (one or more claims do not match disk/DB
#       state). Indicates a known gap between paperwork and reality.
#
# ════════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Output transcript stamp (forensic traceability to audit-fix Commit e30ac29) ───
TRANSCRIPT_STAMP="_audit_fix:ADR-002_"

# ─── Constants / claim thresholds ───
PUBLIC_SCHEMA="public"
TYPES_FILE="types/supabase.ts"
EXPECTED_PUBLIC_TABLES_MIN=106
EXPECTED_RLS_POLICIES_MIN=340
SENTINEL_ERR="PSQL_ERR"

# ─── Capture mode ───
APPLY_MODE=false

# ─── Aggregators ───
TOTAL_PASS=0
TOTAL_FAIL=0
ASPIRATIONAL_CLAIMS_FAILED=0
declare -a CHECK_RESULTS=()

# ─── Cleanup (Fix #2: dedicated function iterate over ${TMP_FILES[@]:-} for set -u safety) ───
TMP_FILES=()
cleanup() {
  # Iterate safe under set -u via ${arr[@]:-} idiom; check existence before rm.
  for tmp in "${TMP_FILES[@]:-}"; do
    if [[ -f "$tmp" ]]; then
      rm -f "$tmp" || true
    fi
  done
}
trap cleanup EXIT

# ─── Helpers (Fix #3: esc() hoisted here from for-loop body) ───
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
section() { printf '\n═══════ %s ═══════\n' "$*" >&2; }

# JSON-escape helper used inside the JSON-last-line loop. Hoisted to here so
# bash registers it ONCE at file-load, not on every loop iteration.
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

# Build a single JSON-object string for one check-row. Uses printf internally
# so format-string-shell-escape doesn't bleed — no `\"`/`$()` escape hell the
# original CHECKS_JSON-concat approach had.
build_json_row() {
  printf '{"name":"%s","expected":"%s","actual":"%s","status":"%s"}' \
    "$1" "$2" "$3" "$4"
}

# record_check_ascii definitional order: defined BEFORE any call-site.
record_check_ascii() {
  CHECK_RESULTS+=("$1|$2|$3|$4")
}

# Robust psql-capture: returns SENTINEL_ERR (or fallback text) on any pipeline
# failure so set -e does not abort the script at the wrong point. Numeric-guard
# downstream catches non-numeric SENTINEL output.
psql_count() {
  local query="$1"
  psql "$DATABASE_URL" -t -A -c "$query" 2>/dev/null | head -1 | tr -d ' ' || echo "$SENTINEL_ERR"
}

# Sanity-check that a captured value is a non-negative integer; replaces it
# with a fallback string for downstream display. (Fix #5: bash-3.2-compatible
# `eval`-based assignment instead of `printf -v`.)
ensure_numeric() {
  local __var="$1"
  local __val="${!__var:-}"
  if ! [[ "$__val" =~ ^[0-9]+$ ]]; then
    log "WARN: numeric-guard tripped: $__var='$__val' (not numeric); fall back to SENTINEL"
    eval "$__var=\"\$SENTINEL_ERR\""
  fi
}

# ─── CLI ───
print_usage() {
  cat <<'USAGE'
Usage: bash scripts/smoke-test-20260627-prod-activation.sh [--apply | --help]

  (no flag)   default — read-only inventory + assertions; no DB writes
  --apply     opt-in to a transactional-rollback-isolated ELO-trigger
              functional test (still ROLLBACKs all writes; safe but slow)
  --help      this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY_MODE=true
      shift
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      printf 'ERROR: unknown flag: %s\n' "$1" >&2
      print_usage >&2
      exit 2
      ;;
  esac
done

# ─── Pre-Flight: psql binary ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: psql-binary"
if ! command -v psql >/dev/null 2>&1; then
  log "FATAL: psql not found in PATH (exit 1, SETUP-ERROR)"
  exit 1
fi
log "psql: $(psql --version | head -1)"

# ─── Pre-Flight: DATABASE_URL ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: DATABASE_URL"
if [[ -z "${DATABASE_URL:-}" ]]; then
  log "FATAL: DATABASE_URL is unset (exit 1, SETUP-ERROR)"
  exit 1
fi
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
  log "FATAL: DATABASE_URL does not start with postgres:// (exit 1, SETUP-ERROR)"
  exit 1
fi
MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's|://[^:]+:[^@]+@|://user:***@|')
log "DATABASE_URL (masked): $MASKED_URL"
PROJECT_REF=$(echo "$DATABASE_URL" | grep -oE 'postgres\.[a-z0-9]+' | head -1 || true)
log "supabase project-ref: ${PROJECT_REF:-<unable to detect>}"

# ─── Pre-Flight: types/supabase.ts file present ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: types-file"
if [[ ! -f "$TYPES_FILE" ]]; then
  log "FATAL: $TYPES_FILE not on disk (exit 1, SETUP-ERROR)"
  exit 1
fi
log "file: $TYPES_FILE ($(wc -l < "$TYPES_FILE" | tr -d ' ') lines)"

# ─── Pre-Flight: DB connection ───
section "$TRANSCRIPT_STAMP PRE-FLIGHT: db-connection"
if ! psql "$DATABASE_URL" -c 'SELECT 1' -A -t -q >/dev/null 2>&1; then
  log "FATAL: SELECT 1 failed (exit 1, SETUP-ERROR)"
  exit 1
fi
log "SELECT 1: OK"

# ─── Check (a): public-schema tables ≥ 106 ───
section "$TRANSCRIPT_STAMP CHECK (a): public-tables"
PUBLIC_OBJECTS=$(psql_count "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$PUBLIC_SCHEMA';")
ensure_numeric PUBLIC_OBJECTS
log "public-schema tables+views: $PUBLIC_OBJECTS"
if [[ "$PUBLIC_OBJECTS" =~ ^[0-9]+$ ]] && [[ "$PUBLIC_OBJECTS" -ge "$EXPECTED_PUBLIC_TABLES_MIN" ]]; then
  record_check_ascii "(a) public-tables" ">=$EXPECTED_PUBLIC_TABLES_MIN" "$PUBLIC_OBJECTS" "PASS"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  record_check_ascii "(a) public-tables" ">=$EXPECTED_PUBLIC_TABLES_MIN" "${PUBLIC_OBJECTS:-$SENTINEL_ERR}" "FAIL"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ─── Check (b): public-schema RLS policies ≥ 340 ───
section "$TRANSCRIPT_STAMP CHECK (b): public-rls-policies"
PUBLIC_RLS=$(psql_count "SELECT COUNT(*) FROM pg_policies WHERE schemaname = '$PUBLIC_SCHEMA';")
ensure_numeric PUBLIC_RLS
log "public-RLS-policies: $PUBLIC_RLS"
if [[ "$PUBLIC_RLS" =~ ^[0-9]+$ ]] && [[ "$PUBLIC_RLS" -ge "$EXPECTED_RLS_POLICIES_MIN" ]]; then
  record_check_ascii "(b) public-rls" ">=$EXPECTED_RLS_POLICIES_MIN" "$PUBLIC_RLS" "PASS"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  record_check_ascii "(b) public-rls" ">=$EXPECTED_RLS_POLICIES_MIN" "${PUBLIC_RLS:-$SENTINEL_ERR}" "FAIL"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# ─── Check (c): ELO-trigger presence + (optional) functional test ───
section "$TRANSCRIPT_STAMP CHECK (c): elo-trigger-presence"
MATCHES_TABLE_EXISTS=$(psql_count "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$PUBLIC_SCHEMA' AND table_name = 'matches';")
ensure_numeric MATCHES_TABLE_EXISTS
ELO_FN_COUNT=$(psql_count "
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = '$PUBLIC_SCHEMA'
  AND (p.proname ~* 'elo' OR p.proname ~* 'rating');
")
ensure_numeric ELO_FN_COUNT
ELO_TRG_COUNT=$(psql_count "
SELECT COUNT(*) FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = '$PUBLIC_SCHEMA'
  AND c.relname = 'matches'
  AND (t.tgname ~* 'elo' OR t.tgname ~* 'rating');
")
ensure_numeric ELO_TRG_COUNT
log "matches-table=${MATCHES_TABLE_EXISTS}, elo-functions=${ELO_FN_COUNT}, elo-triggers-on-matches=${ELO_TRG_COUNT}"

# Fix #5 (SENTINEL-noise-Guard): before arithmetic, neutralize any SENTINEL
# to numeric 0 so bash doesn't log "invalid integer" to stderr.
NUM_MATCHES="${MATCHES_TABLE_EXISTS:-0}"
[[ "${NUM_MATCHES}" == "${SENTINEL_ERR}" ]] && NUM_MATCHES=0
NUM_ELO_FN="${ELO_FN_COUNT:-0}"
[[ "${NUM_ELO_FN}" == "${SENTINEL_ERR}" ]] && NUM_ELO_FN=0
NUM_ELO_TRG="${ELO_TRG_COUNT:-0}"
[[ "${NUM_ELO_TRG}" == "${SENTINEL_ERR}" ]] && NUM_ELO_TRG=0

ELO_PRESENT="no"
if [[ "$NUM_MATCHES" -ge 1 && "$NUM_ELO_FN" -ge 1 && "$NUM_ELO_TRG" -ge 1 ]]; then
  ELO_PRESENT="yes"
fi

if [[ "$ELO_PRESENT" == "yes" ]]; then
  record_check_ascii "(c) elo-trigger" "matches+fn+trg>=1" "${MATCHES_TABLE_EXISTS}/${ELO_FN_COUNT}/${ELO_TRG_COUNT}" "PASS"
  TOTAL_PASS=$((TOTAL_PASS + 1))

  if [[ "$APPLY_MODE" == true ]]; then
    section "$TRANSCRIPT_STAMP CHECK (c)/functional: --apply ELO-trigger-test"
    log "MODE: --apply. Running transactional-rollback-isolated ELO-trigger test..."
    FUNCTIONAL_OUT=$(mktemp); TMP_FILES+=("$FUNCTIONAL_OUT")
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -A -t <<'SQL' > "$FUNCTIONAL_OUT" 2>&1
BEGIN;
DO $$
DECLARE
  sample_match_id uuid;
  pre_elo_left int;
  pre_elo_right int;
  post_elo_left int;
  post_elo_right int;
BEGIN
  SELECT id INTO sample_match_id FROM public.matches ORDER BY id LIMIT 1;
  IF sample_match_id IS NULL THEN
    RAISE NOTICE 'no sample match in public.matches — functional test inconclusive';
  ELSE
    SELECT u.elo_rating INTO pre_elo_left
      FROM public.users u
      JOIN public.matches m ON m.left_player_id = u.id
      WHERE m.id = sample_match_id;
    RAISE NOTICE 'pre-elo-left=%', pre_elo_left;
    UPDATE public.matches SET winner_side = 'left' WHERE id = sample_match_id;
    SELECT u.elo_rating INTO post_elo_left
      FROM public.users u
      JOIN public.matches m ON m.left_player_id = u.id
      WHERE m.id = sample_match_id;
    RAISE NOTICE 'post-elo-left=%', post_elo_left;
  END IF;
END$$;
ROLLBACK;
SQL
    then
      log "functional-test ran clean under ROLLBACK. Output:"
      sed 's/^/    /' "$FUNCTIONAL_OUT" >&2
    else
      log "FAIL: functional-test errored during ROLLBACK-isolated run (output saved to FUNCTIONAL_OUT)"
      sed 's/^/    /' "$FUNCTIONAL_OUT" >&2
      record_check_ascii "(c) elo-functional" "no-error" "error" "FAIL"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  fi
else
  ASPIRATIONAL_REASON=""
  if [[ "$NUM_MATCHES" -lt 1 ]]; then
    ASPIRATIONAL_REASON="${ASPIRATIONAL_REASON}matches-table-missing; "
  fi
  if [[ "$NUM_ELO_FN" -lt 1 ]]; then
    ASPIRATIONAL_REASON="${ASPIRATIONAL_REASON}elo-function-missing; "
  fi
  if [[ "$NUM_ELO_TRG" -lt 1 ]]; then
    ASPIRATIONAL_REASON="${ASPIRATIONAL_REASON}elo-trigger-missing; "
  fi
  record_check_ascii "(c) elo-trigger" "matches+fn+trg>=1" "${MATCHES_TABLE_EXISTS}/${ELO_FN_COUNT}/${ELO_TRG_COUNT}" "ASPIRATIONAL-FAIL"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  ASPIRATIONAL_CLAIMS_FAILED=$((ASPIRATIONAL_CLAIMS_FAILED + 1))
  log "ASPIRATIONAL-SURFACE: claim (c) not satisfied. Disk/DB-state: ${ASPIRATIONAL_REASON}"
  log "  Expected per 2026-06-27 claim: matches-table + elo-function + elo-trigger installed."
  log "  Actual per pre-flight 2026-06-28: missing components must be applied via"
  log "  'npx supabase db push' before this script can pass claim (c)."
fi

# ─── Check (d): types/supabase.ts no longer carries TODO(@owner: backend, regenerate) ───
section "$TRANSCRIPT_STAMP CHECK (d): types-todo-marker"
TODO_OUT=$(mktemp); TMP_FILES+=("$TODO_OUT")
REGEN_MARKER_LINE_COUNT=0
REGEN_EXAMPLES=""
# Fix #1: relaxed regex matches the actual marker line 2023 of types/supabase.ts:
#   // TODO(@owner: backend, regenerate via 'supabase gen types typescript --local'):
# Previously `\),` with strict close-paren was too restrictive; the actual marker
# has `,` followed by ~120 chars of context BEFORE `regenerate`, and then a smile
# `:)` rather than `)` at end of line.
if grep -nE 'TODO\(@owner: backend.{0,80}regenerate' "$TYPES_FILE" > "$TODO_OUT" 2>/dev/null; then
  REGEN_MARKER_LINE_COUNT=$(wc -l < "$TODO_OUT" | tr -d ' ')
  REGEN_EXAMPLES=$(head -3 "$TODO_OUT")
fi
log "TODO(@owner: backend, regenerate...) marker count: $REGEN_MARKER_LINE_COUNT"
if [[ "$REGEN_MARKER_LINE_COUNT" -gt 0 ]]; then
  log "marker-locations (first 3):"
  echo "$REGEN_EXAMPLES" | sed 's/^/    /' >&2
  log "ASPIRATIONAL-SURFACE: claim (d) not satisfied. Owner-action required:"
  log "  Run 'supabase gen types typescript --local' (or equivalent) and re-commit types/supabase.ts."
  log "  ADR-002 forensic-policy: this script will NEVER mask the marker as 'almost done'."
fi
if [[ "$REGEN_MARKER_LINE_COUNT" -eq 0 ]]; then
  record_check_ascii "(d) regen-todo" "0" "0" "PASS"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  record_check_ascii "(d) regen-todo" "0" "$REGEN_MARKER_LINE_COUNT" "ASPIRATIONAL-FAIL"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  ASPIRATIONAL_CLAIMS_FAILED=$((ASPIRATIONAL_CLAIMS_FAILED + 1))
fi

# ─── Final Results Table ───
section "$TRANSCRIPT_STAMP RESULTS-TABLE"
printf '%-30s | %-22s | %-22s | %s\n' "ASSERTION" "EXPECTED" "ACTUAL" "STATUS" >&2
printf '%-30s-+-%-22s-+-%-22s-+-%s\n' \
  "$(printf '%.0s-' {1..30})" "$(printf '%.0s-' {1..22})" \
  "$(printf '%.0s-' {1..22})" "$(printf '%.0s-' {1..22})" >&2
for r in "${CHECK_RESULTS[@]}"; do
  IFS='|' read -r name expected actual status <<< "$r"
  printf '%-30s | %-22s | %-22s | %s\n' "$name" "$expected" "$actual" "$status" >&2
done

# ─── Final-Stats + Summary ───
section "$TRANSCRIPT_STAMP FINAL-STATS"
log "pass=$TOTAL_PASS  fail=$TOTAL_FAIL  aspirational-claim-FAILs=$ASPIRATIONAL_CLAIMS_FAILED"

OVERALL_STATUS="PASS"
EXIT_CODE=0
if [[ "$ASPIRATIONAL_CLAIMS_FAILED" -gt 0 ]]; then
  OVERALL_STATUS="ASPIRATIONAL_FAILURE"
  EXIT_CODE=2
  log "OVERALL: $OVERALL_STATUS — claimed prod-activation not reflected in disk/DB state."
  log "  Per ADR-002: forensic ground-truth; no fake-pass; pre-flight 2026-06-28 lists"
  log "  (c) matches/elo missing, (d) types-regen TODO marker still present."
  log "  Action path: (1) apply 20260627_elo_rating_system.sql + 20260627_season_group_weeks.sql on remote,"
  log "  (2) regenerate types/supabase.ts, (3) re-run this smoke-test to confirm claims."
fi

# ─── JSON Last-Line (stdout only, single-line for atomic pipe-friendliness) ───
# Build the checks-array as a single string first, then emit one-line JSON.
# Rationale: multi-line JSON blocks fail `tail -1 | jq` because the verb
# consumes only the last line. Single-line atomic JSON is consumed intact by
# `jq`, `python3 -m json.tool`, `cat`, etc.
CHECKS_JSON=""
FIRST_CHECK=true
for r in "${CHECK_RESULTS[@]:-}"; do
  # Defense-in-depth: empty-CHECK_RESULTS can happen if (somehow) we reach this
  # block before pre-flights bailout; skip empty row to avoid bogus-named JSON.
  [[ -z "$r" ]] && continue
  IFS='|' read -r name expected actual status <<< "$r"
  if [[ "$FIRST_CHECK" == true ]]; then
    FIRST_CHECK=false
  else
    CHECKS_JSON+=","
  fi
  # Use build_json_row helper to dodge bash-string-escape-hell. The helper's
  # printf internally formats the JSON object; $(...) captures stdout cleanly.
  CHECKS_JSON+="$(build_json_row "$(esc "$name")" "$(esc "$expected")" "$(esc "$actual")" "$(esc "$status")")"
done

# Fix #2 (from earlier pass): printf has NO >&2 redirect — JSON goes to
# STDOUT for atomically pipe-friendly consumption. All section-headers,
# table-rows, log-lines use stderr via `section()`, `log()`. Only the JSON
# block on this single print-line goes to STDOUT.
printf '{"overall":"%s","pass":%s,"fail":%s,"aspirational_failures":%s,"exit_code":%s,"transcript_stamp":"%s","checks":[%s]}\n' \
  "$OVERALL_STATUS" "$TOTAL_PASS" "$TOTAL_FAIL" "$ASPIRATIONAL_CLAIMS_FAILED" "$EXIT_CODE" "$TRANSCRIPT_STAMP" "$CHECKS_JSON"

exit "$EXIT_CODE"
