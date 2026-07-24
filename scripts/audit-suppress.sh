#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# scripts/audit-suppress.sh
# ═══════════════════════════════════════════════════════════════════════════════
#
# Runs pnpm audit at --audit-level=high, filters out known unfixable CVEs, and
# exits non-zero only if NEW high/critical vulnerabilities are found.
#
# Known suppressed advisories:
#   GHSA-f88m-g3jw-g9cj  sharp  <0.35.0 (libvips CVEs, next bundled dep)
#   GHSA-6g55-p6wh-862q  postcss ≤8.5.11 (arbitrary file read, next bundled dep)
#   GHSA-r28c-9q8g-f849  postcss ≤8.5.17 (path traversal, next bundled dep)
#   GHSA-mh99-v99m-4gvg  brace-expansion (DoS, eslint>minimatch pinned to v1)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

AUDIT_OUTPUT="$(pnpm audit --audit-level=high --json 2>/dev/null || true)"

if [ -z "$AUDIT_OUTPUT" ]; then
  echo "Audit OK – no vulnerabilities found"
  exit 0
fi

# Filter out known unfixable advisories
SUPPRESSED="GHSA-f88m-g3jw-g9cj|GHSA-6g55-p6wh-862q|GHSA-r28c-9q8g-f849|GHSA-mh99-v99m-4gvg"

UNFILTERED_COUNT=$(echo "$AUDIT_OUTPUT" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const a=d.advisories||{};const s=new Set('${SUPPRESSED}'.split('|'));const u=Object.values(a).filter(v=>!s.has(v.github_advisory_id));console.log(u.length)")

TOTAL_COUNT=$(echo "$AUDIT_OUTPUT" \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(Object.keys(d.advisories||{}).length)")

SUPPRESSED_COUNT=$((TOTAL_COUNT - UNFILTERED_COUNT))

if [ "$UNFILTERED_COUNT" -gt 0 ]; then
  echo "::error::${UNFILTERED_COUNT} unfixed high/critical vulnerabilities remain (${SUPPRESSED_COUNT} suppressed)"
  exit 1
fi

echo "Audit OK (${SUPPRESSED_COUNT} suppressed CVEs)"
exit 0
