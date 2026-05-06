#!/bin/bash

# Script to fix db usage in season planning files
# Adds "const db = getDb();" at the beginning of each async function that uses db

FILES=(
  "app/api/seasons/route.ts"
  "app/api/seasons/[id]/route.ts"
  "app/api/seasons/[id]/preferences/route.ts"
  "app/api/seasons/[id]/preferences/[userId]/route.ts"
  "app/api/seasons/[id]/plan-entries/route.ts"
  "app/api/seasons/[id]/plan-entries/[entryId]/route.ts"
  "app/api/seasons/[id]/auto-plan/route.ts"
  "lib/services/auto-planning.service.ts"
)

for file in "${FILES[@]}"; do
  echo "Processing $file..."
  
  # Add const db = getDb(); after try { in async functions
  sed -i '/return withApiAuth.*async.*auth.*=> {/,/try {/ {
    /try {/a\      const db = getDb();
  }' "$file"
  
  # Also fix auth.userId -> auth.user?.id
  sed -i 's/auth\.userId/auth.user?.id/g' "$file"
done

echo "Done!"
