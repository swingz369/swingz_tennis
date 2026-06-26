# TICKET-001 — Verzugszins-Mahnwesen nach §288 BGB

> **Epic:** TICKET-001 Verzugszins-Mahnwesen · **Quartal:** Roadmap · **Aufwand:** 2-3 Tage  
> **Status:** 🔶 PARTIAL · _zuletzt geprüft: 2026-06-26_

## Ziel

Rechtssichere Verzugszins-Engine: B2C +9 PP, B2B +9 PP auf Basiszins, halbjährliche Aktualisierung, ACT/360.

## Voraussetzungen

- _(keine)_

## Geänderte / neue Dateien

- ✓ `lib/billing/verzugszins.ts` — _OK_
- ✓ `lib/types/billing.ts` — _OK_
- ✓ `lib/billing/dunning.service.ts` — _OK_
- ✓ `supabase/migrations/20260624_mahnwesen_verzugszins_decisions.sql` — _OK_
- ✗ `lib/billing/verzugszins.test.ts` — _MISS_
- ✗ `e2e/admin-dunning.spec.ts` — _MISS_

## Akzeptanzkriterien

- [ ] AKZ-1.1 B2C Verzugszins ≈ 1,17 € (100€, 30T, 2,27%)
- [ ] AKZ-1.2 B2B ≈ 1,80 € (gleicher Input)
- [ ] AKZ-1.3 Halbjährlicher Basiszinssatz-Wechsel segmentiert
- [ ] AKZ-1.4 firstDunningAt konfigurierbar (§286 Abs. 3)
- [ ] AKZ-1.5 Mahnstufen 1+2+3 progressive Gebühren
- [ ] Verzugszins-Unit-Tests grün
- [ ] E2E Mahnbescheid grün

## Out-of-Scope

- _(nicht definiert)_

## Nächste Aktion

Unit-Tests in `tests/unit/lib/billing/verzugszins.test.ts` schreiben + E2E in `e2e/admin-dunning.spec.ts` (Roadmap-MUSS-Kriterien).
