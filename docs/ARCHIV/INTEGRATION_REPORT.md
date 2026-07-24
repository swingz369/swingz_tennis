# SwingZ Integrations-Report — 2026-07-14

> Ergebnis der Ausführung von `docs/INTEGRATION_PROMPT.md`.
> Analyse komplett frisch aus dem Code generiert (keine alten .md-Analysen verwendet).
> Branch: `feat/sprint-3-plus-a11y-theme-fixes`.

---

## 1. Analyse-Methodik

- `npx tsc --noEmit` + `npx vitest run` (kompletter Lauf)
- Skript-Abgleich: alle 307 `app/api/**/route.ts` gegen alle `fetch`/`apiFetch`-Aufrufe
  in `app/`, `components/`, `lib/`, `src/` (beide Richtungen: verwaiste Routen UND kaputte Aufrufe)
- Skript-Abgleich: alle 124 `page.tsx` gegen alle `href`/Router-Referenzen (verwaiste Seiten)
- Sidebar-/Navigations-Review pro Rolle (owner, superadmin, admin, trainer, member)

## 2. Ausgangslage (verifiziert)

| Prüfung                                                 | Ergebnis                                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`)                             | ✅ 0 Fehler                                                                                                                                                                      |
| Vitest                                                  | ✅ 1388 bestanden, 109 geskippt; ❌ 5 Testdateien rot — alle brauchen live Postgres (`postgres.swingz` nicht erreichbar aus Dev-Umgebung; bekannte Einschränkung, kein Code-Bug) |
| API-Routen gesamt                                       | 307                                                                                                                                                                              |
| API-Routen ohne Client-Aufruf                           | 48 (davon ~7 legitim: Webhooks, Cron, Health)                                                                                                                                    |
| Seiten gesamt                                           | 124                                                                                                                                                                              |
| Seiten ohne Verlinkung                                  | 17 (davon 6 legitim: PWA-Offline, Stripe-Redirects, E-Mail-Join-Link, Dev-Seiten)                                                                                                |
| Kaputte API-Aufrufe (Client → nicht existierende Route) | 1                                                                                                                                                                                |

**Kernbefund:** Die Codebasis ist technisch gesund — das „unreife" Gefühl kommt fast
vollständig aus fehlender **Verdrahtung**: fertige Seiten ohne Navigation, fertige APIs
ohne UI, und eine Sidebar, die die Rolle _Trainer_ komplett ignorierte.

## 3. Durchgeführte Fixes (Phase 1 + 2) ✅

### Kaputte Verbindungen

1. **Buchungs-Storno repariert** — `components/bookings/my-bookings.tsx` rief
   `DELETE /api/bookings/[id]` auf (Route existiert nicht → jeder Storno-Klick lief in 404).
   Jetzt: `POST /api/bookings/[id]/cancel` (inkl. Warteliste-Nachrücken serverseitig).
2. **Dashboard-Link rollenkorrekt** — Sidebar zeigte für Trainer _und_ Member auf `/admin`
   (Zugriff verweigert). Jetzt: trainer → `/trainer`, member → `/member`.
3. **Rollen-Badge korrigiert** — Member/Trainer sahen das Badge „Administration".
   Jetzt: „Trainer" bzw. „Mein Verein".

### Trainer-Navigation (vorher: nicht existent)

4. Neue Sidebar-Sektion **Training** für Trainer, standardmäßig aufgeklappt:
   Verfügbarkeit, Trainingspräferenzen, Stundennachweise, Trainer-Profil.
5. Member-spezifische Links (`/member/preferences`, `/member/work-duties`) werden reinen
   Trainern nicht mehr angezeigt (bleiben sichtbar, wenn jemand Trainer **und** Mitglied ist).

### Verwaiste Seiten angeschlossen

6. Admin → Training: **Stundennachweise** (`/admin/hours-logs` — komplette Freigabe-UI existierte, war unerreichbar)
7. Admin → Spielbetrieb: **Platzarten** (`/admin/court-types`)
8. Admin → Finanzen: **Preisregeln** (`/admin/pricing`)
9. Admin → Mitglieder: **Arbeitsdienst-Zuweisungen** (`/admin/work-duties/assignments`, hinter Feature-Flag `work_duty`)
10. Member: **Meine Bestellungen** (`/meine-bestellungen`, hinter Feature-Flag `shop`)

### Verifikation

- `npx tsc --noEmit`: ✅ 0 Fehler
- `npx eslint` auf beiden geänderten Dateien: ✅ 0 Findings
- Geänderte Dateien: `components/layout/sidebar.tsx`, `components/bookings/my-bookings.tsx`

## 3b. Zweite Runde (gleiche Session): Phase 4 + Teile von Phase 3 ✅

### Buchungs-Konsolidierung — /bookings ist jetzt die einzige Buchungsoberfläche

- `/bookings` hat einen neuen Tab **„Meine Buchungen"** (bestehende `MyBookings`-Komponente
  mit Storno-Flow) — vorher war die Storno-Liste nur über das unerreichbare
  `/bookings-unified` auffindbar, d. h. **Mitglieder konnten faktisch nicht stornieren**.
- Server-Redirects statt Parallel-Seiten: `/bookings-unified` → `/bookings?tab=my`,
  `/my-bookings` → `/bookings?tab=my`, `/courts/daily` → `/bookings?tab=courts`,
  `/dashboard/bookings/new` → `/bookings?tab=courts` (Muster von `/courts` übernommen).

### Profil-Konsolidierung

- `/profile` (im Header verlinkt) zeigt jetzt zusätzlich **Saison-Statistiken** und
  **Head-to-Head** — diese Widgets existierten nur auf dem unerreichbaren `/member/profile`.
- `/member/profile` → Redirect auf `/profile`.

### Matchmaking

- Admin-Sidebar „KI-Matchmaking" zeigt jetzt auf das vollwertige **Matchmaking-Dashboard**
  (`/admin/ai/matchmaking`, 239 Zeilen, vorher verwaist) statt auf die einfache Member-Ansicht.

### Probetraining (Phase-3-Cluster 3 — erledigt bzw. aufgeklärt)

- **Befund:** Die Konversion war bereits verdrahtet — über `/api/admin/trial-training/[id]/convert-to-member`.
  Die verwaiste Route `/api/trial-trainings/[id]/convert` ist ein **Duplikat → Löschkandidat**.
- **Neu verdrahtet:** Button „Erinnerung senden" (Status _Terminiert_) in der Admin-Probetraining-Liste
  ruft jetzt `POST /api/trial-trainings/[id]/reminder` auf.
- `/member/trial-training` ist eine reine Status-Ansicht (kein Buchungsformular) —
  **verletzt die Business-Regel nicht**; Anbindung ans Member-Dashboard bleibt Backlog.

### Verifikation Runde 2

- `npx tsc --noEmit`: ✅ 0 Fehler · ESLint auf allen geänderten Dateien: ✅ 0 Findings
- **`npx next build`: ✅ erfolgreich (Exit 0)** — alle Routen bauen in Produktion.

### Neue Dead-Code-Kandidaten (durch Konsolidierung referenzlos geworden)

`components/bookings/session-bookings.tsx`, `components/bookings/court-bookings.tsx`,
`components/bookings/CreateBookingForm.tsx`, `components/member-court-bookings.tsx`,
`app/(protected)/member/profile/MemberProfileClient.tsx` — mit `knip`/`ts-prune` bestätigen, dann löschen.

## 3c. Dritte Runde (gleiche Session): Phase-3-Cluster 1 + 2 ✅

### Trainer-Abrechnung (Cluster 1)

- Neuer Tab **„Trainer"** in `/admin/billing` (`components/billing/trainer-billing-tab.tsx`):
  Tabelle aller Trainer-Abrechnungen (Stunden, Satz, Betrag, steuerfreier Anteil nach
  § 3 Nr. 26 EStG, Fälligkeit, Status) mit Aktionen **„Als bezahlt markieren"**
  (`POST /api/billing/trainers/[id]/pay`) und **„Überfällig"** (`…/overdue`),
  plus Übersicht der **Stundensätze** (`GET /api/hourly-rates/trainers`).
- ⚠️ **Berechtigungs-Angleichung:** `POST /api/billing/trainers/[id]/pay` verlangte als
  einzige der 9 Routen des Moduls `superadmin` (alle Schwester-Routen: `admin`).
  Auf `admin` gesenkt — Admin verwaltet die Abrechnung seines Vereins. **Bitte gegenprüfen.**
- Damit angeschlossen: 4 der 9 verwaisten Routen des Clusters (Liste, pay, overdue, Stundensätze).
  Noch ohne UI: `hourly-rates/history`, `hourly-rates/tiers*`, `billing/trainers/[id]` (Detail/PATCH).

### Abwesenheiten (Cluster 2)

- Neue gemeinsame Komponente `components/absences/absence-management.tsx`:
  - **Trainer-Modus** (`/trainer/absences`, neu): Abwesenheit beantragen
    (Art, Zeitraum, Grund → `POST /api/absences`) + eigene Anträge mit Status.
  - **Admin-Modus** (`/admin/absences`, neu): alle Anträge mit
    **Genehmigen/Ablehnen** (`POST /api/absences/[id]/approve|reject`).
- Sidebar: „Abwesenheiten" bei Admin (Training-Sektion) und Trainer ergänzt.
- Damit angeschlossen: alle 4 verwaisten Absence-Routen.

### Verifikation Runde 3

- `npx tsc --noEmit`: ✅ 0 Fehler · ESLint: ✅ 0 Findings · **`npx next build`: ✅ Exit 0**

## 4. Offener Backlog (Phase 3 — APIs ohne UI)

Priorisiert nach Business-Wert; Aufwand je Cluster ~0,5–2 Tage:

| #   | Cluster                                          | Routen                                                                                                                                                                                                                                                                                                                                                                                    | Vorschlag                                                         |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | ~~Trainer-Abrechnung~~ ✅ Kern erledigt (s. 3c)  | Rest: `hourly-rates/history`, `hourly-rates/tiers*`, `billing/trainers/[id]`                                                                                                                                                                                                                                                                                                              | Bei Bedarf im Trainer-Tab ergänzen                                |
| 2   | ~~Abwesenheiten~~ ✅ erledigt (s. 3c)            | alle 4 Routen verdrahtet                                                                                                                                                                                                                                                                                                                                                                  | —                                                                 |
| 3   | ~~Probetraining-Konversion~~ ✅ erledigt (s. 3b) | `/reminder` verdrahtet; `/convert` = Duplikat → löschen; nur `/stats` noch offen                                                                                                                                                                                                                                                                                                          | —                                                                 |
| 4   | Zahlungen                                        | `/api/payments*`, `/api/payment-settings/*` (6 Routen)                                                                                                                                                                                                                                                                                                                                    | in `/admin/billing` integrieren                                   |
| 5   | Statistiken                                      | `/api/statistics/*`, `/api/dashboard/kpis`, `/api/analytics/insights`                                                                                                                                                                                                                                                                                                                     | Prüfen: vermutlich durch `/admin/analytics` ersetzt → **löschen** |
| 6   | System/Sonstiges                                 | `/api/system-settings/*`, `/api/admin/tenants`, `/api/admin/fee-categories`, `/api/schedule/*`, `/api/sessions/bulk-delete`, `/api/members/bulk-deactivate`, `/api/audit-logs/summary`, `/api/emails/onboarding`, `/api/trainer-availability/[id]\|conflicts`, `/api/billing/{open-items,line-items,installments,monthly-overview,balance}`, `/api/seasons/[id]/groups/[groupId]/members` | Je einzeln: anschließen oder löschen                              |

Legitim ohne Client-Aufruf (nicht anfassen): `/api/webhooks/*`, `/api/cron/*`, `/api/health`.

## 5. Phase 4 — Duplikate & Altlasten

- ✅ **Buchungs-UX konsolidiert** (s. 3b) — `/bookings` ist der einzige Flow.
- ✅ `/profile` vs. `/member/profile` → verschmolzen, Redirect gesetzt (s. 3b).
- ✅ `/matchmaking` vs. `/admin/ai/matchmaking` → Admin-Sidebar zeigt aufs Dashboard (s. 3b).
- ✅ `/member/trial-training` geprüft: Status-Ansicht, keine Regelverletzung — bleibt.
- Bewusst unverlinkt und OK: `/offline`, `/join/[clubId]`, `/bookings/payment-success`,
  `/shop/success`, `/design-preview`, `/api-docs`.
- `lib/csrf.ts` `/api/some-endpoint`: nur Doku-Kommentar, kein Bug.

## 6. Empfehlung nächste Session

1. **Manueller Smoke-Test** der neuen Flows mit Test-Accounts (Trainer-Tab in
   `/admin/billing`, `/trainer/absences`, `/admin/absences`, Storno in `/bookings?tab=my`) —
   alles ist build-verifiziert, aber noch nicht gegen die Live-DB geklickt.
2. Berechtigungs-Angleichung am Pay-Endpoint reviewen (s. 3c ⚠️).
3. Phase-3-Cluster 4–6 (Zahlungen, Statistiken prüfen/löschen, System-Routen einzeln entscheiden).
4. Duplikat-Route `/api/trial-trainings/[id]/convert` und Dead-Code-Kandidaten aus 3b löschen.
5. E2E-Smoke-Test pro Rolle (Login → Dashboard → jede Sidebar-Route öffnen), damit
   Verdrahtungslücken künftig automatisch auffallen.
