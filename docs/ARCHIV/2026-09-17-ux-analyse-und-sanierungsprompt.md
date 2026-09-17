# UX-/Kohäsions-Analyse und Sanierungsprompt

> Snapshot vom 17. September 2026. Alle Zahlen am Code gemessen, nicht aus bestehender Doku
> übernommen (ausdrückliche Vorgabe: vorhandene Dokumente könnten veraltet sein).
> Messgrundlage: `app/`, `components/`, `lib/`, `src/` ohne `node_modules`.

---

## Teil 1 — Befund

### Die Diagnose in einem Satz

Das Projekt ist **technisch korrekt und gestalterisch unentschieden**: `npx tsc --noEmit`
meldet null Fehler, Design-Tokens werden zu 98 % sauber verwendet — aber es gibt fünf
unabhängige Kalender-Implementierungen, keinen URL-Zustand, keine typografische Hierarchie
und keinen einheitlichen Seitenrahmen. Das Gefühl „unrund" ist kein Bauchgefühl, es ist
messbar.

### 1.1 Was tatsächlich in Ordnung ist

Damit der Sanierungsplan nicht Funktionierendes anfasst:

| Gemessen                       | Wert                          | Bewertung                          |
| ------------------------------ | ----------------------------- | ---------------------------------- |
| `npx tsc --noEmit`             | 0 Fehler                      | grün                               |
| Design-Tokens vs. rohe Farben  | 4688 Token-Klassen : 69 rohe  | 98,5 % sauber — Token-System steht |
| Toast-Feedback                 | 591 × `sonner`, 3 × `alert()` | praktisch einheitlich              |
| Formular-Labels                | 204 `<Input>` : 204 `<Label>` | 1:1, sauber                        |
| CSS-Variablen in `globals.css` | 164                           | vollständiges Token-Fundament      |

**Das Grundgerüst steht wirklich.** Die Schwäche liegt eine Ebene darüber: in der
Zusammensetzung.

### 1.2 Optik — warum es „nicht gut aussieht"

Der stärkste Einzelbefund:

```
text-sm   1128  ┃████████████████████████████████████████████
text-xs    955  ┃█████████████████████████████████████
text-lg    154  ┃██████
text-2xl   130  ┃█████
text-base  113  ┃████
text-xl     77  ┃███
```

**79 % aller Textklassen sind `text-sm` oder `text-xs`** (2083 von 2624). Nur 113 ×
`text-base`. Das heißt: Es gibt praktisch keine Grundschriftgröße — die Anwendung spricht
durchgehend im Flüsterton auf 12–14 px. Wo alles gleich klein ist, entsteht keine Hierarchie,
und ohne Hierarchie wirkt jede Seite wie eine Tabelle statt wie ein Produkt.

Verstärkt durch die Abstände:

```
gap-2   792   gap-1   447   gap-3   358   gap-4   182
```

`gap-2`/`gap-1` (8 px/4 px) stellen mit 1239 Treffern die Mehrheit. Kleine Schrift **und**
enge Abstände ergeben zusammen den gedrängten, werkzeughaften Eindruck. Dazu 234 `<Badge>`
über 146 Dateien mit Karten — die Oberfläche ist mit Statusfarbtupfern übersättigt.

### 1.3 Seitenrahmen — warum es „unrund wirkt"

| Gemessen                     | Wert       | Folge                                          |
| ---------------------------- | ---------- | ---------------------------------------------- |
| Seiten (`page.tsx`)          | 122        | —                                              |
| davon mit gemeinsamem Header | 58         | 35 weitere bauen ein eigenes `<h1>`            |
| Breadcrumbs                  | **3**      | Routen sind bis zu 5 Ebenen tief               |
| `loading.tsx`                | 67 von 122 | 55 Seiten springen ohne Zwischenzustand um     |
| `error.tsx`                  | 23 von 122 | 99 Seiten haben keine eigene Fehlerdarstellung |
| `not-found.tsx`              | **1**      | —                                              |

Dazu die Container-Breiten: `max-w-7xl` (38) neben `max-w-3xl` (23), `max-w-2xl` (24),
`max-w-md` (37). **Der Inhalt springt beim Seitenwechsel horizontal** — der verlässlichste
Weg, eine Anwendung billig wirken zu lassen, auch wenn jede Seite für sich passabel ist.

Ladezustände existieren in zwei konkurrierenden Sprachen: `Loader2`-Spinner in 77 Dateien,
`Skeleton` in 25. Und die Mikrotexte sind dreifach geschrieben: `Laden` (21×), `Laden…` (11×),
`Laden...` (5×) — samt Varianten wie „Laden der Vereine" / „Lade Mitglieder…".

### 1.4 Die Kalender — der eigentliche Schaden

Die beiden vom Nutzer benannten Schwachstellen sind Symptome einer Zersplitterung. Es gibt
**fünf voneinander unabhängige Datums-Raster**:

| Datei                                             | Zeilen   | Zweck                      |
| ------------------------------------------------- | -------- | -------------------------- |
| `components/unified-court-calendar.tsx`           | **2684** | Platzkalender, 4 Ansichten |
| `app/(protected)/bookings/page.tsx`               | 579      | eigenes Monatsraster       |
| `lib/season-planning/schedule-grid.tsx`           | 515      | Stundenplan-Raster         |
| `app/(protected)/member/trainer-booking/page.tsx` | 474      | eigenes Wochenraster       |
| `lib/season-planning/season-calendar-view.tsx`    | 409      | Gruppen × Wochen-Matrix    |

Eine gemeinsame Hülle existiert bereits — `components/calendar/CalendarShell.tsx`, 80 Zeilen —
**wird aber nur von einem einzigen Wrapper benutzt**. Die Konsolidierung wurde begonnen und
liegen gelassen.

**Der Platzkalender** (`unified-court-calendar.tsx`) ist eine God-Komponente: ~25 `useState`,
vier Ansichtsmodi, drei Rollenvarianten, Drag & Drop, Wetter, Sperren und Saisonplan in einer
Datei. Beide Einstiege (`/scheduler`, `/admin/courts`) rendern sie **ohne Props** — der
Parameter `defaultView` ist damit tot, jeder landet immer in der Agenda-Ansicht.

Darin steckt außerdem ein Verstoß gegen ADR-005: ein direkter Supabase-Zugriff aus der
Client-Komponente heraus, der den Trainer per E-Mail-Textvergleich sucht —

```ts
sb.from('trainers').select('id').ilike('email', data.user.email).maybeSingle();
```

Kein Repository, kein Service, und `ilike` auf einer E-Mail als Identitätsschlüssel.

**Halb fertige Konsolidierung, belegt:** `app/(protected)/courts/daily/page.tsx` trägt den
Kommentar „Tagesansicht lebt im Platz-Kalender-Tab von `/bookings`" — und leitet im Code nach
`/scheduler` weiter. Kommentar und Verhalten widersprechen sich; `/bookings` und `/scheduler`
sind zwei verschiedene Kalender, beide erreichbar.

### 1.4a Entscheidung des Auftraggebers (17.09.2026)

> „Es soll tatsächlich nur einen einzigen Kalender für jede Rolle geben. Dort werden Trainings
> in der Saison angezeigt, aber es können auch freie Slots gebucht werden für Spielen auf dem
> Platz, oder eben Platzsperren erfolgen usw."

Das ist umsetzbar, **ohne etwas Neues zu bauen** — denn `unified-court-calendar.tsx` ist
genau dafür bereits angelegt und kann heute schon:

| Anforderung                 | Vorhanden als                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Saison-Trainings anzeigen   | `visiblePlanSlots` aus `useSeasonPlanGrid`                                             |
| Freie Slots buchen          | `handleBookSlot` → `useCreateBooking`                                                  |
| Platzsperren setzen         | `blockDialog` + `components/block-court-dialog.tsx`                                    |
| Ad-hoc-Training (Trainer)   | `adHocDialog` + `components/ad-hoc-session-dialog.tsx`                                 |
| Rollenabhängige Sicht       | `visibleSessions` (Admin alles / Trainer eigene / Mitglied Gruppen + eigene Buchungen) |
| Stornieren, Wetter, Sperren | vorhanden                                                                              |

Die Prüfung der beiden Konkurrenten zeigt, dass die Aufräumarbeit klein ist:

- **`/bookings` Tab „Platz buchen"** ist ein 7-Spalten-**Monatsraster** — die einzige Ansicht,
  die der Platzkalender (`agenda | weekly | daily | list`) noch nicht hat. Plus ein
  CSV-Export. Das sind die einzigen zwei Dinge, die dort übernommen werden müssen.
- **`/bookings` Tab „Meine Buchungen"** enthält `MyBookings` (280 Z.) und `MyGroups` (94 Z.) —
  beide mit **null** Datums-Raster-Code. Das sind reine Listen und damit kein Konkurrent zum
  Kalender, sondern eine eigenständige, legitime Ansicht.
- **`/member/trainer-booking`** (474 Z.) bucht keine Plätze, sondern **Trainerstunden** — eine
  vierte Slot-Quelle, die in denselben Kalender gehört statt in eine eigene Seite.

### 1.5 Kein URL-Zustand — der unterschätzte Killer

`components/unified-court-calendar.tsx`: **0 Treffer** für `useSearchParams`, `router.replace`,
`router.push`. Ansichtsmodus, Datum, Wochen- und Platzauswahl leben ausschließlich im
`useState`. Konsequenz für den Verein:

- Neu laden → alles zurück auf Agenda/heute.
- Kalenderwoche an den Trainer schicken → er sieht eine andere Woche.
- Browser-Zurück → verlässt den Kalender, statt einen Schritt zurückzugehen.

Der **Saisonplanungs-Wizard** hat denselben Fehler in schlimmerer Form: `page.tsx` liest
`?step=` aus der URL und reicht es als `initialStep` durch, aber `goToStep` in
`wizard-context.tsx` schreibt **nie** zurück. Wer in Schritt 3 den Plan generiert und die
Seite neu lädt, steht wieder in Schritt 1 — **der generierte Plan ist weg**, weil der gesamte
Wizard-Zustand im Reducer liegt und nirgends persistiert wird. Das ist bei einem Vorgang, der
einen Cluster-Algorithmus über eine ganze Saison laufen lässt, der teuerste mögliche
Datenverlust.

### 1.6 Barrierefreiheit

95 Buttons mit `size="icon"`, davon rund **11 mit `aria-label` oder `sr-only`**. Etwa 84
Schaltflächen ohne zugängliche Beschriftung. Das trifft nicht nur Screenreader — diese Buttons
haben meist auch keinen Tooltip, sind also für sehende Erstnutzer ebenso stumm.

### 1.7 God-Komponenten

```
2684  components/unified-court-calendar.tsx
1730  .../leagues/[id]/league-detail-client.tsx
1636  .../trainers/[id]/trainer-detail-client.tsx
1319  .../courts/courts-manage-client.tsx
1284  .../members/[id]/members-detail-client.tsx
1241  .../work-duties/work-duties-client.tsx
1175  .../shop/page.tsx
1136  .../messages/page.tsx
```

88 019 Zeilen TSX gesamt. Acht Dateien über 1000 Zeilen sind der Grund, warum jede Änderung an
einer Stelle an drei anderen etwas kaputt macht.

### 1.8 Was nicht das Problem ist

Damit die Sanierung nicht am falschen Ende ansetzt — folgende naheliegende Verdächtigungen
haben sich bei der Prüfung **nicht** bestätigt:

- **Doppelte Routen:** `/bookings-unified`, `/my-bookings`, `/courts`, `/courts/daily`,
  `/training-schedule`, `/dashboard/bookings/new` sind bereits 5–8-zeilige `redirect()`-Seiten.
  Die Konsolidierung hat stattgefunden, nur nicht zu Ende.
- **Fehlende Stapelverarbeitung im Saisonkalender:** `POST /api/seasons/[id]/calendar/toggle`
  akzeptiert `week_mondays: string[]`, und die Oberfläche nutzt das bereits für ganze
  Gruppenzeilen. Was fehlt, ist die Spaltenaktion („Ferienwoche für **alle** Gruppen aus") —
  nicht die gesamte Fähigkeit.
- **Ferien:** sind im Saisonkalender gelb hinterlegt und mit Namen im Tooltip vorhanden.
- **Verschluckte Fehler:** projektweit nur ein nennenswertes stilles `catch`.

---

## Teil 2 — Der Prompt

> Ab hier wörtlich verwendbar. An ein Modell mit Repo-Zugriff geben.

---

### Auftrag

Du sanierst **SwingZ**, ein Tennisverein-Verwaltungs-SaaS (Next.js 16, Supabase, Stripe),
von „funktioniert" zu „verkaufsfertig". Das technische Fundament ist intakt — `tsc` ist grün,
das Design-Token-System ist zu 98 % konsequent umgesetzt, die Routen-Konsolidierung hat
begonnen. **Dein Auftrag ist nicht, neu zu bauen, sondern zusammenzuführen, zu verdichten und
zu Ende zu bringen.**

Lies zuerst `CLAUDE.md` und `AGENTS.md` im Repo-Root. Deren Regeln gelten uneingeschränkt und
stehen über allem, was hier steht.

### Nicht verhandelbar

- **Nichts neu bauen, was schon existiert.** `CalendarShell`, `PageHeader`, die shadcn/ui-
  Komponenten, die Design-Tokens, das Bulk-Toggle-API: alles vorhanden. Erst suchen, dann
  schreiben.
- **Kein Parallel-Dokument, keine Parallel-Komponente.** Ein zweiter Kalender neben dem
  bestehenden ist genau der Fehler, der diese Sanierung nötig gemacht hat.
- **Alle UI-Texte auf Deutsch.** Keine Stack-Traces in der Oberfläche.
- **`npx tsc --noEmit` muss nach jeder Phase 0 Fehler liefern.** Ebenso `npx vitest run`.
- **Schreibende Tests nur in der Agent-Lane** (`*.claude.test`, Claude Sandbox Alpha/Beta).
  Die `*.swingz.test`-Vereine gehören dem Menschen: nur lesen.
- **Eine Phase, ein Branch, ein Merge.** Kein Arbeitsstand älter als eine Woche außerhalb von
  `main`.

### Arbeitsweise

Vor jeder Phase: den betroffenen Code selbst lesen und den Ist-Zustand messen. Die Zahlen in
diesem Dokument sind vom 17.09.2026 — prüfe sie nach, statt sie zu glauben. Nach jeder Phase:
`tsc`, `vitest`, und die geänderten Seiten in **beiden** Themes und auf **Mobilbreite**
ansehen.

Wo du eine Vereinfachung mit bekannter Obergrenze einbaust, markiere sie im Code mit einem
`ponytail:`-Kommentar, der die Grenze und den Ausbauweg benennt.

---

### Phase 1 — Zustand gehört in die URL

_Die kleinste Änderung mit der größten spürbaren Wirkung. Zuerst, weil sie unabhängig von
allem anderen ist._

1. **Saisonplanungs-Wizard** (`lib/season-planning/wizard-context.tsx`,
   `app/(protected)/admin/(gated)/seasons/[id]/planning/`):
   `goToStep`/`nextStep`/`prevStep` schreiben den Schritt per `router.replace` nach `?step=`.
   Der generierte Plan darf einen Reload überleben — persistiere das Ergebnis des
   Cluster-Laufs serverseitig (die Saison hat bereits einen `planning_status`), nicht im
   Reducer. Browser-Zurück muss einen Wizard-Schritt zurückgehen.
2. **Platzkalender** (`components/unified-court-calendar.tsx`): Ansichtsmodus, Datum/Woche und
   Platzauswahl in die URL (`?view=&date=&court=`). Eine geteilte Kalender-URL muss beim
   Empfänger dieselbe Ansicht zeigen.
3. Den toten `defaultView`-Parameter entweder durch die aufrufenden Seiten füttern oder
   entfernen.

**Fertig, wenn:** Neu laden, Zurück-Taste und Link-Teilen in Wizard und Platzkalender das tun,
was ein Nutzer erwartet. Ein `vitest`-Test hält den Wizard-Schritt-Roundtrip fest.

---

### Phase 2 — **Ein** Kalender

_Der eigentliche Grund für „das Zusammenspiel ist unsauber". Die Produktentscheidung ist
getroffen (siehe § 1.4a) — du setzt sie um, du triffst sie nicht neu._

**Zielbild: genau ein Kalender für alle Rollen.** Er zeigt die Trainings der laufenden Saison,
lässt freie Slots zum Spielen buchen, erlaubt Platzsperren und Ad-hoc-Trainings — und was
davon sichtbar und bedienbar ist, entscheidet die Rolle des angemeldeten Nutzers, nicht die
Route.

**Basis ist `components/unified-court-calendar.tsx`.** Nicht neu schreiben: Saisonplan-Overlay,
Buchen, Sperren, Ad-hoc-Sessions und die Rollenfilterung sind dort bereits implementiert.

#### 2.1 Zusammenführen

1. **Monatsansicht übernehmen.** Der Kalender kennt `agenda | weekly | daily | list`. Das
   7-Spalten-Monatsraster aus `app/(protected)/bookings/page.tsx` kommt als fünfter Modus
   `month` dazu — samt dem dortigen CSV-Export. Danach hat `/bookings` keinen eigenen
   Kalendercode mehr.
2. **Trainerstunden als vierte Slot-Quelle.** `app/(protected)/member/trainer-booking/page.tsx`
   bucht Trainerstunden, keine Plätze. Diese Slots gehören neben Sessions, Planeinträgen und
   Sperren in dasselbe Raster, visuell unterscheidbar. Die Seite entfällt danach.
3. **Listen sind kein Kalender.** `MyBookings` (280 Z.) und `MyGroups` (94 Z.) enthalten kein
   Datums-Raster und bleiben erhalten — als eigene Ansicht „Meine Buchungen", nicht als
   konkurrierender Einstieg. Verlinke sie vom Kalender aus.
4. **Eine Route.** Entscheide dich für **einen** Pfad (`/kalender` ist ehrlicher als
   `/scheduler`) und lass `/bookings`, `/scheduler`, `/courts`, `/courts/daily`,
   `/my-bookings`, `/bookings-unified`, `/training-schedule`, `/dashboard/bookings/new` und
   `/member/trainer-booking` **alle** dorthin zeigen. Löse dabei den Widerspruch in
   `app/(protected)/courts/daily/page.tsx` auf (Kommentar sagt `/bookings`, Code leitet nach
   `/scheduler`). Im Admin-Bereich bleibt die Einbettung als Tab erlaubt — aber es ist
   dieselbe Komponente, kein zweiter Kalender.
5. **`defaultView` zum Leben erwecken.** Beide Einstiege rendern heute `<UnifiedCourtCalendar />`
   ohne Props, der Parameter ist tot. Sinnvolle Vorgabe je Rolle: Mitglied → `agenda`,
   Trainer → `weekly`, Admin → `weekly`. Überschreibbar per URL (Phase 1).

#### 2.2 Zerlegen

2684 Zeilen, ~25 `useState`, fünf Ansichtsmodi und drei Rollenvarianten in einer Datei sind
nach der Zusammenführung nicht weniger geworden. Trenne:

- eine Datei je Ansichtsmodus (`month`, `weekly`, `daily`, `agenda`, `list`),
- den Zustand in einen Reducer oder Hook (`useCalendarState`),
- die Rollenlogik (`visibleSessions`, `visiblePlanSlots`) in einen eigenen Hook — sie ist die
  sicherheitsrelevanteste Stelle und gehört testbar isoliert.

Zielgröße je Datei: **unter 400 Zeilen**. Die gemeinsame Hülle ist das vorhandene
`components/calendar/CalendarShell.tsx` (80 Z., bislang von genau einem Wrapper benutzt):
Kopfzeile mit Navigation, Zeitachse, Lade- und Leerzustand, Mobilverhalten, Tastaturbedienung.

#### 2.3 Zwingend mit erledigen

- **Direkten Supabase-Zugriff aus der Client-Komponente entfernen:**
  `sb.from('trainers').select('id').ilike('email', …)` löst die Trainer-Identität über einen
  E-Mail-Textvergleich auf. Das verletzt ADR-005 und gehört hinter Route → Service →
  Repository, aufgelöst über die ID.
- **Die beiden Saisonplanungs-Raster** (`schedule-grid.tsx` 515 Z., `season-calendar-view.tsx`
  409 Z.) bleiben eigenständig — sie planen, sie buchen nicht. Aber sie setzen auf dieselbe
  `CalendarShell` auf, damit Navigation, Leerzustand und Mobilverhalten identisch sind.

**Fertig, wenn:** Es gibt genau eine Kalender-Route. Jede Rolle sieht dort Saison-Trainings,
freie Slots und Sperren in einem Raster. Kein Datums-Raster mehr ohne `CalendarShell`, keine
Kalenderdatei über 400 Zeilen. Ein Test hält je Rolle fest, was sichtbar ist.

---

### Phase 3 — Typografie und Dichte

_Hier entscheidet sich, ob es „gut aussieht"._

Gemessen: 79 % aller Textklassen sind `text-sm`/`text-xs`, nur 113 × `text-base`. `gap-1`/
`gap-2` stellen die Mehrheit aller Abstände.

1. **Lege eine Typo-Skala fest** und schreib sie in `docs/DESIGN.md` (bestehendes lebendes
   Dokument, nicht daneben ein neues): Fließtext `text-base`, Sekundärtext `text-sm`,
   `text-xs` **nur** für Metadaten wie Zeitstempel und Zähler. Definiere die Stufen als
   Komponenten oder Token, nicht als Merksatz.
2. **Arbeite die Anwendung Bereich für Bereich durch** — Admin, Trainer, Mitglied, Owner.
   Priorität nach Nutzungshäufigkeit: Dashboards und Listen zuerst.
3. **Abstände atmen lassen:** In Karten und Formularen ist `gap-3`/`gap-4` die Regel, `gap-1`/
   `gap-2` die Ausnahme für echte Gruppen zusammengehöriger Elemente.
4. **Badges reduzieren.** 234 Stück. Behalte sie für Status mit Handlungsbedarf; alles andere
   wird Text.

**Fertig, wenn:** Auf einer beliebigen Seite ist ohne Nachdenken erkennbar, was Überschrift,
was Inhalt und was Metadatum ist. Beide Themes geprüft.

---

### Phase 4 — Ein Seitenrahmen

_122 Seiten, 58 mit gemeinsamem Header, 35 mit eigenem `<h1>`, 3 mit Breadcrumb._

1. **Ein Seitenrahmen für alle geschützten Seiten:** Titel, optionale Beschreibung, optionale
   Aktionen rechts, einheitlicher Außenabstand. Die 35 Seiten mit eigenem `<h1>` ziehen nach.
2. **Eine Inhaltsbreite je Seitentyp.** Derzeit konkurrieren `max-w-7xl` (38×), `max-w-md`
   (37×), `max-w-2xl` (24×) und `max-w-3xl` (23×). Lege fest: Listen/Tabellen breit,
   Formulare/Detailseiten schmal — und halte es durch. Der Inhalt darf beim Seitenwechsel
   nicht horizontal springen.
3. **Breadcrumbs überall dort, wo die Route tiefer als zwei Ebenen geht.** Aktuell 3 von 122;
   Routen gehen bis `admin/seasons/[id]/preferences/new`.
4. **Lade- und Fehlerzustände vervollständigen:** 67 von 122 Seiten haben `loading.tsx`, 23
   haben `error.tsx`, eine einzige `not-found.tsx`. Entscheide dich außerdem zwischen Spinner
   (77 Dateien) und Skeleton (25) — Skeleton für Inhaltsflächen, Spinner nur für Aktionen in
   Schaltflächen.
5. **Mikrotexte vereinheitlichen:** `Laden` (21×), `Laden…` (11×), `Laden...` (5×) plus
   Varianten. Eine Schreibweise, projektweit.

**Fertig, wenn:** Jede geschützte Seite hat Rahmen, Lade- und Fehlerzustand. Der Wechsel
zwischen zwei Seiten bewegt den Inhalt nicht seitwärts.

---

### Phase 5 — Bedienbarkeit

1. **95 Icon-Buttons, ~11 beschriftet.** Jeder `size="icon"`-Button bekommt `aria-label` **und**
   Tooltip. Das hilft Screenreadern und Erstnutzern gleichermaßen.
2. **Tastaturbedienung im Kalender:** Pfeiltasten bewegen die Auswahl, Enter öffnet, Escape
   schließt. Drag & Drop braucht eine Tastatur-Alternative — die `dnd-kit`-Sensoren sind schon
   eingerichtet, die Bedienung fehlt.
3. **Fokus sichtbar** auf allen interaktiven Elementen, in beiden Themes.
4. **Leerzustände mit Weg nach vorn:** Jede leere Liste sagt, was zu tun ist, und bietet die
   Aktion an — nicht nur „Keine Daten".
5. **Spaltenaktion im Saisonkalender:** Das Bulk-API (`week_mondays: string[]`) wird bereits
   für ganze Gruppenzeilen genutzt. Ergänze die Wochen-Spalte („Diese Woche für alle Gruppen
   aussetzen") — der häufigste reale Vorgang sind Schulferien.

**Fertig, wenn:** Platzkalender und Saisonplanung sind vollständig ohne Maus bedienbar.

---

### Phase 6 — Die restlichen God-Komponenten

Nach dem Kalender bleiben sieben Dateien über 1000 Zeilen:
`league-detail-client` (1730), `trainer-detail-client` (1636), `courts-manage-client` (1319),
`members-detail-client` (1284), `work-duties-client` (1241), `shop/page` (1175),
`messages/page` (1136).

Zerlege sie **nur da, wo du ohnehin arbeitest** — nicht als Selbstzweck. Trennlinie: ein Tab,
ein Dialog, eine Tabelle = eine Datei. Fachlogik in Hooks.

**Fertig, wenn:** Keine Datei über 800 Zeilen, ohne dass sich das Verhalten geändert hat.

---

### Definition of Done

Das Projekt ist produktionsreif, wenn ein Vereinsvorstand ohne Einweisung:

1. eine Saison von der Anlage bis zur Veröffentlichung durchplanen kann — und ein
   versehentlicher Reload ihn nicht die Arbeit kostet,
2. den Platzkalender als Link an einen Trainer schicken kann und beide dieselbe Ansicht sehen,
3. auf jeder Seite ohne Zögern weiß, wo er ist und wie er zurückkommt,
4. die Anwendung auf dem Telefon bedienen kann,
5. auf keinem Bildschirm eine englische Zeichenkette, einen Stack-Trace oder einen
   Ladezustand ohne Ende sieht.

Nach jeder Phase: `npx tsc --noEmit` (0 Fehler), `npx vitest run` (grün), `npm run docs:check`
(grün), beide Themes und Mobilbreite geprüft.

---

## Anhang — So wurden die Zahlen erhoben

Alle Werte am 17.09.2026 gegen `main` gemessen, jeweils über `app components lib src` ohne
`node_modules`:

| Aussage                         | Messung                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Typografie-Verteilung           | `grep -rho 'text-\(xs\|sm\|base\|lg\|xl\|2xl\|3xl\|4xl\|5xl\)'`                               |
| Token vs. rohe Farben           | `grep -rho '\(text\|bg\|border\)-\(primary\|muted\|…\)'` gegen `-\(red\|gray\|…\)-[0-9]{2,3}` |
| Seiten / loading / error        | `find app -name 'page.tsx' \| wc -l` usw.                                                     |
| Icon-Buttons ohne Label         | `grep -rn 'size="icon"' -A2` gegen `aria-label\|sr-only`                                      |
| Kalender-Implementierungen      | `find`-Treffer auf `*calendar*`/`*planning*` + `wc -l`                                        |
| Kein URL-Zustand                | `grep -c 'useSearchParams\|router.replace\|router.push'` = 0                                  |
| Wizard-Schritt ohne Rückschrieb | `grep -rn 'initialStep\|SET_STEP'` in `wizard-context.tsx`                                    |
| Bulk-Toggle vorhanden           | `app/api/seasons/[id]/calendar/toggle/route.ts`, Feld `week_mondays`                          |
