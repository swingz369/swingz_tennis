#!/bin/bash
# Migration Testing Script for SwingZ
# Tests all Phase 3 database migrations

set -e

echo "=================================="
echo "SwingZ Migration Testing Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the correct directory
if [ ! -d "supabase/migrations" ]; then
    echo -e "${RED}Error: supabase/migrations directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📋 Phase 3 Migrations to Test:"
echo "  1. Enhanced Booking Rules"
echo "  2. Trainer Availability System"
echo "  3. News & Announcements System"
echo ""

# Function to check migration syntax
check_migration_syntax() {
    local file=$1
    local name=$2
    
    echo -n "  Checking $name syntax... "
    
    # Basic SQL syntax checks
    if grep -q "CREATE TABLE\|ALTER TABLE\|CREATE FUNCTION\|CREATE INDEX" "$file"; then
        # Check for common syntax errors
        if grep -q ";;$" "$file"; then
            echo -e "${RED}❌ Double semicolon found${NC}"
            return 1
        fi
        
        # Check for balanced parentheses (basic check)
        open_parens=$(grep -o "(" "$file" | wc -l)
        close_parens=$(grep -o ")" "$file" | wc -l)
        
        if [ "$open_parens" -ne "$close_parens" ]; then
            echo -e "${YELLOW}⚠️  Unbalanced parentheses${NC}"
            return 1
        fi
        
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}❌ No SQL statements found${NC}"
        return 1
    fi
}

# Function to analyze migration
analyze_migration() {
    local file=$1
    local name=$2
    
    echo ""
    echo "📊 Analyzing $name:"
    
    tables=$(grep -c "CREATE TABLE" "$file" || echo "0")
    functions=$(grep -c "CREATE.*FUNCTION" "$file" || echo "0")
    indices=$(grep -c "CREATE.*INDEX" "$file" || echo "0")
    triggers=$(grep -c "CREATE TRIGGER" "$file" || echo "0")
    policies=$(grep -c "CREATE POLICY" "$file" || echo "0")
    
    echo "  - Tables:    $tables"
    echo "  - Functions: $functions"
    echo "  - Indices:   $indices"
    echo "  - Triggers:  $triggers"
    echo "  - RLS Policies: $policies"
}

# Test each migration
echo "🔍 Testing Migrations:"
echo ""

# 1. Enhanced Booking Rules
migration_file="supabase/migrations/20260506_enhanced_booking_rules.sql"
if [ -f "$migration_file" ]; then
    check_migration_syntax "$migration_file" "Enhanced Booking Rules"
    analyze_migration "$migration_file" "Enhanced Booking Rules"
else
    echo -e "${RED}❌ Migration file not found: $migration_file${NC}"
fi

echo ""

# 2. Trainer Availability
migration_file="supabase/migrations/20260506_trainer_availability.sql"
if [ -f "$migration_file" ]; then
    check_migration_syntax "$migration_file" "Trainer Availability"
    analyze_migration "$migration_file" "Trainer Availability"
else
    echo -e "${RED}❌ Migration file not found: $migration_file${NC}"
fi

echo ""

# 3. News System
migration_file="supabase/migrations/20260506_news_system.sql"
if [ -f "$migration_file" ]; then
    check_migration_syntax "$migration_file" "News System"
    analyze_migration "$migration_file" "News System"
else
    echo -e "${RED}❌ Migration file not found: $migration_file${NC}"
fi

echo ""
echo "=================================="
echo "🎯 Summary"
echo "=================================="
echo ""
echo "✅ Phase 3 migrations syntax validated"
echo ""
echo "📝 Next Steps:"
echo "  1. Review migration files for logic errors"
echo "  2. Test on development database:"
echo "     supabase db push"
echo "  3. Verify with:"
echo "     supabase db diff"
echo "  4. Run integration tests"
echo ""
echo "⚠️  IMPORTANT: Always test on development before production!"
echo ""

# Check for common issues
echo "🔎 Checking for Common Issues:"
echo ""

# Check for hardcoded UUIDs
echo -n "  Checking for hardcoded UUIDs... "
if grep -r "[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}" supabase/migrations/20260506*.sql > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Found (review needed)${NC}"
else
    echo -e "${GREEN}✓${NC}"
fi

# Check for DROP statements without IF EXISTS
echo -n "  Checking for unsafe DROP statements... "
if grep -E "DROP (TABLE|FUNCTION|INDEX)" supabase/migrations/20260506*.sql | grep -v "IF EXISTS" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Found (add IF EXISTS)${NC}"
else
    echo -e "${GREEN}✓${NC}"
fi

# Check for missing RLS policies
echo -n "  Checking for tables without RLS... "
tables_count=$(grep -h "CREATE TABLE" supabase/migrations/20260506*.sql | wc -l)
rls_count=$(grep -h "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" supabase/migrations/20260506*.sql | wc -l)

if [ "$rls_count" -lt "$tables_count" ]; then
    echo -e "${YELLOW}⚠️  Some tables may be missing RLS${NC}"
else
    echo -e "${GREEN}✓${NC}"
fi

echo ""
echo "=================================="
echo "✅ Migration Testing Complete"
echo "=================================="
