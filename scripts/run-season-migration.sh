#!/bin/bash
# =============================================================================
# SwingZ — Season Planning Migration Runner
# =============================================================================
# Führt die Season-Planning-Migration auf der Supabase-Datenbank aus.
#
# Voraussetzungen:
#   - psql installiert (brew install postgresql / apt install postgresql-client)
#   - .env.local mit DATABASE_URL
#
# Usage:
#   chmod +x scripts/run-season-migration.sh
#   ./scripts/run-season-migration.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Prüfe psql
if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql nicht installiert."
  echo "   Installiere: brew install postgresql (macOS) oder apt install postgresql-client (Linux)"
  exit 1
fi

# Lese DATABASE_URL aus .env.local
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.local nicht gefunden in $ENV_FILE"
  exit 1
fi

# Source .env.local für robustes Parsing (unterstützt Quotes, Spaces)
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL nicht in .env.local gefunden"
  echo "   Füge hinzu: DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres"
  exit 1
fi

# Parse die URL für psql (psql erwartet postgresql://... Format)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20260506_season_planning_system.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration-Datei nicht gefunden: $MIGRATION_FILE"
  exit 1
fi

echo "🚀 Führe Season-Planning-Migration aus..."
echo "   Datenbank: ${DATABASE_URL%%@*}@***"
echo "   Migration: supabase/migrations/20260506_season_planning_system.sql"
echo ""

# Führe die Migration aus
if psql "$DATABASE_URL" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1 2>&1; then
  echo ""
  echo "✅ Migration erfolgreich ausgeführt!"
  echo ""
  echo "   Erstellte Tabellen:"
  echo "   - seasons"
  echo "   - user_training_preferences"
  echo "   - season_plan_entries"
  echo "   - planning_conflicts"
  echo "   - season_planning_history"
else
  echo ""
  echo "❌ Migration fehlgeschlagen. Prüfe:"
  echo "   1. Ist die DATABASE_URL korrekt?"
  echo "   2. Existieren die Voraussetzungs-Tabellen? (clubs, users, trainers, courts, groups, sessions, user_club_memberships)"
  echo "   3. Hat der Benutzer CREATE TABLE Berechtigungen?"
  exit 1
fi
