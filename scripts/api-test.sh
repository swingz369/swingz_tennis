#!/bin/bash
# API Integration Test - calls all routes and reports status codes
BASE_URL="http://localhost:3000"
TIMEOUT=10
PASS=0
FAIL=0
AUTH=0
NOTFOUND=0
SERVERROR=0
TOTAL=0

test_route() {
  local method="${1:-GET}"
  local path="$2"
  local description="$3"
  TOTAL=$((TOTAL + 1))
  
  local body_flag=""
  if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    body_flag="-H 'Content-Type: application/json' -d '{}'"
  fi
  
  local url="${BASE_URL}${path}"
  local status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" $body_flag --max-time "$TIMEOUT" "$url" 2>/dev/null)
  
  if [ -z "$status" ] || [ "$status" = "000" ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "TIMEOUT"
    FAIL=$((FAIL + 1))
  elif [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "OK $status"
    PASS=$((PASS + 1))
  elif [ "$status" -ge 300 ] && [ "$status" -lt 400 ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "REDIR $status"
    PASS=$((PASS + 1))
  elif [ "$status" -eq 401 ] || [ "$status" -eq 403 ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "AUTH $status"
    AUTH=$((AUTH + 1))
  elif [ "$status" -eq 404 ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "404 NOT FOUND"
    NOTFOUND=$((NOTFOUND + 1))
  elif [ "$status" -ge 500 ]; then
    printf "%-6s %-65s %s\n" "$method" "$path" "500+ ERROR"
    SERVERROR=$((SERVERROR + 1))
  else
    printf "%-6s %-65s %s\n" "$method" "$path" "OTHER $status"
  fi
}

echo "=== SwingZ API Route Test ==="
echo ""

# PUBLIC
echo "--- PUBLIC ROUTES ---"
test_route GET "/api/health"
test_route GET "/api/docs"
test_route GET "/api/csrf-token"
test_route POST "/api/public/register"
test_route POST "/api/auth/login"
test_route POST "/api/auth/logout"
test_route GET "/api/debug/auth"
test_route POST "/api/qr-checkin"
test_route GET "/api/qr-checkin"
test_route POST "/api/webhooks/stripe"
test_route POST "/api/webhooks/zapier"

# CORE (GET)
echo "--- CORE ---"
test_route GET "/api/me"
test_route GET "/api/user/me"
test_route GET "/api/user/roles"
test_route GET "/api/user/club"
test_route GET "/api/user/member"
test_route GET "/api/clubs"
test_route GET "/api/notifications"
test_route GET "/api/dashboard/kpis"

# SEARCH (fixed dummy)
echo "--- SEARCH ---"
test_route GET "/api/search?q=test"
test_route GET "/api/search?q=&limit=5"

# TRAINER (fixed club access)
echo "--- TRAINER ---"
test_route GET "/api/trainer-profiles"
test_route GET "/api/trainer-profiles?clubId=test"
test_route POST "/api/trainer-profiles"
test_route GET "/api/trainer-availability"
test_route POST "/api/trainer-availability"
test_route GET "/api/trainer-availability/conflicts?startDate=2026-01-01&endDate=2026-06-01"
test_route GET "/api/trainer/me"
test_route GET "/api/trainer/hours-logs/stats"

# TRIAL TRAININGS (fixed date filter)
echo "--- TRIAL TRAININGS ---"
test_route GET "/api/trial-trainings"
test_route GET "/api/trial-trainings?startDate=2026-01-01&endDate=2026-06-01"
test_route GET "/api/trial-trainings/stats"

# ANALYTICS (fixed random)
echo "--- ANALYTICS ---"
test_route GET "/api/analytics"
test_route GET "/api/statistics/dashboard"
test_route GET "/api/statistics"
test_route GET "/api/gamification"

# BOOKINGS/SESSIONS
echo "--- BOOKINGS ---"
test_route GET "/api/bookings"
test_route GET "/api/sessions"
test_route GET "/api/courts"
test_route GET "/api/court-types"
test_route GET "/api/booking-rules"
test_route GET "/api/pricing-rules"
test_route GET "/api/schedule"
test_route GET "/api/rsvps/my"

# MEMBERS/GROUPS
echo "--- MEMBERS ---"
test_route GET "/api/members"
test_route GET "/api/groups"
test_route GET "/api/training-groups"
test_route GET "/api/trainers"

# BILLING
echo "--- BILLING ---"
test_route GET "/api/billing/invoices"
test_route GET "/api/billing/balance"
test_route GET "/api/billing/line-items"
test_route GET "/api/billing/trainers"
test_route GET "/api/billing/monthly-overview"
test_route GET "/api/billing/open-items"
test_route GET "/api/billing/group-change"
test_route GET "/api/billing/invoices/overview"
test_route GET "/api/sepa-mandates"

# SEASONS
echo "--- SEASONS ---"
test_route GET "/api/seasons"
test_route POST "/api/seasons/planning/ai-analysis"

# PAYMENT/HOURS/ATTENDANCE
echo "--- PAYMENT/HOURS ---"
test_route GET "/api/payment-settings"
test_route GET "/api/hours-logs"
test_route GET "/api/attendance-records"
test_route GET "/api/fee-configurations"
test_route GET "/api/system-settings"
test_route GET "/api/absences"

# HOURLY RATES
echo "--- HOURLY RATES ---"
test_route GET "/api/hourly-rates/trainers"
test_route GET "/api/hourly-rates/tiers"
test_route GET "/api/hourly-rates/history"

# MISC
echo "--- MISC ---"
test_route GET "/api/feedback"
test_route GET "/api/feedback/ratings"
test_route GET "/api/applications"
test_route GET "/api/news"
test_route GET "/api/tournaments"
test_route GET "/api/messages"
test_route GET "/api/branding"
test_route GET "/api/family-accounts"
test_route GET "/api/coupons"
test_route GET "/api/email-campaigns"
test_route GET "/api/admin/approvals"
test_route GET "/api/admin/approvals/count"
test_route GET "/api/admin/billing/subscriptions"
test_route GET "/api/backup"

# SHOP
echo "--- SHOP ---"
test_route GET "/api/stripe/checkout"
test_route GET "/api/shop"
test_route GET "/api/shop/orders"

# NOTIFICATIONS
echo "--- NOTIFICATIONS ---"
test_route GET "/api/user/notifications"
test_route GET "/api/user/notifications/count"

# CRON
echo "--- CRON ---"
test_route POST "/api/cron/billing-overdue"
test_route POST "/api/cron/backup"

# OTHER
echo "--- OTHER ---"
test_route POST "/api/reminders/booking-tomorrow"
test_route GET "/api/ai/churn-prediction"
test_route GET "/api/schedule/optimize"
test_route GET "/api/audit-logs"
test_route GET "/api/audit-logs/summary"
test_route GET "/api/audit-logs/export"
test_route GET "/api/analytics/members/export"
test_route GET "/api/analytics/bookings/export"
test_route GET "/api/analytics/revenue/export"
test_route GET "/api/statistics/export"
test_route GET "/api/seasons/test-id/auto-plan"
test_route GET "/api/seasons/test-id/planning/waitlist"
test_route GET "/api/clubs/test-id/planning-readiness"
test_route GET "/api/invoices/test-id/pdf"

echo ""
echo "============================================"
echo "SUMMARY: $TOTAL routes tested"
echo "  OK (2xx/3xx): $PASS"
echo "  AUTH (401/403): $AUTH"
echo "  404: $NOTFOUND"
echo "  5xx: $SERVERROR"
echo "  TIMEOUT: $FAIL"
echo "============================================"

if [ $SERVERROR -gt 0 ] || [ $NOTFOUND -gt 0 ] || [ $FAIL -gt 0 ]; then
  echo "ISSUES FOUND"
  exit 1
else
  echo "ALL CLEAN"
  exit 0
fi
