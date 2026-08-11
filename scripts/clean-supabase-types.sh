#!/usr/bin/env bash
#
# clean-supabase-types.sh
#
# Strips Supabase CLI progress/debug output that leaks into the generated
# TypeScript type files via `supabase gen types typescript`.
#
# Issues fixed:
#   - Line 1: "Connecting to db.xxx.supabase.co 5432" (connection status)
#   - Trailing: "A new version of Supabase CLI is available..." (update notice)
#   - Trailing: "We recommend updating regularly..." (update URL)
#
# Usage:
#   ./scripts/clean-supabase-types.sh [file1] [file2] ...
#   (defaults to types/supabase.ts if no args)
#
# Typically run after:
#   supabase gen types typescript --db-url "$DB_URL" > types/supabase.ts
#   ./scripts/clean-supabase-types.sh
#

set -euo pipefail

AUTO_BACKUP="${CLEAN_NO_BACKUP:-}"

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
    FILES=("types/supabase.ts")
fi

# Auto-backup before cleaning (unless CLEAN_NO_BACKUP is set)
if [ -z "$AUTO_BACKUP" ]; then
    echo "📦 Auto-backup before cleaning ..."
    "$(dirname "$0")/backup-supabase-types.sh" save 2>/dev/null || true
    echo ""
fi

for FILE in "${FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
        echo "⚠️  Skipping: $FILE not found"
        continue
    fi

    echo "🧹 Cleaning $FILE ..."

    # Remove the first line if it's a Supabase connection message
    if head -1 "$FILE" | grep -q '^Connecting to db\.'; then
        sed -i '1d' "$FILE"
        echo "   ✓ Removed connection status line"
    fi

    # Remove trailing "A new version of Supabase CLI" line (if present)
    while tail -1 "$FILE" | grep -qE '^(A new version of Supabase CLI|We recommend updating regularly|https://supabase\.com/docs/guides/cli/getting-started)'; do
        sed -i '$d' "$FILE"
        echo "   ✓ Removed trailing CLI update notice line"
    done

    echo "   ✅ Done ($(wc -l < "$FILE") lines)"
done

echo ""
echo "🎉 All Supabase type files cleaned."
