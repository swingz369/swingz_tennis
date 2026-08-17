# Analyse: Rollen-Modus („Spielen“/„Verwalten“) & Spielpartner-Suche

> Snapshot. Archivdokument, wird nicht weitergepflegt (siehe `AGENTS.md`).
> Datum: 2026-08-17 · Zweig: `refactor/season-auth-helper-adoption`
> Methode: Code-Review der uncommitteten Änderungen + mechanische Baseline (`typecheck`, `lint`, `docs:check`, gezielte Testläufe) gegen den Ist-Stand des Repos.

---

## Auftrag

Umfassende Analyse des Repos in alle Richtungen mit den verfügbaren Skills und Tools:

- Bugs & Korrektheit
- Sicherheit & Berechtigungen
- Code-Qualität & Konsistenz
- UX / UI-Konsistenz
- Doku-Abweichungen (AGENTS.md-Regeln)

## Mechanische Baseline (grün)

| Prüfung           | Ergebnis                                             |
| ----------------- | ---------------------------------------------------- |
| `pnpm typecheck`  | ✅ keine Fehler                                      |
| `pnpm lint`       | ✅ clean                                             |
| `pnpm docs:check` | ✅ 13 lebende Dokumente, keine Dubletten/toten Links |

Die Probleme liegen **nicht** in der Mechanik, sondern in der Logik des neuen Features.

---

## Befunde

### 🔴 KRITISCH — „Spielen“-Modus führt Admins ins Leere

`components/layout/sidebar.tsx` setzt im Member-Modus `dashboardHref = '/member'` und rendert
`memberSidebarSections`. Aber `app/(protected)/member/layout.tsx` leitet unverändert weiter:

```ts
if (roles.includes('admin')) {
  redirect('/admin');
}
```

**Folge:** Klickt ein Admin im „Spielen“-Modus auf _Dashboard_ (Sidebar, Command-Palette ⌘D,
Mobile-Nav „Start“), landet er wieder auf `/admin`. **Alle** `/member/*`-Ziele
(`/member/leagues`, `/member/tournaments`, `/member/preferences`, `/member/work-duties`,
`/member/trainer-booking`, `/member/trial-training`) sind für Admins unerreichbar. Nur die
Top-Level-Routen ohne Role-Guard (`/partner-finder`, `/bookings`, `/billing`, …) funktionieren.

Der Modus war ein reines clientseitiges `localStorage`-Flag — der Server-Guard kann es nicht
sehen. Das Feature war unvollständig: Der Member-Layout-Redirect (älter als das Feature) wurde
nicht angepasst.

### 🟠 HOCH — „Aktive Suchende“-KPI falsch berechnet

`app/api/admin/partner-finder/stats/route.ts` filterte mit:

```ts
.not('weekly_availability', 'is', null)
```

Aber in `src/infrastructure/persistence/schema.ts` ist `weekly_availability` **`NOT NULL` mit
Default** `{monday: [], …}` (alle leer). Die Spalte ist also **nie null** → der Filter matcht
**jede** Zeile. Zusätzlich zählt `count: 'exact'` **Zeilen, nicht distinct User** —
`user_training_preferences` hat eine Zeile **pro User pro Saison** (`season_id` NOT NULL).

**Ergebnis:** Die Zahl war faktisch „Anzahl Preference-Zeilen des Vereins (über alle Saisons)“,
nicht „Spieler, die Zeiten hinterlegt haben“. Sie misst weder „hat Verfügbarkeit“ noch „Anzahl
Personen“ und konnte `totalMembers` übersteigen.

### 🟡 MITTEL — Hydration-Mismatch in `use-role-mode`

Der `useState`-Initializer las `localStorage` direkt im Client, lieferte serverseitig aber
`'admin'`. Bei gespeichertem `'member'` rendert der Client beim Hydrieren anders als der Server →
Warnung + Flicker. Gleiches Muster existiert zwar in `use-family-accounts.ts` („akzeptiert“),
sollte aber in ein SSR-sicheres Nachladen umgebaut werden.

### 🟡 NIEDRIG — `levelDistribution` unterschlägt verwaiste Memberships

`user_club_memberships.user_id` hat **keinen FK** auf `users.id` (steht explizit als Kommentar in
der Partner-Route). Die Stats-Route zählt `totalMembers` aus Membership-Zeilen, holt die Niveaus
aber nur für existierende `users`-Zeilen → verwaiste Memberships fehlen in der Verteilung, die
Summe der Verteilung kann kleiner als `totalMembers` sein.

### 🟡 NIEDRIG — Semantischer Widerspruch: „Admin in der Suche“

Drei Stellen widersprachen sich:

| Stelle                                         | Aussage                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `app/api/partner-finder/route.ts`              | Admin **darf** als Spieler suchen (`member`/`trainer`/`admin` in `isPlayer`)      |
| `app/api/partner-finder/route.ts` (Kandidaten) | Kandidaten sind nur `member`/`trainer` — Admins tauchen **nicht** als Treffer auf |
| `app/api/admin/partner-finder/stats/route.ts`  | „Admins … sie verwalten, sie suchen nicht (saubere Rollentrennung)“               |
| `docs/handbook/glossary.md`                    | „nur für echte `member`/`trainer`-Mitglieder“                                     |

`docs/BUSINESS_RULES.md` und `docs/handbook/user/admin.md` sagen dagegen bereits korrekt:
**Ein Admin ist selbst Mitglied seines Vereins** (eine Zeile pro `(user, club)`) und darf die
persönliche Suche nutzen.

---

## Fix-Status (gleiches Datum umgesetzt)

| #   | Befund                            | Fix                                                                                               |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | KRITISCH — Member-Layout-Redirect | Rollen-Modus als Cookie (`swingz_role_mode`); `member/layout.tsx` respektiert den Modus           |
| 2   | HOCH — „Aktive Suchende“          | distinct `user_id` + echte Nicht-Leer-Prüfung über `availabilitySlots`                            |
| 3   | MITTEL — Hydration-Mismatch       | Modus vom Server als Prop übergeben (kein `localStorage`-Read im Initializer)                     |
| 4   | NIEDRIG — Verwaiste Memberships   | Orphans als `'unbekannt'` in die Verteilung gebuckelt                                             |
| 5   | NIEDRIG — Admin-in-der-Suche      | Regel **„Admin ist Spieler“** in Code + Docs durchgezogen (Kandidaten `member`/`trainer`/`admin`) |

Details und Nachweis: siehe Commit der Fixes; lebende Doku (`docs/BUSINESS_RULES.md`,
`docs/handbook/glossary.md`) ist im selben Zug aktualisiert.

---

## Zweiter Durchgang (gleiches Datum) — RLS-Audit der Suche

Nach dem ersten Fix-Zyklus wurde die Datenzugriffs-Ebene (RLS-Policies) der Spielpartner-Suche
geprüft. Ergebnis: **die persönliche Suche war für die Hauptzielgruppe (Mitglieder/Trainer)
funktional tot** — vorbestehend, nicht durch die Fixes verursacht.

### 🔴 KRITISCH (vorbestehend) — `matches: []` für Mitglieder & Trainer

Die Kandidaten-Abfrage in `GET /api/partner-finder` liest `user_club_memberships` mit dem
user-scoped Client. Die RLS-Policies auf dieser Tabelle geben einem Mitglied/Trainer **nur die
eigene Zeile** frei (`memberships_select`: `user_id = auth.uid() OR is_club_admin(club_id)`).
Nach `.neq('user_id', userId)` blieb eine **leere Kandidatenliste** → die Suche antwortete für
jedes Mitglied und jeden Trainer mit `{ matches: [] }`, ohne Fehlermeldung (RLS filtert still).
Nur Admins (is_club_admin → clubweit) konnten die Suche tatsächlich nutzen.

Dieselbe Falle blockierte die Verfügbarkeits-Dimension: `user_training_preferences` hat nur
`Users can view own preferences` + `Admins can view all preferences in club` — fremde Zeiten
waren für Mitglieder unsichtbar, `sharedSlots` blieb überall 0.

Das Repo kennt das Problem bereits und hat ein dokumentiertes Muster: `app/api/members/directory`
(„die RLS-Policy auf `user_club_memberships` gibt einem Mitglied nur die eigene Zeile frei, ein
Client-Query lieferte daher immer eine leere Liste") — Lösung dort: Service-Client + explizite
Autorisierung + minimale Spalten.

**Fix (gleiches Datum):** die beiden blockierten Abfragen (Kandidaten-Liste, Verfügbarkeit) der
persönlichen Suche laufen jetzt über `createServiceClient()`, mit der bereits vorhandenen
`isPlayer`-Autorisierung und strikter Spaltenwahl (`user_id` bzw. `user_id, weekly_availability`).
Kein DB-Schema-Change, kein neues RLS-Risiko über das Feature-Ziel hinaus (Vereins-Scheduling-
Daten, vergleichbar mit den clubweit sichtbaren Buchungen).

### ✅ Verifiziert — Admin in der Admin-Statistik korrekt mitgezählt

`GET /api/admin/partner-finder/stats` (Admin-RLS clubweit):

- **totalMembers:** Admin-Zeile (`role='admin'`, `is_active`) im Spieler-Pool — zählt mit. ✅
- **Niveau-Verteilung:** `skill_level` des Admins fließt ein; fehlendes Level und verwaiste
  Memberships werden als `'unbekannt'` gebuckelt, Summe = `totalMembers`. ✅
- **Aktive Suchende:** distinct `user_id` mit ≥ 1 Zeitfenster (`availabilitySlots`); der Admin
  zählt nur, wenn er Zeiten hinterlegt hat; Saison-Zeilen werden je User vereinigt. ✅
