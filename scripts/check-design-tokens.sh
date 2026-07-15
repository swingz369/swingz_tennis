#!/usr/bin/env bash
# Design-Token-Guardrail — failt, wenn hartcodierte Tailwind-Palette-Klassen
# oder verbotene Radius-Varianten in den UI-Code zurückkommen.
# Erlaubt sind nur semantische Tokens: success/warning/error/info, gray,
# brand-*, primary/secondary/muted/accent/destructive (shadcn) sowie
# rounded-md | rounded-xl | rounded-full.
# Nutzung: bash scripts/check-design-tokens.sh   (Exit 1 bei Verstößen)
set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
SCOPE=(app components lib src)

FARBEN='(green|emerald|lime|teal|yellow|amber|red|rose|blue|sky|cyan|indigo|purple|violet|fuchsia|pink|orange|slate|zinc|neutral|stone)'
HITS=$(grep -rEn "\\b${FARBEN}-[0-9]{2,3}\\b" "${SCOPE[@]}" --include='*.tsx' --include='*.ts' 2>/dev/null)
if [ -n "$HITS" ]; then
  echo "❌ Hartcodierte Palette-Klassen gefunden (semantische Tokens verwenden — success/warning/error/info/gray/brand-accent):"
  echo "$HITS" | head -30
  FAIL=1
fi

RADIUS=$(grep -rEn '\brounded(-[trbles]{1,2})?-(sm|lg|2xl|3xl)\b' "${SCOPE[@]}" --include='*.tsx' --include='*.ts' 2>/dev/null)
if [ -n "$RADIUS" ]; then
  echo "❌ Verbotene Radius-Varianten gefunden (erlaubt: rounded-md, rounded-xl, rounded-full):"
  echo "$RADIUS" | head -30
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "✅ Design-Tokens sauber — keine hartcodierten Palette-Klassen, Radius-Skala eingehalten."
fi
exit $FAIL
