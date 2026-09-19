# UI-Einheitlichkeit — Analyse, Plan und Umsetzungsprompt

> Snapshot vom 19. September 2026, gemessen auf Branch `fix/mandantentrennung` (Stand `b176be76`).
> Folgeanalyse zu [`2026-09-17-ux-analyse-und-sanierungsprompt.md`](2026-09-17-ux-analyse-und-sanierungsprompt.md):
> Deren Phasen 1–6 (URL-Zustand, ein Kalender, Typo-Skala, Seitenrahmen, Bedienbarkeit,
> God-Komponenten) sind weitgehend umgesetzt — die Seiten wirken trotzdem noch uneinheitlich.
> Dieses Dokument misst, **warum**, und legt den Plan fest.
> Messgrundlage: `app/(protected)/` und `components/`, nur `*.tsx`.

---

## Teil 1 — Befund

### Die Diagnose in einem Satz

Der **Rahmen** ist inzwischen einheitlich (ein Layout, 1600-px-Deckel, Token-Guardrail grün,
Radius-Skala eingehalten) — uneinheitlich ist das, **was jede Seite in den Rahmen stellt**:
Für fast jedes wiederkehrende Muster (Seitenkopf, Kennzahl-Kachel, Tabelle, Leerzustand,
Bestätigung, Dialog) gibt es eine Standardkomponente **und** daneben handgebaute Varianten.
Welche Variante eine Seite nutzt, hängt davon ab, wann und von wem sie gebaut wurde — nicht von
einer Regel. Der Nutzer sieht das als „jede Seite sieht ein bisschen anders aus".

### 1.1 Was in Ordnung ist (nicht anfassen)

| Gemessen                                 | Wert                                             |
| ---------------------------------------- | ------------------------------------------------ |
| `npm run check:design` (Farben + Radius) | grün, läuft in CI                                |
| Radius                                   | nur `rounded-md` / `rounded-xl` / `rounded-full` |
| Tabs                                     | 21 Dateien, alle über shadcn `<Tabs>`            |
| Pagination                               | 11 × `PaginationNav`, 1 handgebaut               |
| Seitenwurzel-Abstand                     | 45 × `space-y-6`, nur 7 Ausreißer                |
| Kalender                                 | zerlegt in `components/calendar/*` (ADR-006)     |

### 1.2 Seitenkopf — der sichtbarste Bruch

84 echte Seiten (98 `page.tsx` minus 14 Redirect-Stubs):

| Titel kommt aus                            | Seiten                          |
| ------------------------------------------ | ------------------------------- |
| `PageHeader`                               | 55                              |
| eigenes `<h1>` in der Seite                | 9                               |
| eigenes `<h1>` in eingebundener Komponente | ~12                             |
| gar kein Titel                             | 1 (`/scheduler` — der Kalender) |

Das eigentliche Problem sind nicht die Zahlen, sondern die **Stile**. Es gibt **13
verschiedene `<h1>`-Klassenketten**. `PageHeader` setzt `font-display 30px semibold`, die
häufigste Handvariante ist `text-2xl font-bold text-primary` (8×) — also **grün, fett, kleiner,
andere Schrift**. Wer vom Admin-Dashboard (`premium-admin-hero`, 34 px) über die
Mitgliederliste (`PageHeader`, 30 px) zu „Meine Rechnungen" (`member-billing`, eigenes h1)
klickt, sieht drei verschiedene Überschriften-Systeme.

Betroffen — der **Mitgliederbereich ist am weitesten zurück**, weil seine Seiten fast alle
geteilte Komponenten aus `components/` rendern, die die Phase-4.1-Umstellung nicht erfasst hat:

| Seite                                                                                                                                      | Titel-Quelle                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `/billing`                                                                                                                                 | `components/member-billing.tsx` (h1)                            |
| `/profile`                                                                                                                                 | `components/member-profile.tsx` (h1)                            |
| `/notifications`                                                                                                                           | `components/notification-settings.tsx` (h1)                     |
| `/gamification`                                                                                                                            | `components/gamification-dashboard.tsx` (2× h1)                 |
| `/attendance-history`                                                                                                                      | `components/attendance-history.tsx` (h1)                        |
| `/trainer/availability`                                                                                                                    | `components/trainer-availability-manager.tsx` (h1)              |
| `/matches`                                                                                                                                 | `components/open-matches.tsx` (nur h2)                          |
| `/admin` Dashboard                                                                                                                         | `components/admin/premium-admin-hero.tsx` (h1, 34 px)           |
| `/trainer` Dashboard                                                                                                                       | `trainer-dashboard-client.tsx` (PageHeader-Klassen **kopiert**) |
| `member/leagues`, `select-admin-club`, `admin/leagues/[id]`, `admin/tournaments/[id]`, `admin/seasons/[id]`, `admin/seasons/[id]/planning` | eigenes h1 in der Seite                                         |

Die Detailseiten-Ausnahmen aus DESIGN.md § 6 („PageHeader kann nur Buttons, kein Badge /
Zurück / Status-Select") sind **eine Lücke in `PageHeader`, keine echte Ausnahme** — wird
`PageHeader` um einen `back`-Link, einen `badge`-Slot und einen freien `actions`-Knoten
erweitert, entfallen sie.

Zwischenüberschriften sind noch verstreuter: **30 verschiedene `<h2>`-Klassenketten**
(`text-lg font-semibold`, `text-lg font-bold`, `text-2xl font-bold text-foreground`,
`text-3xl font-bold` …). 19 × arbiträre Pixel-Schriftgrößen (`text-[15px]` usw.) umgehen die
Typo-Skala aus DESIGN.md § 4.2.

### 1.3 Dashboards — fünf Rollen, fünf Bauarten

| Dashboard     | Aufbau                                                            |
| ------------- | ----------------------------------------------------------------- |
| `/owner`      | `PageHeader` + 2 freie `Card`s, Kacheln handgebaut                |
| `/superadmin` | `PageHeader` + `Tabs` + 5 `Card`s                                 |
| `/admin`      | eigener Hero (34 px, Verlauf) + `KpiBand` + 4 `IconBox` + Heatmap |
| `/trainer`    | kopierte PageHeader-Klassen + 1 `Card`                            |
| `/member`     | `PageHeader` + 3 `Card`s, Kacheln handgebaut                      |

Es gibt `StatCard` (5 Nutzer) und `KpiBand` (5 Nutzer) — und daneben **41 Dateien**, die eine
Kennzahl als `text-2xl/3xl font-bold` in eine `Card` setzen. Das ist die häufigste Einzelursache
dafür, dass Übersichtsseiten unterschiedlich „dicht" und „laut" wirken.

### 1.4 Listen und Tabellen

- **19 Dateien** nutzen `<Table>` aus `components/ui/table`, **9 Dateien** bauen eine rohe
  `<table>` (u. a. `owner/audit`, `member/leagues`, `admin/hours-logs`,
  `seasons/[id]/preferences`, `planning/steps/{member-selector,finalize-step}`,
  `components/court-bookings-list.tsx`, `components/admin/{perf-history-client,dry-run-panel}`).
- Das vollständige Listenmuster — Suchfeld + Filter + Tabelle + `PaginationNav` — haben nur
  **2 Seiten**. 18 Dateien haben ein Suchfeld, 6 zusätzlich Filter-Selects, jede in eigener
  Anordnung.
- Mitglieder (`members-client.tsx`) und Trainer (`trainer-profile-management.tsx`, 787 Z.) sind
  dieselbe Art Liste und sind unterschiedlich aufgebaut.

### 1.5 Leerzustände

`EmptyState` (6 Dateien) und `ListState` (4) existieren — **16 Dateien** schreiben stattdessen
„Keine … gefunden/vorhanden" als losen Text (u. a. `owner/admins`, `superadmin/tenants`,
`admin/analytics`, `admin/members/family`, `settings/audit-logs-tab`, `decisions`,
`absence-management`, `partner-finder-panel`, `audit-log-viewer`). Mal zentriert mit Icon, mal
eine graue Zeile in der Tabelle, mal gar nichts.

### 1.6 Dialoge und Bestätigungen — zwei Systeme plus Browser-Popup

| Mechanismus                                    | Dateien        |
| ---------------------------------------------- | -------------- |
| `CenteredModal` (eigenbau)                     | 22             |
| shadcn `Dialog`                                | 8              |
| `ConfirmDialog` (auf `CenteredModal`)          | 10             |
| **`window.confirm()`** — natives Browser-Popup | **10 Stellen** |

`CenteredModal` dupliziert shadcn `Dialog` — genau das, was `CLAUDE.md` („niemals eigene
Duplikate bauen") verbietet. Beide sehen verschieden aus (Radius, Schatten, Kopfzeile,
Schließen-Knopf). Die 10 `confirm()`-Aufrufe öffnen ein **ungestyltes, im Dunkelmodus weißes
Browser-Fenster** mitten in der App: `admin/shop`, `admin/leagues` (+ `teams-tab`),
`billing/categories`, `work-duties`, `special-events`, `substitute-trainer-panel`,
`unified-court-calendar` (2×), `news-announcements`.

### 1.7 Ladezustände und Dunkelmodus

- `Loader2` in 74 Dateien, `Skeleton` in 27. Die Regel aus DESIGN.md § 6 (Spinner nur in
  Schaltflächen) gilt für `loading.tsx`, wird aber **innerhalb** von Client-Komponenten
  (Nachladen einer Karte, eines Tabs) nicht eingehalten.
- **1099 `dark:`-Überschreibungen**, davon ~450 der Form `bg-info-50 dark:bg-info-950` /
  `text-success-700 dark:text-success-300`. Die semantischen Farben haben keine
  „weiche Fläche"-Stufe, die im Dunkelmodus von selbst stimmt — also schreibt jede Datei das
  Paar von Hand, und jede ein bisschen anders. Dazu 52 × `dark:text-white` neben
  `text-foreground`, das im Dunkelmodus ohnehin hell ist (auch in `PageHeader` selbst).
- `shadow-sm` 69 / `shadow-md` 39 / `shadow-lg` 27 / `shadow-2xl` 12: keine Schattenregel.

### 1.8 Ursache

Die Guardrail (`scripts/check-design-tokens.sh`) prüft **Token** (Farben, Radius) — und genau
dort ist das Projekt sauber. Sie prüft **keine Muster**. Deshalb driften Muster, Token nicht.
Jede Aufräumrunde ohne maschinelle Prüfung verfällt wieder (vgl. AGENTS.md § 3a: „Prosa ohne
Prüfung ist keine Regel, sondern eine Bitte").

---

## Teil 2 — Plan

Grundsatz: **nichts Neues bauen.** Jede Zielkomponente existiert schon; der Plan erweitert
höchstens eine vorhandene um die fehlende Variante und stellt Handbauten darauf um. Jede Phase
ist ein eigener Branch, klein genug für einen Tag.

| Phase | Inhalt                                    | Umfang (Dateien)             | Wirkung                            |
| ----- | ----------------------------------------- | ---------------------------- | ---------------------------------- |
| 0     | Muster-Guardrail als Ratsche              | 1 Skript + DESIGN.md         | verhindert Rückfall                |
| 1     | Ein Seitenkopf                            | `PageHeader` + ~22           | **sehr hoch** — sieht jeder sofort |
| 2     | Bestätigungen und Dialoge                 | `CenteredModal` + 10         | hoch — Browser-Popups weg          |
| 3     | Kennzahl-Kacheln und Dashboards           | ~41 + 5 Dashboards           | hoch                               |
| 4     | Listen: Tabelle, Filter, Leerzustand      | 9 + 16 + Listen-Seiten       | mittel                             |
| 5     | Zwischenüberschriften und Schriftgrößen   | 30 h2-Varianten, 19 px-Werte | mittel                             |
| 6     | Weiche Statusflächen als Token (optional) | `globals.css` + ~450 Stellen | mittel, groß                       |

### Phase 0 — Muster-Guardrail (zuerst)

`scripts/check-design-tokens.sh` um **Muster-Zähler mit Obergrenze** erweitern (Ratsche: aktuelle
Zahl als Grenze, darf nur sinken — so läuft CI heute grün und jede Phase senkt die Grenze):

| Regel                                | Muster                                                  | Grenze heute        |
| ------------------------------------ | ------------------------------------------------------- | ------------------- |
| kein Browser-`confirm()`             | `\bconfirm\(` ohne `on`/`handle`-Präfix                 | 10                  |
| `<h1>` nur in `page-header.tsx`      | `<h1` außerhalb `components/ui/`, `landing`, `(public)` | ~21                 |
| keine rohe `<table>`                 | `<table` außerhalb `components/ui/table.tsx`            | 9                   |
| keine arbiträren Schriftgrößen       | `text-\[[0-9]+px\]` außerhalb `components/ui/`          | 19                  |
| kein `CenteredModal` außerhalb `ui/` | `<CenteredModal`                                        | 22 → 0 nach Phase 2 |

Dazu in `docs/DESIGN.md` einen Abschnitt **„Baukasten: ein Muster, eine Komponente"** — die
Tabelle aus Teil 2 unten, als lebende Regel (bestehendes Dokument ergänzen, kein neues).

### Phase 1 — Ein Seitenkopf

1. `PageHeader` erweitern, statt Ausnahmen zu dulden: optional `back?: { href, label }`,
   `badge?: ReactNode` neben dem Titel, `actions` akzeptiert zusätzlich einen `ReactNode`
   (Status-Select, Dropdown). `dark:text-white` am Titel entfernen (`text-foreground` reicht).
2. Alle Titel aus Teil 1 § 1.2 auf `PageHeader` umstellen. Geteilte Komponenten
   (`member-billing`, `member-profile`, …) bekommen ihren Titel **von der Seite**, nicht selbst —
   die Komponente rendert nur Inhalt.
3. `premium-admin-hero` und die Trainer-Kopie werden `PageHeader` mit Begrüßung als
   `description`; der Verlauf fällt weg.
4. `/scheduler` (Kalender) bekommt einen `PageHeader` („Kalender").
5. Ausnahmen-Absatz in DESIGN.md § 6 streichen; nur Bestätigungsseiten
   (`payment-success`, `shop/success`) bleiben ohne.

**Fertig, wenn:** `<h1` kommt außerhalb von `components/ui/page-header.tsx` in
`app/(protected)` und `components/` nicht mehr vor (Guardrail-Grenze 0).

### Phase 2 — Bestätigungen und Dialoge

1. **`CenteredModal` innen auf shadcn `Dialog` umbauen**, API unverändert — ein Datei-Diff, 22
   Nutzer ändern sich nicht, Fokusfalle und Escape kommen von Radix. Danach neue Stellen direkt
   mit `Dialog`; `CenteredModal` stirbt aus, wenn er ohnehin angefasst wird.
2. Die 10 `confirm()`-Stellen auf `ConfirmDialog` (Variante `destructive` für Löschen).

**Fertig, wenn:** Guardrail-Grenze `confirm()` = 0; ein Dialog aus Admin und einer aus dem
Mitgliederbereich sehen in beiden Themes gleich aus.

### Phase 3 — Kennzahl-Kacheln und Dashboards

1. Regel: **eine Reihe Kennzahlen = `KpiBand`**, einzelne hervorgehobene Kennzahl =
   `StatCard`. Die 41 Handbauten umstellen; wo `KpiBand` eine Variante fehlt (Trend, Link),
   `KpiBand` erweitern.
2. **Ein Dashboard-Aufbau für alle Rollen:**
   `PageHeader` (Begrüßung) → `KpiBand` (3–4 Werte) → Raster `lg:grid-cols-3`: Hauptinhalt
   `lg:col-span-2` (was heute ansteht), Seitenspalte (Schnellaktionen über `QuickActions`,
   Hinweise). Inhalte bleiben rollenspezifisch, das Gerüst ist gleich.

**Fertig, wenn:** Owner-, Superadmin-, Admin-, Trainer- und Mitglieder-Dashboard nebeneinander
als Geschwister erkennbar sind.

### Phase 4 — Listen

1. Die 9 rohen `<table>` auf `<Table>` (reine Planungsraster, die semantisch keine Tabelle sind,
   bewusst ausnehmen und im Code mit Begründung kommentieren).
2. **Listen-Seite als festes Muster:** `PageHeader` (Primäraktion rechts) → Filterleiste
   (`Input` mit Such-Icon links, Filter-`Select`s rechts, eine Zeile, mobil umbrechend) →
   `Table` ab `md`, Karten darunter → `PaginationNav` → `EmptyState` bei null Treffern.
   Referenzumsetzung: `admin/members/members-client.tsx`; Trainerliste als Erstes angleichen.
3. Die 16 handgebauten „Keine … gefunden"-Stellen auf `EmptyState` (ganze Fläche) bzw.
   `ListState` (innerhalb einer Karte/Tabelle). Wann welche: in DESIGN.md festhalten.
4. Nachladen innerhalb einer Karte: `Skeleton` statt `Loader2` (Spinner nur in Schaltflächen).

### Phase 5 — Zwischenüberschriften und Schriftgrößen

1. Abschnitte sind `Card` + `CardTitle`. Wo eine Überschrift außerhalb einer Karte steht:
   **eine** Klasse für `h2` (Vorschlag `font-display text-xl font-semibold tracking-tight`) —
   als Basisstil in `globals.css` (`@layer base h2`) statt in 30 Varianten.
2. 19 × `text-[NNpx]` auf die Skala aus DESIGN.md § 4.2 (ausgenommen `components/ui/`).
3. Schatten: `Card` = `shadow-sm`, schwebende Flächen (Dialog, Popover) = `shadow-lg`; alles
   andere weg. Grenze in die Guardrail.

### Phase 6 — Weiche Statusflächen (optional, nach 1–5)

In `globals.css` je Status eine Flächen- und Textstufe definieren, die im Dunkelmodus von
selbst stimmt (`bg-success-subtle`, `text-success-strong` o. ä.), und die ~450
`x-50 dark:x-950`-Paare ersetzen. Größter Einzelposten, rein mechanisch — lohnt erst, wenn die
Struktur steht. Ausbauweg, kein Muss.

### Der Baukasten (Zieltabelle für DESIGN.md)

| Muster                  | Komponente                                  | nicht mehr                      |
| ----------------------- | ------------------------------------------- | ------------------------------- |
| Seitentitel             | `PageHeader` (+ `back`, `badge`, `actions`) | eigenes `<h1>`, Hero-Blöcke     |
| Abschnitt               | `Card` + `CardTitle`                        | freie `<h2>` mit eigener Klasse |
| Kennzahlen-Reihe        | `KpiBand`                                   | `text-3xl font-bold` in `Card`  |
| einzelne Kennzahl       | `StatCard`                                  | —                               |
| Liste                   | Filterleiste + `Table` + `PaginationNav`    | rohe `<table>`                  |
| leer                    | `EmptyState` / `ListState`                  | loser „Keine …"-Text            |
| Dialog                  | shadcn `Dialog`                             | neue `CenteredModal`-Nutzer     |
| Bestätigung             | `ConfirmDialog`                             | `window.confirm()`              |
| Laden (Fläche / Aktion) | `Skeleton` / `Loader2` im Button            | Spinner als Flächen-Platzhalter |
| Status                  | `StatusBadge` nur bei Handlungsbedarf       | Badge als Dekoration            |

---

## Teil 3 — Der Prompt

> Ab hier wörtlich verwendbar. An ein Modell mit Repo-Zugriff geben, **eine Phase pro Auftrag**
> (Platzhalter `<PHASE>` ersetzen).

---

### Auftrag

Du vereinheitlichst Aufbau und Optik der Seiten von **SwingZ** (Next.js 16, Tailwind,
shadcn/ui). Diesmal: **Phase `<PHASE>`** aus
`docs/ARCHIV/2026-09-19-ui-einheitlichkeit-analyse-und-plan.md`, Teil 2.

Lies zuerst `CLAUDE.md`, `AGENTS.md` und `docs/DESIGN.md` §§ 4–6. Deren Regeln gehen vor.

### Nicht verhandelbar

- **Nichts neu bauen, was es gibt.** Zielkomponenten: `PageHeader`, `KpiBand`, `StatCard`,
  `EmptyState`, `ListState`, `ConfirmDialog`, `Dialog`, `Table`, `PaginationNav`,
  `QuickActions`, `Skeleton` — alle unter `components/ui/`. Fehlt eine Variante, erweitere die
  vorhandene Komponente; lege keine zweite daneben.
- **Verhalten bleibt gleich.** Du änderst Darstellung und Struktur, keine Fachlogik, keine
  API-Aufrufe, keine Texte außer wo die Regel es verlangt.
- **Deutsch** in allen UI-Texten; `apiFetch`, `createLogger`, `cn()` wie in `CLAUDE.md`.
- **Erst messen, dann ändern.** Die Zahlen im Dokument sind vom 19.09.2026 — zähle sie mit den
  Befehlen im Anhang nach und arbeite mit deiner Liste, nicht mit meiner.
- Ein Branch pro Phase (`ui/phase-<n>-<slug>`), kleine Commits pro Bereich
  (Admin / Trainer / Mitglied / Owner).

### Vorgehen

1. Betroffene Dateien per Befehl aus dem Anhang auflisten.
2. Falls die Phase eine Zielkomponente erweitert: zuerst die Komponente, mit einem kleinen
   `vitest`-Test für die neue Variante.
3. Dateien umstellen, Bereich für Bereich.
4. Guardrail-Grenze in `scripts/check-design-tokens.sh` auf den neuen Stand senken.
5. `docs/DESIGN.md` ergänzen (Regel + „Zuletzt verifiziert"-Datum), nicht ein neues Dokument.

### Prüfen, bevor du fertig meldest

- `npx tsc --noEmit` → 0 Fehler
- `npx vitest run` → grün
- `npm run check:design` → grün (mit gesenkter Grenze)
- `npm run docs:check` → grün
- Jede geänderte Seite im Browser (Dev-Server `localhost:3000`, Login aus der **Agent-Lane**
  `*.claude.test`, Claude Sandbox Alpha) in **hell und dunkel** und auf **375 px Breite**
  ansehen. Nutzer-Lane `*.swingz.test` nur lesen.

### Rückmeldung

Liste: umgestellte Dateien, bewusst ausgenommene Dateien mit Grund, neue Guardrail-Grenzen,
offene Punkte für die nächste Phase.

---

## Anhang — So wurden die Zahlen erhoben

Alle Befehle aus dem Repo-Root, Bereich `app/(protected)` und `components`, nur `*.tsx`.

| Aussage                  | Messung                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Seiten / Redirect-Stubs  | `find 'app/(protected)' -name page.tsx`; Stub = ≤ 12 Zeilen mit `redirect(`                            |
| Titel-Quelle je Seite    | `page.tsx` + Geschwister-`*.tsx` auf `PageHeader` / `<h1` geprüft, sonst eingebundene `@/components/*` |
| h1/h2-Varianten          | `grep -rhoE '<h1[^>]*className="[^"]*"'` → `sort \| uniq -c`                                           |
| Kennzahl-Handbauten      | Dateien mit `text-(2xl\|3xl) font-bold` und `<Card`, ohne `StatCard\|KpiBand`                          |
| rohe Tabellen            | Dateien mit `<table`, ohne `<Table[ >]`                                                                |
| Leerzustand-Handbauten   | `>\s*Keine [^<]*(gefunden\|vorhanden)`, ohne `EmptyState\|ListState`                                   |
| Browser-Bestätigung      | `\bconfirm\(` ohne `onConfirm`/`handleConfirm`                                                         |
| Dialog-Systeme           | Dateien mit `<CenteredModal` bzw. `<Dialog[ >]` (ohne `components/ui`)                                 |
| `dark:`-Überschreibungen | `grep -rhoE 'dark:[a-z-]+…' \| sort \| uniq -c`                                                        |
