#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# scripts/setup-test-db.sh
#
# Spins up a local PostgreSQL test database in Docker for SwingZ E2E tests
# and writes a ready-to-use `.env.test` file pointing at it.
#
# Idempotent: safe to re-run. Skips container start if already running.
# Does NOT clobber an existing .env.test (deletes it manually to regenerate).
#
# Usage:
#   bash scripts/setup-test-db.sh
#
# Prerequisites:
#   - Docker (or Docker Desktop) running
#   - `docker compose` v2 OR `docker-compose` v1
#
# See docs/TEST_ENVIRONMENT.md for the full setup guide.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Resolve repo root (run from anywhere) ────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ─── Configuration ─────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.test.yml"
CONTAINER_NAME="swingz-test-db"
DB_PORT=54323
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="swingz_test"
HEALTH_TIMEOUT_S=60
HEALTH_INTERVAL_S=2
ENV_FILE=".env.test"
ENV_EXAMPLE=".env.test.example"

# ─── Colors (no-op if not a TTY) ──────────────────────────────────────────
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'; NC=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; NC=""
fi

step() { printf "\n%s==>%s %s\n" "$BLUE" "$NC" "$1"; }
ok()   { printf "  %s✓%s %s\n" "$GREEN" "$NC" "$1"; }
warn() { printf "  %s!%s %s\n" "$YELLOW" "$NC" "$1"; }
err()  { printf "  %s✗%s %s\n" "$RED" "$NC" "$1"; }

# ─── Prerequisite checks ──────────────────────────────────────────────────
step "Checking prerequisites"

if ! command -v docker >/dev/null 2>&1; then
  err "Docker is not installed."
  echo "    Install Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
fi
ok "Docker found: $(docker --version)"

if ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi
ok "Docker daemon is running"

# Pick the right compose command
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  err "Neither 'docker compose' (v2) nor 'docker-compose' (v1) is available."
  exit 1
fi
ok "Compose command: $COMPOSE_CMD"

if [ ! -f "$COMPOSE_FILE" ]; then
  err "Compose file not found: $COMPOSE_FILE"
  exit 1
fi
ok "Compose file: $COMPOSE_FILE"

if [ ! -f "$ENV_EXAMPLE" ]; then
  err "$ENV_EXAMPLE not found. Cannot generate $ENV_FILE."
  exit 1
fi
ok "Template: $ENV_EXAMPLE"

# ─── Start the test database container ────────────────────────────────────
step "Starting test database (port $DB_PORT)"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
  ok "Container $CONTAINER_NAME is already running"
else
  # If the container exists but is stopped, start it; otherwise create it.
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
    warn "Container $CONTAINER_NAME exists but is stopped. Starting..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" start
  else
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
  fi
  ok "Container $CONTAINER_NAME started"
fi

# ─── Wait for ready ───────────────────────────────────────────────────────
step "Waiting for database to be ready (timeout ${HEALTH_TIMEOUT_S}s)"

elapsed=0
ready=0
while [ "$elapsed" -lt "$HEALTH_TIMEOUT_S" ]; do
  if docker exec "$CONTAINER_NAME" pg_isready \
      -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep "$HEALTH_INTERVAL_S"
  elapsed=$((elapsed + HEALTH_INTERVAL_S))
done

if [ "$ready" -ne 1 ]; then
  err "Database did not become ready in ${HEALTH_TIMEOUT_S}s."
  echo "    Inspect logs: docker logs $CONTAINER_NAME"
  exit 1
fi
ok "Database is ready (${elapsed}s)"

# ─── Write .env.test (without clobbering existing) ────────────────────────
step "Writing $ENV_FILE"

DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"

if [ -f "$ENV_FILE" ]; then
  warn "$ENV_FILE already exists. Skipping write."
  warn "  Delete it to regenerate: rm $ENV_FILE && bash scripts/setup-test-db.sh"
else
  # Start from the example template, then substitute the real DATABASE_URL
  # and local Supabase defaults. Everything else (TEST_*_EMAIL, etc.) is
  # left as the example defaults so the user can fill them in.
  sed -e "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" \
      -e "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321|" \
      -e "s|^BASE_URL=.*|BASE_URL=http://localhost:3000|" \
      -e "s|^APP_BASE_URL=.*|APP_BASE_URL=http://localhost:3000|" \
      "$ENV_EXAMPLE" > "$ENV_FILE"

  ok "$ENV_FILE written (auto-filled DATABASE_URL + local URLs)"
  warn "TODO: edit $ENV_FILE and fill in TEST_ADMIN_*, TEST_MEMBER_*, etc."
fi

# ─── Apply migrations (if Supabase CLI available) ────────────────────────
step "Applying migrations (if Supabase CLI is available)"

if command -v supabase >/dev/null 2>&1; then
  if supabase db push --db-url "$DATABASE_URL" 2>&1 | tail -5; then
    ok "Migrations applied"
  else
    warn "Migrations may have failed."
    warn "  The vanilla Postgres container does NOT include Supabase auth.users,"
    warn "  RLS helpers, or storage schema. For full Supabase fidelity, run"
    warn "  \`bash scripts/setup-supabase.sh\` instead and use that stack."
  fi
else
  warn "Supabase CLI not installed. Skipping migration step."
  echo "    Install with: npm install -g supabase"
  echo "    Or use the full Supabase stack: bash scripts/setup-supabase.sh"
fi

# ─── Summary ──────────────────────────────────────────────────────────────
step "Setup complete"

cat <<EOF

${GREEN}Test database is running:${NC}
  Container:  $CONTAINER_NAME
  Host:       localhost:$DB_PORT
  Database:   $DB_NAME
  User/Pass:  $DB_USER / $DB_PASSWORD
  URL:        $DATABASE_URL

${GREEN}Next steps:${NC}

  1. Fill in test user credentials in $ENV_FILE:
       TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
       TEST_SUPERADMIN_EMAIL / TEST_SUPERADMIN_PASSWORD
       TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD
       TEST_TRAINER_EMAIL / TEST_TRAINER_PASSWORD
     Get them from your Supabase Studio (http://localhost:54323)
     or seed:  npm run seed:reset

  2. Run the E2E tests:
       npx playwright test
     or for a single spec:
       npx playwright test tests/e2e/modal-centering.spec.ts

  3. Run the Vitest + Midscene tests (requires OPENAI_API_KEY):
       npx vitest run e2e/admin-season-wizard.test.ts

${YELLOW}Useful commands:${NC}
  Stop database:        $COMPOSE_CMD -f $COMPOSE_FILE stop
  Stop + wipe data:     $COMPOSE_CMD -f $COMPOSE_FILE down -v
  View logs:            docker logs $CONTAINER_NAME
  Re-run this script:   bash scripts/setup-test-db.sh

${YELLOW}Note:${NC} The vanilla Postgres container is enough for unit tests
with mocked auth. For full E2E (real Supabase auth + RLS), use:
  bash scripts/setup-supabase.sh

EOF
