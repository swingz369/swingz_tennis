# UX- & Workflow-Audit — SwingZ

> Datum: 15. Juli 2026 · Branch: `feat/sprint-3-plus-a11y-theme-fixes`
> Frische Analyse direkt am Code (keine bestehenden .md-Reports als Quelle).
> Baseline: 113 Seiten, `npx tsc --noEmit` = 0 Fehler (vor und nach den Fixes).

---

## 1. Der Analyse-Prompt

> **Rolle:** Du bist Vorstand und Geschäftsstelle eines Tennisvereins mit angeschlossener Tennisschule. Du willst den kompletten Vereinsbetrieb mit SwingZ online abbilden: Mitgliederverwaltung, Beiträge, Platzbuchung, Training/Saisonplanung, Turniere, Kommunikation. Trainer und Mitglieder nutzen die Plattform täglich.
>
> **Auftrag:** Analysiere das Projekt ausschließlich anhand des Codes (Routen, Navigation, Komponenten) — nicht anhand vorhandener Dokumentation. Beantworte für jede Rolle (Owner, Superadmin, Admin, Trainer, Mitglied):
>
> 1. **Erreichbarkeit:** Ist jede existierende Seite über Navigation, Dashboard oder Suche erreichbar? Welche Seiten sind verwaist (orphan)? Welche Links zeigen ins Leere (404)?
> 2. **Redundanz:** Gibt es mehrere Seiten/Features für denselben Zweck (Duplikate, Legacy-Reste)?
> 3. **Workflow-Vollständigkeit:** Kommt der Nutzer von seiner häufigsten Aufgabe (Mitglied: Platz buchen; Admin: Mitglied aufnehmen → Beitrag abrechnen; Trainer: Stunden erfassen) ohne Umwege ans Ziel — auf Desktop **und** Mobile?
> 4. **Konsistenz:** Sind Begriffe, Routen und Navigationsstrukturen einheitlich (Deutsch, gleiche Benennung für dieselbe Sache)?
>
> Priorisiere die Befunde nach Nutzerschaden, behebe alles was risikoarm sofort fixbar ist, und dokumentiere den Rest als priorisierte Empfehlungen.

## 2. Vorgehen

- Alle 113 `page.tsx`-Routen extrahiert und gegen **sämtliche** internen Link-Ziele (`href`, `router.push`, `redirect`) aus `app/`, `components/`, `lib/`, `src/`, `hooks/` abgeglichen → Orphan- und Dead-Link-Listen.
- Navigation pro Rolle geprüft: Desktop-Sidebar, Mobile-Bottom-Nav, Header, Command-Palette (Cmd+K), Rollen-Dashboards.
- Verdachtsfälle einzeln im Code verifiziert (Redirect? Duplikat? Legacy? Feature-Flag?).
- `tsc` + `eslint` vor/nach den Fixes.

## 3. Gesamtbild

Die Substanz ist besser als das Gefühl: Viele frühere Duplikate sind bereits sauber als Redirects konsolidiert (`/my-bookings`, `/courts`, `/bookings-unified`, `/member/profile`, `/admin/approvals` → zentrale Ziele). Das „Unrunde" kam aus vier konkreten Quellen:

1. **Tote Links** an prominenter Stelle (Owner-Dashboard „Verein anlegen" → 404).
2. **Legacy-Code-Inseln**: Ein komplettes Superadmin-Dashboard samt Club-/Tenant-Verwaltung lebte unverlinkt unter `/admin/*` — parallel zum echten `/superadmin/*`.
3. **Unerreichbare Features**: Fertige Seiten (Smart Court, erweiterte Suche, Gamification, Newsletter), die in keiner Navigation auftauchten.
4. **Desktop/Mobile-Asymmetrie**: Mitglieder hatten mobil einen „Buchen"-Tab, auf dem Desktop aber **keinen** Buchungslink in der Sidebar — die häufigste Aktion überhaupt.

## 4. Befunde & Status

### 4.1 Behoben (in dieser Session)

| # | Befund | Fix |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1 | **Owner:** „Verein anlegen" (2× auf `/owner`) verlinkte auf nicht existierendes `/owner/clubs/new` → 404 | Links auf `/owner/clubs?new=1`; die Clubs-Seite öffnet den Anlegen-Dialog jetzt automatisch bei `?new=1` |
| 2 | **Mitglied:** Kein „Platz buchen" in der Desktop-Sidebar (Mobile hatte es) | „Platz buchen" (`/bookings`) als erster Eintrag der Mitglieder-Navigation |
| 3 | **Admin:** Legacy-Superadmin-Block unter `/admin` — `/admin/dashboard` (laut eigenem Code „ONLY for superadmins"), `/admin/clubs`, `/admin/clubs/[clubId]/dashboard                             | billing`, `/admin/tenants`— 16 Dateien, ~1.700 Zeilen, nirgendwo verlinkt, enthielt zudem den toten Link`/admin/clubs/new` | Gelöscht. Echte Äquivalente existieren unter `/superadmin/*` |
| 4 | **Admin:** Duplikat Newsletter vs. E-Mail-Kampagnen: `/admin/newsletters` (246-Zeilen-UI, unverlinkt) vs. `/admin/email-campaigns` (in der Sidebar, funktionales Superset mit Empfängerauswahl) | `/admin/newsletters` → Redirect auf `/admin/email-campaigns` |
| 5 | **Admin:** Smart-Court-Seite (`/admin/smart-court`, echtes Feature mit Flag `smart_court`) war unerreichbar | In Sidebar-Sektion „Spielbetrieb" aufgenommen (Feature-Flag-gesteuert) |
| 6 | **Alle:** `/search` (erweiterte Suche mit Filtern) und `/gamification` (Erfolge/Ranglisten) unerreichbar | Als Einträge in die Command-Palette (Cmd+K) aufgenommen |
| 7 | **Toter Code:** `components/bookings/CreateBookingForm.tsx` + `lib/actions/booking.actions.ts` — 0 Importer, navigierten nach nicht existierendem `/dashboard/bookings` | Gelöscht |
| 8 | **Cache-Bug:** `revalidateTrainers()` invalidierte die nicht existierende Route `/admin/schedules` statt `/scheduler` | Pfad korrigiert |
| 9 | **Konvention:** `console.error` in `components/layout/sidebar.tsx` (Projektregel: nur `createLogger`) | Auf `createLogger('sidebar')` umgestellt |

**Verifikation:** `npx tsc --noEmit` → 0 Fehler, `eslint` auf allen geänderten Dateien → 0 Findings. (`.next`-Routen-Typen nach den Löschungen via `next typegen` regeneriert.)

**Fehlalarme (geprüft, kein Handlungsbedarf):** `/admin/items` (nur JSDoc-Beispiel), `/admin/trainers/[id]` (via Template-Literal verlinkt), `/attendance-history` (vom Trainer-Dashboard verlinkt), `/admin/audit-logs` (Inhalt ist als Tab in `/admin/settings` erreichbar), `/offline`, `/reset-password`, `/join/[clubId]`, `/sepa-mandate`, `/shop/success`, `/bookings/payment-success` (E-Mail-/Redirect-Ziele, bewusst unverlinkt).

### 4.2 Empfehlungen (priorisiert) — ✅ alle am 15.07.2026 umgesetzt, siehe Abschnitt 5

**P1 — Saisonplanung: drei fast gleichnamige Werkzeuge.**
`/admin/seasons/[id]/plan` (Plan-Liste), `/admin/seasons/[id]/planning` (Planungs-Wizard) und `/admin/season-plan/[id]` (Plan-Grid) sind drei getrennte Seiten mit austauschbar klingenden Namen — für einen Vereinsvorstand nicht unterscheidbar. Empfehlung: unter `/admin/seasons/[id]` als klar benannte Tabs bündeln („Planung starten", „Trainingsplan", „Rasteransicht") und die Alt-Routen als Redirects behalten.

**P2 — Navigation ist dreifach handgepflegt.**
Sidebar, Mobile-Bottom-Nav und Command-Palette definieren ihre Einträge jeweils separat — genau daraus entstand die Buchungslink-Lücke (Befund 2). Empfehlung: eine gemeinsame Nav-Konfiguration (`lib/navigation.ts`) mit Rollen-/Feature-Flag-Filter, aus der alle drei Oberflächen rendern.

**P3 — Zweck unklar, entscheiden statt liegen lassen:**

- `/member/trial-training`: Mitglieder sind bereits Mitglied — Seite unerreichbar. Entweder löschen oder als „Freunde zum Probetraining einladen" verlinken.
- `/members/[id]`: öffentliches Spielerprofil, unerreichbar. Entweder aus „Offene Spiele"/Matchmaking verlinken (Gegner-Profil ansehen — echter Mehrwert) oder löschen.
- `/admin/perf-history`: internes Performance-Tool — hinter Owner-Rolle verschieben oder löschen.
- `/api/admin/newsletters`: nach der Newsletter-Konsolidierung (Befund 4) eine API ohne UI — entfernen, falls E-Mail-Kampagnen eine eigene Route nutzen.

**P4 — Auffindbarkeit für Nicht-Power-User.**
Die globale Suche existiert nur hinter Cmd+K; der Header hat lediglich zwei Links. Ein sichtbares Suchfeld/-icon im Header (das die Palette öffnet) würde die Suche für normale Vereinsmitglieder erschließen.

**P5 — Mitglieder-Sidebar ist eine flache 12-Punkte-Liste.**
Admins haben gruppierte, einklappbare Sektionen; Mitglieder eine lange flache Liste (Stundenplan, Präferenzen, Nachrichten, Matchmaking, …). Gruppierung analog Admin („Spielen", „Training", „Verwaltung") würde die tägliche Orientierung verbessern — sinnvoll zusammen mit P2 umsetzen.

---

## 5. Umsetzung P1–P5 (15.07.2026, Folgesession)

| #      | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1** | Neue Komponente `components/admin/season-planning-tabs.tsx`: gemeinsame Tab-Leiste „Übersicht · Planungs-Wizard · Trainingsplan · Rasteransicht" auf allen vier Saisonplanungs-Seiten (`seasons/[id]`, `…/planning`, `…/plan`, `season-plan/[id]`). Die Routen bleiben unverändert (kein Redirect-Risiko), sind aber jetzt klar benannt und untereinander erreichbar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **P2** | Neue zentrale Nav-Config `lib/navigation.ts` (Sektionen je Rolle, Mobile-Tabs, Palette-Einträge, Feature-Flag-Gating). `sidebar.tsx`, `mobile-bottom-nav.tsx` und `command-palette.tsx` rendern jetzt daraus — die Sidebar dekoriert nur noch (Approval-Badge, Einladen-Aktion, Trainer-Zusammenführung). Neue Seite = ein Eintrag in einer Datei.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **P3** | • `/member/trial-training` heißt jetzt in der Mitglieder-Sidebar **„Freunde zum Probetraining einladen"** (Sektion „Mein Verein", Flag `trial_training`); die Seite bekam einen „Freunde einladen"-Button und der Empty-State-CTA zeigt aufs Probetraining-Formular `/trial-training` statt fälschlich auf die Platzbuchung `/bookings`. • `/members/[id]` **gelöscht** — Neubewertung ergab: RLS (`users_select_own`/`users_select_admin`) macht die Seite für Mitglieder ohnehin leer, sie war Demo-Qualität, zeigte E-Mail/Telefon und duplizierte `/admin/members/[id]`; ein datenschutzsicheres Spielerprofil wäre ein eigenes Feature. • `/admin/perf-history` bleibt als **bewusst unverlinktes** Engineering-Dashboard (CI-gekoppelt via `perf-bench.yml`), jetzt mit erklärendem Kommentar im Code. • `/api/admin/newsletters` **gelöscht** (E-Mail-Kampagnen nutzen `/api/email-campaigns`). |
| **P4** | Korrektur zum Audit: Der Desktop-Header **hatte** bereits eine prominente Suchleiste (Button war kein `<a href>`, daher von der Link-Analyse übersehen). Tatsächliche Lücke: Mobile (`hidden md:flex`) — dort gibt es jetzt einen Such-Icon-Button, der die Cmd+K-Palette öffnet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **P5** | Mitglieder-Sidebar von flacher 12-Punkte-Liste auf drei einklappbare Sektionen umgestellt (via bestehender `AdminSection`): **Spielen** (Platz buchen, Offene Spiele, Matchmaking, Turniere, Erfolge & Ranglisten — standardmäßig offen), **Training** (Stundenplan, Trainerstunde buchen, Trainingspräferenzen), **Mein Verein** (Nachrichten, Rechnungen, Dokumente, Arbeitsdienste, Probetraining-Einladung, Shop, Bestellungen, Board-Beschlüsse). Neu dadurch erreichbar: Turniere, Trainerstunde buchen, Erfolge (vorher nur Dashboard/Palette). Trainer sehen ihre eigene Trainingssektion plus „Spielen"/„Mein Verein"; Spieler-Präferenzen erscheinen für Trainer mit Member-Rolle als „Trainingspräferenzen (Spieler)".                                                                                                                                                                      |

**Verifikation:** `next typegen` (Routen-Typen nach Löschungen regeneriert), `npx tsc --noEmit` → 0 Fehler, `eslint` über alle 12 geänderten Dateien → 0 Findings, `npx vitest run` → alle Tests grün.

---

_Erstellt automatisiert am 15.07.2026. Alle Fixes aus Abschnitt 4.1 und die Umsetzungen aus Abschnitt 5 sind im Working Tree dieses Branches enthalten (nicht committet)._
