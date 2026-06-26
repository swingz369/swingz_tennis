# TICKET-002 — Beschlussdatenbank digital (BGB §§ 32, 33)

> **Epic:** TICKET-002 Beschlussdatenbank · **Quartal:** Roadmap · **Aufwand:** 3-4 Tage  
> **Status:** 🔶 PARTIAL · _zuletzt geprüft: 2026-06-26_

## Ziel

Vier Beschluss-Typen, 5 Status, RLS-isoliert, Stimmenerfassung, Soft-Delete.

## Voraussetzungen

- _(keine)_

## Geänderte / neue Dateien

- ✓ `lib/types/decisions.ts` — _OK_
- ✓ `app/api/decisions/route.ts` — _OK_
- ✓ `app/api/decisions/[id]/route.ts` — _OK_
- ✓ `app/api/decisions/[id]/votes/route.ts` — _OK_
- ✓ `app/(protected)/admin/decisions/page.tsx` — _OK_
- ✓ `components/decision-vote-button.tsx` — _OK_
- ✓ `supabase/migrations/20260624_mahnwesen_verzugszins_decisions.sql` — _OK_

## Akzeptanzkriterien

- [ ] AKZ-2.1 ENUM decision_type (4 Werte)
- [ ] AKZ-2.2 Status ENUM (5 Werte)
- [ ] AKZ-2.3 Soft-Delete (kein Hard-Delete)
- [ ] AKZ-2.4 RLS Member sehen nur completed MV
- [ ] AKZ-2.5 Idempotente Stimmabgabe
- [ ] AKZ-2.6 Stimmabgabe nur bei scheduled/in_progress
- [ ] AKZ-2.7 RLS Member sieht eigene Einladungen
- [ ] Quorum-Berechnung (AKZ-2.8 nice-to-have)
- [ ] E2E

## Out-of-Scope

- _(nicht definiert)_

## Nächste Aktion

Quorum-Berechnung in `decision.service.ts` ergänzen (backend TODO).
