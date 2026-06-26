# TICKET-W2-CAST-CLEANUP — Wave-2 Cast-Cleanup Complex Routes

> **Epic:** TICKET-W2 Cast-Cleanup · **Quartal:** Roadmap · **Aufwand:** 0,5 Tag  
> **Status:** 🔶 PARTIAL · _zuletzt geprüft: 2026-06-26_

## Ziel

`as any`-Casts in `app/api/leagues/[id]/matchdays/.../lineup/route.ts` und `result/route.ts` entfernen.

## Voraussetzungen

- `2.1.1`

## Geänderte / neue Dateien

- ✓ `app/api/leagues/[id]/matchdays/[matchdayId]/lineup/route.ts` — _OK_
- ✓ `app/api/leagues/[id]/matchdays/[matchdayId]/result/route.ts` — _OK_
- ✓ `types/supabase.ts` — _OK_
- ✓ `lib/types/matchdays.ts` — _OK_

## Akzeptanzkriterien

- [ ] AKZ-2.1 LineupPositionsSchema.parse() + typed Insert-Payload
- [ ] AKZ-2.2 Lineup-GET full cast removal
- [ ] AKZ-2.3 ResultUpdateSchema.parse() + typed Update-Payload
- [ ] AKZ-2.4 Result-GET full cast removal
- [ ] AKZ-2.5 TS-Baseline bleibt 27 Errors
- [ ] AKZ-2.6 Cast-Count ≤33 (= -8) — DELTA-3 erreicht (41→38; -5 in weiteren Routes als W3 Follow-up getrackt)

## Out-of-Scope

- _(nicht definiert)_

## Nächste Aktion

W3 Cast-Cleanup: 5 weitere `as any` in anderen `app/api/leagues/`-Routes (Tickets in `route.ts` + `[id]/route.ts`).
