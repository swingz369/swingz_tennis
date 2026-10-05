#!/usr/bin/env bash
# Nur-Lese-Zugriff auf Produktion (Rolle claude_ro, default_transaction_read_only).
# Aufruf: ./scripts/prod-read.sh -c "select ..."   oder   ./scripts/prod-read.sh < query.sql
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(grep -E '^DATABASE_URL_PROD_RO=' .env.prod.readonly | cut -d= -f2-)
[ -n "$URL" ] || { echo "DATABASE_URL_PROD_RO fehlt in .env.prod.readonly" >&2; exit 1; }
exec psql "$URL" -v ON_ERROR_STOP=1 -X "$@"
