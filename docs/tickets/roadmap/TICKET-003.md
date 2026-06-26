# TICKET-003 — Medenspiel-CSV-Export für Verbände

> **Epic:** TICKET-003 Medenspiel-CSV · **Quartal:** Roadmap · **Aufwand:** 0,5-1 Tag  
> **Status:** ✅ DONE · _zuletzt geprüft: 2026-06-26_

## Ziel

Standardisierter CSV-Export für Verbände mit BOM, DE-Datumsformat, Hochkomma-Escaping.

## Voraussetzungen

- _(keine)_

## Geänderte / neue Dateien

- ✓ `app/api/leagues/[id]/export/verband/route.ts` — _OK_
- ✓ `tests/unit/lib/csv-export.test.ts` — _OK_

## Akzeptanzkriterien

- [ ] AKZ-3.1 Endpoint mit Trainer+Auth
- [ ] AKZ-3.2 Filter auf club_id+league_id
- [ ] AKZ-3.3 Header-Block mit Liga-Metadaten
- [ ] AKZ-3.7 Content-Disposition mit File-Name
- [ ] CSV-Escape-Unit-Tests grün

## Out-of-Scope

- _(nicht definiert)_

## Nächste Aktion

Keine — Backend + Unit-Tests grün. Nice-to-have: BTV/WTV/HTV-Adapter.
