#!/bin/bash
set -e

echo "=== Supabase Local Development Setup ==="

# Prefer Supabase CLI (official)
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI found"

  if [ ! -f "supabase/config.toml" ]; then
    echo "📝 Initializing Supabase project config..."
    supabase init
  fi

  echo "🚀 Starting Supabase services..."
  supabase start

  # Wait
  sleep 5

  # Copy generated .env.local to project root if needed
  if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists, backing up to .env.local.backup"
    cp .env.local .env.local.backup
  fi
  cp .env .env.local

  echo ""
  echo "✅ Supabase is running!"
  echo ""
  echo "Credentials:"
  echo "  URL:      http://localhost:54321"
  echo "  Anon:     $(grep 'SUPABASE_ANON_KEY' .env.local | cut -d'=' -f2 | head -c 20)..."
  echo ""
  echo "To stop: supabase stop"
  echo "To restart: supabase start"
  echo ""
  exit 0
fi

# Fallback: Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop first."
  echo "   https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Check docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "❌ Neither Supabase CLI nor Docker Compose available."
  echo ""
  echo "Recommended: Install Supabase CLI (easiest)"
  echo "  npm install -g @supabase/cli"
  echo ""
  echo "Or install Docker Compose plugin:"
  echo "  • Linux: sudo apt-get install docker-compose-plugin"
  echo "  • macOS/Windows: Docker Desktop includes Compose"
  echo ""
  exit 1
fi

COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker compose"
fi

# Use docker-compose fallback
echo "⚠️  Using Docker Compose fallback (not recommended for development)"
echo "   Consider installing Supabase CLI: npm install -g @supabase/cli"
echo ""

if [ -f .env.local ]; then
  echo "⚠️  .env.local exists, backing up to .env.local.backup"
  cp .env.local .env.local.backup
fi

$COMPOSE_CMD -f docker-compose.supabase.yml up -d

sleep 5

if curl -s http://localhost:54321/health > /dev/null 2>&1; then
  echo "✅ Supabase Auth running on http://localhost:54321"
else
  echo "⚠️  Auth starting... check: $COMPOSE_CMD -f docker-compose.supabase.yml logs supabase-auth"
fi

cat > .env.local << 'EOF'
# Supabase Local Development (Docker Compose)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlLWRhc2hib2FyZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ4ODU4MzAwLCJleHAiOjE5NjQ0MzQzMDB9.5U5Oq2x0m5q3x_r8q7h7g0p8z9w7v6y5t4r3e2w1q
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlLWRhc2hib2FyZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDg4NTgzMDAsImV4cCI6MTk2NDQzNDMwMH0.7v8x9w7v6y5t4r3e2w1q0p9o8i7u6y5t4r3e2w1q0p

NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo ""
echo "✅ Supabase Docker Compose setup complete!"
echo ""
echo "To stop: $COMPOSE_CMD -f docker-compose.supabase.yml down"
echo "To view logs: $COMPOSE_CMD -f docker-compose.supabase.yml logs -f"
