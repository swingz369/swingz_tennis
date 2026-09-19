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

# ── Muster-Ratsche (UI-Einheitlichkeit, docs/ARCHIV/2026-09-19-ui-einheitlichkeit-analyse-und-plan.md) ──
# Die Token-Prüfung oben fängt Farben und Radius. Diese Zähler fangen Muster:
# jede Regel hat eine Obergrenze = Stand beim Einführen. Sie darf nur sinken —
# beim Umstellen die Grenze hier mitsenken, nie anheben.
UI_SCOPE=(app/\(protected\) components)
ratchet() { # name max pattern [exclude-regex]
  local name="$1" max="$2" pat="$3" excl="${4:-^$}"
  local hits count
  hits=$(grep -rEn "$pat" "${UI_SCOPE[@]}" --include='*.tsx' 2>/dev/null | grep -Ev "$excl")
  count=$(printf '%s' "$hits" | grep -c . || true)
  if [ "$count" -gt "$max" ]; then
    echo "❌ Muster-Ratsche '$name': $count Treffer, erlaubt sind $max (Baukasten: docs/DESIGN.md § 6a)."
    echo "$hits" | head -10
    FAIL=1
  fi
}
# <h1> gehört in PageHeader. Ausnahmen: Vollbild-/Bestätigungsseiten ohne Seitenrahmen und Fehlerseiten,
# das Profil (Personenname als Titel).
ratchet 'h1 außerhalb PageHeader' 0 '<h1' 'components/ui/page-header|payment-success|shop/success|select-admin-club|/error\.tsx|subscription-dunning-block|components/member-profile\.tsx'
ratchet 'window.confirm statt ConfirmDialog' 0 '(^|[^A-Za-z.])(window\.)?confirm\(' 'onConfirm|handleConfirm|await confirm\('
ratchet 'rohe <table> statt <Table>' 0 '<table' 'components/ui/table\.tsx'
ratchet 'Pixel-Schriftgrößen text-[Npx]' 9 'text-\[[0-9]+px\]' 'components/ui/'
ratchet 'CenteredModal außerhalb ui/' 29 '<CenteredModal' 'components/ui/'

# Kennzahl-Kacheln: Dateien, die eine Zahl als text-2xl/3xl font-bold in eine Card setzen,
# ohne KpiBand/StatCard. Dateiweise gezählt (ein Treffer je Datei), Kennzahlen gehören in KpiBand.
KACHELN=$(grep -rlE 'className="[^"]*text-(2xl|3xl) font-bold' "${UI_SCOPE[@]}" --include='*.tsx' 2>/dev/null \
  | grep -v 'components/ui/' | while read -r f; do
      grep -q '<Card' "$f" && ! grep -qE 'KpiBand|StatCard' "$f" && echo "$f"
    done)
KACHELN_N=$(printf '%s' "$KACHELN" | grep -c . || true)
if [ "$KACHELN_N" -gt 26 ]; then
  echo "❌ Muster-Ratsche 'Kennzahl-Kachel statt KpiBand': $KACHELN_N Dateien, erlaubt sind 26 (docs/DESIGN.md § 6a)."
  echo "$KACHELN" | head -10
  FAIL=1
fi

# Leerzustände: loser „Keine … gefunden/vorhanden"-Text statt EmptyState/ListState — dateiweise gezählt.
LEER=$(grep -rlE '>\s*Keine [^<]*(gefunden|vorhanden)' "${UI_SCOPE[@]}" --include='*.tsx' 2>/dev/null \
  | grep -v 'components/ui/' | while read -r f; do
      grep -qE 'EmptyState|ListState' "$f" || echo "$f"
    done)
LEER_N=$(printf '%s' "$LEER" | grep -c . || true)
if [ "$LEER_N" -gt 17 ]; then
  echo "❌ Muster-Ratsche 'loser Leerzustand statt EmptyState/ListState': $LEER_N Dateien, erlaubt sind 17 (docs/DESIGN.md § 6a)."
  echo "$LEER" | head -10
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "✅ Design-Tokens sauber — keine hartcodierten Palette-Klassen, Radius-Skala eingehalten."
fi
exit $FAIL
