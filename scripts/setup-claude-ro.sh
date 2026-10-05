#!/usr/bin/env bash
# Legt die Nur-Lese-Rolle claude_ro in Produktion an (oder setzt ihr Passwort neu)
# und schreibt .env.prod.readonly. Mehrfach ausführbar.
set -euo pipefail
cd ~/Projektentwicklung/Projekte/Webseiten/SwingZ_Tennis

PW=$(openssl rand -hex 24)
ADMIN_URL=$(grep -E '^DATABASE_URL=' .env.prod.local | cut -d= -f2-)

psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 <<SQL
do \$\$ begin
  if exists (select 1 from pg_roles where rolname = 'claude_ro') then
    alter role claude_ro login password '$PW' bypassrls;
  else
    create role claude_ro login password '$PW' bypassrls;
  end if;
end \$\$;
grant usage on schema public to claude_ro;
grant select on all tables in schema public to claude_ro;
alter default privileges in schema public grant select on tables to claude_ro;
alter role claude_ro set default_transaction_read_only = on;
SQL

printf 'DATABASE_URL_PROD_RO=postgresql://claude_ro.swingz:%s@supabase.swingz.cloud:6543/postgres?sslmode=require\n' "$PW" > .env.prod.readonly
chmod 600 .env.prod.readonly
chmod +x scripts/prod-read.sh
echo fertig
