#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# SwingZ Test Database Setup
# ═══════════════════════════════════════════════════════════════
# Starts a local PostgreSQL container and applies Drizzle migrations
# Prerequisites: Docker, Node.js
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 SwingZ Test DB Setup"
echo "========================"

# ── Step 1: Start PostgreSQL container ─────────────────────────
echo ""
echo "📦 Starting PostgreSQL test database..."
cd "$PROJECT_ROOT"
docker compose -f docker-compose.test.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose -f docker-compose.test.yml exec -T test-db pg_isready -U postgres -d swingz_test 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# ── Step 2: Create .env.test if it doesn't exist ────────────────
if [ ! -f "$PROJECT_ROOT/.env.test" ]; then
  echo ""
  echo "📝 Creating .env.test from template..."
  cp "$PROJECT_ROOT/.env.test.example" "$PROJECT_ROOT/.env.test"
  echo "✅ .env.test created — edit it to add your Supabase credentials"
else
  echo "📝 .env.test already exists — skipping"
fi

# ── Step 3: Apply Drizzle migrations ────────────────────────────
echo ""
echo "🔄 Applying Drizzle schema to test database..."
if npx drizzle-kit push 2>&1; then
  echo "✅ Schema applied successfully"
else
  echo "⚠️  Schema push had issues — this may be OK for existing databases"
fi

# ── Step 4: Seed test data (if seed script exists) ─────────────
if [ -f "$PROJECT_ROOT/scripts/seed-test-billing-user.ts" ]; then
  echo ""
  echo "🌱 Seeding test data..."
  npx tsx "$PROJECT_ROOT/scripts/seed-test-billing-user.ts" || echo "⚠️  Seed script failed (may need Supabase)"
fi

# ── Done ────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "✅ Test environment ready!"
echo ""
echo "  Local PostgreSQL:  postgresql://postgres:postgres@localhost:54323/swingz_test"
echo "  Docker container:  swingz-test-db"
echo ""
echo "  To run tests:"
echo "    npx vitest run                    # all tests (unit + integration)"
echo "    npx vitest run src/__tests__/     # integration tests only"
echo ""
echo "  To stop:"
echo "    docker compose -f docker-compose.test.yml down"
echo "════════════════════════════════════════"
