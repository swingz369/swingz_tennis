#!/usr/bin/env bash
#
# gen-supabase-types.sh
#
# Regenerates TypeScript type definitions from the live Supabase database
# and cleans up any Supabase CLI output that leaks into the generated files.
#
# Prerequisites:
#   - DATABASE_URL env var set (e.g., in .env.local)
#   - supabase CLI installed
#
# Usage:
#   npm run gen:types           # Via package.json script
#   bash scripts/gen-supabase-types.sh   # Direct invocation
#
# Output:
#   - types/supabase.ts   (generated + cleaned) — single source of truth
#   - .supabase-types-backup/  (auto-backup, see backup-supabase-types.sh)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Regenerating Supabase types..."

# Load DATABASE_URL from .env.local if not already set
if [ -z "${DATABASE_URL:-}" ]; then
    if [ -f "$PROJECT_DIR/.env.local" ]; then
        DATABASE_URL=$(grep '^DATABASE_URL=' "$PROJECT_DIR/.env.local" | head -1 | cut -d= -f2-)
        export DATABASE_URL
    fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL is not set. Set it in .env.local or export it."
    exit 1
fi

echo "   DB: ${DATABASE_URL%%@*}@***"

cd "$PROJECT_DIR"

# Generate types from the database
echo "   Running supabase gen types ..."
supabase gen types typescript --db-url "$DATABASE_URL" > types/supabase.ts

# Clean up CLI output and auto-backup
echo ""
bash "$SCRIPT_DIR/clean-supabase-types.sh"

echo ""
echo "✅ Type generation complete."
echo "   types/supabase.ts:  $(wc -l < types/supabase.ts) lines"
