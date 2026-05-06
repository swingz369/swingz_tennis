#!/bin/bash

# Season Planning Migration Script
# Applies the season planning system migration to Supabase

set -e

echo "🚀 Starting Season Planning Migration..."
echo "========================================="

# Load environment variables
if [ -f .env.local ]; then
    source <(grep -v '^#' .env.local | sed 's/^/export /')
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo "Please ensure .env.local exists with DATABASE_URL"
    exit 1
fi

echo "✅ Environment loaded"

echo ""
echo "📝 Migration Details:"
echo "   File: supabase/migrations/20260506_season_planning_system.sql"
echo "   Size: $(wc -l < supabase/migrations/20260506_season_planning_system.sql) lines"

# Check if migration file exists
if [ ! -f "supabase/migrations/20260506_season_planning_system.sql" ]; then
    echo "❌ ERROR: Migration file not found"
    exit 1
fi

echo ""
read -p "🔍 Do you want to proceed with the migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "⏳ Applying migration..."

# Use psql with full connection string
psql "$DATABASE_URL" -f supabase/migrations/20260506_season_planning_system.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Verifying tables..."
    
    # Verify tables were created
    psql "$DATABASE_URL" -c "
    SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_schema = 'public' 
    AND table_name IN ('seasons', 'user_training_preferences', 'season_plan_entries', 'planning_conflicts', 'season_planning_history')
    ORDER BY table_name;
    "
    
    echo ""
    echo "🎉 Season Planning System is ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Test the API endpoints"
    echo "  2. Create test data"
    echo "  3. Build the admin UI"
    
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error messages above"
    exit 1
fi
