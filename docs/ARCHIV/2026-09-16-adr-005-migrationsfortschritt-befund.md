# ADR-005-Migrationsfortschritt — Befund am Code — 16.09.2026

> **Art:** Archiv (einmaliger Snapshot, nicht pflegen). Ausgangspunkt war ein Archify-
> Architekturdiagramm zum Zielbild aus [ADR-005](../decisions/adr-005-datenzugriff-supabase-repositories.md)
> (`docs/diagrams/adr-005-datenzugriff.html`). Beim Bau des Diagramms fiel auf, dass die acht
> seit dem 13.09.2026 gemergten "ADR-005 Phase 3"-Commits (Mahnwesen, Abrechnungslauf,
> Rechnungen, Trainer-Honorarabrechnung, Probetraining, Mitgliederliste, Gruppen,
> Stundenerfassung/Anwesenheit) sich kaum in den Architektur-Kennzahlen niederschlagen. Alle
> Zahlen unten am Code selbst geprüft (Befehle stehen dabei), nicht aus Commit-Messages
> übernommen. Nur dokumentiert — noch nicht behoben, siehe `docs/OPEN_ITEMS.md`.

---

## 1. Architektur-Baseline-Datei seit 13.09. eingefroren — Fortschritt unsichtbar

`.dependency-cruiser-known-violations.json` (174 Einträge) stammt aus Commit `b3a37472`
(13.09.2026, laut Kommentar in `.dependency-cruiser.cjs` als "Baseline, die mit jeder
migrierten Domäne kleiner werden soll" gedacht). Seither landeten 8 weitere Migrations-Commits.
Ein voller Re-Run ohne die Baseline-Unterdrückung zeigt aber kaum Bewegung:

```bash
npx depcruise app components hooks lib src --config .dependency-cruiser.cjs \
  --no-ignore-known --output-type json > /tmp/depcruise-full.json
# routes-no-direct-db-baseline: 172 aktuelle Treffer vs. 174 in der Baseline-Datei
```

**172 statt 174** — netto 2 weniger, trotz 8 "abgeschlossener" Domänen-Migrationen.
`npm run arch:check` läuft mit `--ignore-known` gegen die veraltete Datei und meldet "grün",
während der reale Zustand kaum vorangekommen ist. Konkret nachweisbar an
`app/api/billing/dunning/route.ts`: taucht in der Baseline noch mit
`-> lib/supabase/service.ts` auf, importiert das im aktuellen Code (nach der Migration in
Commit `f2ce1248`) aber gar nicht mehr — der Eintrag ist tot und wurde nie entfernt.

**Fix-Idee:** `npm run arch:baseline` als festen Schritt in jedem "ADR-005 Phase 3"-Commit,
oder ein CI-Gate, das die Verstoßzahl gegen die zuletzt committete Baseline vergleicht und bei
Anstieg blockt.

## 2. Mehrere migrierte Domänen überspringen die Service-Schicht

ADR-005 schreibt Route → Service → Repository vor (siehe alle Referenzdomänen, z. B.
`hourly-rate.service.ts`). 14 Routen importieren stattdessen ein Repository **direkt**:

```bash
grep -rl "infrastructure/persistence/repositories" app/api --include=route.ts
```

```
app/api/groups/route.ts
app/api/groups/[id]/route.ts
app/api/groups/[id]/members/route.ts
app/api/groups/[id]/members/[memberId]/route.ts
app/api/bookings/route.ts
app/api/schedule/route.ts
app/api/clubs/[id]/route.ts
app/api/stripe/checkout/route.ts
app/api/pricing-rules/route.ts
app/api/pricing-rules/[id]/route.ts
app/api/pricing-rules/calculate/route.ts
app/api/analytics/bookings/export/route.ts
app/api/analytics/revenue/export/route.ts
app/api/analytics/insights/route.ts
```

Beispiel `app/api/groups/route.ts`: importiert `GroupRepository` **und** `getUserDb` direkt in
der Route, es gibt keinen `GroupService`. Die RLS-Disziplin (`getUserDb(auth)`) ist eingehalten
— aber Fachlogik landet in der Route statt in `src/application/services/`, genau die Schicht,
die ADR-005 einführen wollte. Erklärt nebenbei auch einen Teil von Befund 1: die
`routes-no-direct-db-baseline`-Regel matched jeden Repository-Import aus einer Route, nicht nur
Drizzle — diese 14 Routen bleiben deshalb "Verstoß", ganz unabhängig vom RLS-Fortschritt.

**Fix-Idee:** pro betroffener Domäne einen dünnen Service nachziehen (reiner Durchreicher reicht,
wo keine echte Fachlogik existiert), damit das Muster einheitlich bleibt und Repository-Importe
aus `app/` vollständig verschwinden.

## 3. Migration hat fast nur den ungefährlicheren Pfad abgebaut

ADR-005-Kontext nennt als Ist-Zustand vom 13.09.: ~85 Routen über Drizzle, ~86 über den
Service-Client (RLS umgangen — Ursache der zwei echten Datenlecks im Juli, siehe ADR-005 § Kontext).

```bash
grep -rl "from '@/src/infrastructure/persistence/db'" app/api --include=route.ts | wc -l   # 21
grep -rl "createServiceClient" app/api --include=route.ts | wc -l                          # 84
grep -rl "systemDb(" app/api --include=route.ts | wc -l                                    # 3
```

| Pfad                                      |   13.09. (ADR-005-Baseline) | 16.09. (dieser Befund) |   Δ |
| ----------------------------------------- | --------------------------: | ---------------------: | --: |
| Drizzle-Import in Routen                  |                         ~85 |                     21 | −64 |
| `createServiceClient` direkt in Routen    |                         ~86 |                     84 |  −2 |
| davon über auditierten `systemDb(reason)` | 0 (Muster existierte nicht) |                      3 |  +3 |

Die 84 verbliebenen `createServiceClient`-Treffer streuen über praktisch alle Domänen (auth,
admin, trainer, sessions, clubs, members, bookings, leagues, search, weather, …) — weit über die
in ADR-005 genannte Whitelist (Cron, Stripe-Webhook, Benachrichtigungen, Owner-Funktionen)
hinaus, und ohne die dort verlangte `reason`-Pflicht samt Logging. Die Migration hat bisher fast
ausschließlich den Drizzle-Pfad abgebaut; der Pfad, der laut ADR-005 die realen Datenlecks
verursacht hat, ist praktisch unverändert offen.

**Fix-Idee:** keine neue, eigenständige Idee — deckt sich mit dem bereits in
`docs/OPEN_ITEMS.md` (P0, "Drizzle-Service-Pfad umgeht RLS komplett") dokumentierten Punkt,
der um diesen Befund ergänzt wurde.

---

## Diagramm

Visualisiert (Zielbild + beide Pfade): [`../diagrams/adr-005-datenzugriff.html`](../diagrams/adr-005-datenzugriff.html).
