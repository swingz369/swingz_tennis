# Nav- & Workflow-Audit SwingZ — 2026-08-13

> Archiv-Snapshot, kein lebendes Dokument. Stand: Branch `refactor/season-auth-helper-adoption`, 13.08.2026.
> Schwester-Dokumente: `2026-08-13-test-audit.md` (Zustand der Testsuite),
> `2026-08-13-änderungen-test-suite.md` (Reorganisation `tests/unit/` → `src/__tests__/`).

## Auftrag

Admin loggt sich erstmals in einen neu angelegten Verein ein. Alle Navbar-Grundfunktionen
der vier Kernmodule (`members`, `trainers`, `seasons`, `finance`) müssen für alle Rollen
fehlerfrei, verständlich und workflow-logisch funktionieren. Ziel: Produktionsreife.

## Vorgehen

1. **Automatisiert:** `e2e/nav-links-smoke.test.ts` zieht die zu prüfenden URLs direkt aus
   `lib/navigation.ts` (gemeinsame Quelle für Sidebar, Mobile-Nav, Command-Palette) und
   kann daher nicht veralten. Prüft je Seite: HTTP < 400, keine Console-Errors, keine
   5xx-APIs, kein leerer Body, kein Error-Boundary-Marker.
   Lauf: `RUN_BROWSER_E2E=true npx vitest run e2e/nav-links-smoke.test.ts --pool=threads`
   Bericht: `.audit-captures/nav-links-smoke.json`
2. **Leerer Verein:** frischer Testverein über die Owner-API, um Empty States zu treffen.
3. **Manuell:** Workflow-Durchlauf (steht noch aus, siehe unten).

## Ergebnis

| Lauf                           | admin          | trainer   | member    |
| ------------------------------ | -------------- | --------- | --------- |
| Erstlauf (bestehende Vereine)  | 21/23          | 20/21     | 14/17     |
| Nach den Fixes                 | alle grün      | alle grün | alle grün |
| Leerer Verein, nach Onboarding | 20 Seiten grün | —         | —         |

## Behobene Befunde

| #   | Fund                                                                                                     | Wirkung                                                                                                                                                                                                                                                                                                                                                                                                        | Ort                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | `user_club_memberships.age_group` existiert live nicht (PostgREST 42703)                                 | `/member/preferences` war für **jedes** Mitglied funktionslos: die fehlgeschlagene Query brach den Effect ab, `clubId`/`seasons` blieben leer. Zudem blieb `preferred_age_group` immer `'senior'` → die Clustering-Engine erkannte **kein Kind** als minderjährig und hätte Schulkinder in Vormittagstraining gesetzt.                                                                                         | `app/(protected)/member/preferences/page.tsx`, Test in `src/__tests__/lib/age-group-from-dob.test.ts`                       |
| 2   | Wunschpartner per Client-Query                                                                           | RLS auf `user_club_memberships` gibt einem Mitglied nur die eigene Zeile frei — und filtert **still**, ohne Fehler. Die Liste war immer leer.                                                                                                                                                                                                                                                                  | neu: `app/api/members/directory/route.ts` (Service-Client, autorisiert gegen `auth.memberships`, liefert nur `id` + `name`) |
| 3   | `GET /api/sepa-mandates` verlangte pauschal Trainer-Rang                                                 | Mitglieder durften ein SEPA-Mandat **erteilen** (POST), aber nicht sehen, dass es existiert. `/profile` → Zahlungen lief in 403.                                                                                                                                                                                                                                                                               | `app/api/sepa-mandates/route.ts`                                                                                            |
| 4   | `/gamification` in der Command-Palette ohne Feature-Gate                                                 | Vereine ohne das Modul bekamen den Eintrag angeboten und landeten in 403.                                                                                                                                                                                                                                                                                                                                      | `lib/navigation.ts` (`paletteNavItems` nimmt jetzt `hidden`), `components/command-palette.tsx`                              |
| 5   | `getClubFeatures` gab den rohen `clubs.features`-Wert zurück                                             | Frisch angelegte Vereine haben dort `{}` (Defaults setzt erst der Onboarding-Wizard). Serverseitig galt damit **jedes** Modul als deaktiviert, auch die vier nicht abschaltbaren Kernmodule. Der Client-Hook `useClubFeatures` normalisierte längst über `sanitizeFeatureFlags` — Server und Client sahen Unterschiedliches.                                                                                   | `lib/require-feature.ts`                                                                                                    |
| 6   | `action_type: 'auto_plan_completed'` verletzt den Live-CHECK `season_planning_history_action_type_check` | **Die automatische Saisonplanung schlug in jedem Verein fehl** — 500 pro Aufruf, mit rohem Drizzle-SQL in der Antwort. Verifiziert per Insert-Probe gegen die Live-DB: von `auto_plan_completed`, `auto_plan_started`, `plan_published`, `created`, `plan_created` ist **nur** `auto_plan_completed` blockiert. Auf `plan_created` umgestellt (erlaubt, produktiv unbenutzt, semantisch passend). Danach: 200. | `lib/services/auto-planning.service.ts:727`                                                                                 |

### Workflow-Durchlauf im leeren Verein (API-Ebene)

| Schritt                                                            | Ergebnis                |
| ------------------------------------------------------------------ | ----------------------- |
| Mitglied einladen (`POST /api/members/invite`)                     | 200                     |
| Trainer einladen (`POST /api/members/invite`)                      | 200                     |
| Saison anlegen (`POST /api/seasons`)                               | 201                     |
| Präferenz-Zusammenfassung (`GET .../planning/preferences-summary`) | 200, ehrliche Nullwerte |
| Auto-Planung (`POST .../auto-plan`)                                | vorher 500 → jetzt 200  |

Die Kette Owner → Verein → Onboarding → Admin → Mitglied/Trainer → Saison → Auto-Planung
läuft damit durch. Getestet wurde die API-Ebene; die Bedienbarkeit der Oberflächen
(Formulare, Validierungsmeldungen, Empty-State-Führung) ist damit **nicht** abgedeckt.

### Falsch-Positiv im eigenen Test (ebenfalls behoben)

`/admin/members` wurde als „20 Zeichen Body" gemeldet. Das war `networkidle`, das während
des gestreamten SSR feuerte — 20 Zeichen ist exakt `"Skip to main content"`. Der Test
wartet jetzt auf echten Inhalt.

### Verdeckte Abdeckungslücke im eigenen Test (ebenfalls behoben)

Solange `clubs.setup_completed_at` leer ist, leitet `app/(protected)/admin/(gated)/layout.tsx:58`
**jede** Admin-Route auf `/admin/onboarding` um. Der Lauf meldete „23 Links grün", hatte
aber 13 davon nie geladen — dreizehnmal dieselbe Wizard-Seite. Der Test wirft jetzt, wenn
mehr als die Hälfte der Links auf derselben finalen URL landet.

## Testverein (Wegwerf, in der echten DB)

|         |                                                                          |
| ------- | ------------------------------------------------------------------------ |
| Club-ID | `a1d8fd1b-21de-4519-b3ac-230dae980337`                                   |
| Name    | SwingZ Testverein 2026-08-13                                             |
| Admin   | `admin@testverein.swingz.test` / `TestAdmin!2026`                        |
| Zustand | Onboarding abgeschlossen, sonst leer (0 Mitglieder, 0 Saisons, 0 Plätze) |

Onboarding abschließen: `PATCH /api/clubs/<id>/setup` mit `setup_completed_at`.
Der Owner bekommt beim Anlegen korrekt **keine** Membership (Regel aus `CLAUDE.md`).

## Offene Punkte

### P0 — Rohe SQL-Fehler erreichen den Client

Der `auto-plan`-500 lieferte das komplette Drizzle-Statement inklusive Tabellen- und
Spaltennamen an den Browser. `CLAUDE.md` verlangt „graceful, benutzerfreundliche **deutsche**
Fehlermeldungen. Kein Stack-Trace in der UI." Der auslösende Bug ist behoben, das
**Durchreichen** von DB-Fehlertexten aber nicht. Zu prüfen: alle Routen, die
`error.message` ungefiltert in die Antwort schreiben.

### Klickweg-Stichprobe: Platz anlegen (`/admin/courts`)

**Positiv:** Der Empty State ist vorbildlich und sollte als Muster für andere Seiten dienen —
Überschrift „Noch keine Plätze", erklärender Satz „Erfasse die Tennisplätze deines Vereins
— für Buchungen und Trainingseinheiten", dazu ein Primärbutton „Platz anlegen". Der Admin
weiß sofort, was zu tun ist und warum.

**Kein Validierungsproblem** (frühere Fassung dieses Dokuments behauptete das Gegenteil —
das war ein Messfehler): Beim Absenden ohne „Platztyp \*" erscheinen sehr wohl
Rückmeldungen — zwei `role="alert"`, ein Toast und zwei HTML5-Invalid-Felder. Der erste
Test hatte nur den Text im `main`-Bereich gelesen und Toasts sowie Validierungszustände
übersehen.

**Kein a11y-Problem** (frühere Fassung behauptete das Gegenteil — auch das war ein
Messfehler): Die Auswahlfelder sind teils native `<select>`-Elemente mit echten
`<option>`-Kindern und damit von Haus aus barrierefrei. Dass meine Selektoren sie nicht
fanden, lag an der Erwartung von Radix-Markup, nicht an fehlender Semantik. Das Formular
ist inline gerendert, kein Modal — `role="dialog"` wäre dort ohnehin falsch.

**Nicht abgeschlossen:** Das erfolgreiche Anlegen eines Platzes über die Oberfläche konnte
ich nicht bis zum Ende belegen — mein Selektor für die Typ-Auswahl lief in einen Timeout.
Das ist eine Grenze der Messung, kein belegter Anwendungsfehler; der Schritt gehört
wiederholt.

### Kernformulare: Leer-Absenden-Probe

Jedes Formular geöffnet und ohne Eingaben abgeschickt. Gemessen wurde, ob **irgendeine**
Rückmeldung erscheint: `role="alert"`, `aria-invalid`, Toast, HTML5-Validierung oder
Fehlerfarbe.

| Modul          | Seite                   | Ergebnis                                                                                                                                       |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| members        | `/admin/members`        | Rückmeldung ✓ (2 alert, 1 Toast, 2 HTML5)                                                                                                      |
| courts         | `/admin/courts`         | Rückmeldung ✓ (2 alert, 1 Toast, 2 HTML5)                                                                                                      |
| special-events | `/admin/special-events` | Rückmeldung ✓ (2 alert, 2 Toast)                                                                                                               |
| trainers       | `/admin/trainers`       | **nicht belegt** — Formular öffnete (3 Felder), mein Selektor fand den Absende-Button nicht                                                    |
| seasons        | `/admin/seasons`        | **nicht belegt** — „Neue Saison" navigiert nach `/admin/seasons/new` statt ein Formular zu öffnen; meine Messung erwartete ein Inline-Formular |
| finance        | `/admin/billing`        | **nicht belegt** — mein Selektor traf den Tab „Rechnungen" statt „Rechnung erstellen"                                                          |

**Belastbares Fazit:** Wo die Messung griff, validieren die Formulare sauber und melden
sich. Ein durchgängiges „stilles Scheitern" gibt es **nicht**. Drei Formulare bleiben
ungeprüft — das ist eine Grenze meiner Automatisierung, kein Befund gegen die Anwendung.
Für diese drei braucht es angepasste Selektoren oder einen manuellen Klick.

### Behoben: Denglisch und Siez-Bruch im Saisonmodul

`CLAUDE.md` verlangt deutsche UI-Texte; die App duzt durchgängig („Erfasse die
Tennisplätze deines Vereins"). Das Saisonmodul tat beides nicht. Korrigiert in
`seasons-client.tsx` und `seasons/new/page.tsx`:

| vorher                                                               | nachher                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| „Neue Season"                                                        | „Neue Saison"                                                 |
| „Seasons Gesamt"                                                     | „Saisons gesamt"                                              |
| „Verwalten Sie Ihre Trainings-Seasons und Planungen"                 | „Verwalte deine Trainingssaisons und Planungen"               |
| „Neue Season erstellen" / „Erstellen Sie eine neue Trainings-Season" | „Neue Saison erstellen" / „Lege eine neue Trainingssaison an" |
| „Season Details" / „Grundlegende Informationen über die Season"      | „Saison-Details" / „Grundlegende Informationen zur Saison"    |
| „Beschreiben Sie diese Season…"                                      | „Beschreibe diese Saison…"                                    |
| Fehlertext „Fehler beim Erstellen der Season"                        | „…der Saison"                                                 |

**Rest offen (P2):** „Season" steht weiterhin in sichtbaren Texten von
`seasons/[id]/page.tsx`, `seasons/[id]/edit/page.tsx`, `seasons/[id]/planning/steps/config-step.tsx`,
`seasons/[id]/planning/steps/finalize-step.tsx`, `seasons/[id]/preferences/*` und
`seasons/loading.tsx`. Dort ist zwischen UI-Text und Code-Bezeichner zu trennen — eine
pauschale Ersetzung würde `season_id`, `seasonId`, `SeasonType` mit zerstören.

### Durchklick-Versuch: was belegt ist und was nicht

**Belegt (über die Oberfläche, headless Chromium):**

- „Neue Saison" navigiert korrekt nach `/admin/seasons/new`.
- Die Hilfsbuttons funktionieren: „Name generieren" füllt „Sommer 2026",
  „Standard-Zeitraum einfügen" füllt Start `2026-04-01`. Gute Bedienhilfe.
- Die Duplikatsprüfung greift: eine zweite Sommersaison 2026 wird abgelehnt, mit Toast.
- Leer abgeschickte Formulare melden sich (siehe Tabelle oben).

**Behoben dabei:** Die Ablehnung kam auf **Englisch** — „A summer season for year 2026
already exists". Ebenso „Invalid date format". Beide landen ungefiltert im Toast des
Nutzers. Übersetzt in `app/api/seasons/route.ts`. Zusätzlich in
`seasons/new/page.tsx` übersehen und nachgezogen: Label „Season Name" → „Saison-Name",
Toast „Bitte füllen Sie alle Pflichtfelder aus" → „Bitte fülle alle Pflichtfelder aus".

**Nicht belegt — und mit headless Playwright auch nicht sinnvoll erreichbar:** Das
tatsächliche Anlegen eines Datensatzes über die Oberfläche. Die Formulare mischen native
`<select>`-Elemente (Saison-Typ) mit Radix-Komponenten (Platztyp); dazu fängt das
Cookie-Banner-Overlay Klicks ab. Drei Anläufe mit verschiedenen Selektor-Strategien
scheiterten jeweils an einer anderen Stelle. **Empfehlung:** diesen Nachweis im sichtbaren
Browser führen (oder manuell durchklicken) statt blind über Selektoren — dort sieht man,
was das Formular tatsächlich tut, statt es zu erraten. Zugang siehe Testverein-Tabelle.

### P1 — Bedienbarkeit noch ungeprüft

- **Der Durchlauf lief über die API, nicht über die Oberfläche.** Belegt ist, dass die
  Endpunkte die Kette tragen; ob Formulare, Pflichtfeld-Validierung, Fehlermeldungen und
  Empty-State-Führung einen echten Admin ans Ziel bringen, ist offen. Konkret ungeprüft:
  Mitglieder-CSV-Import, Platzanlage, Trainer-Verfügbarkeiten, Rechnungslauf.
- **Abrechnung nie ausgelöst:** Der Finanz-Teil der Kette (Rechnung erzeugen, Mahnwesen)
  wurde im leeren Verein nicht durchlaufen.
- **E-Mail-Invite-Flow ungetestet:** Owner lädt Admin ein (`/api/owner/invite-admin`).
  Braucht Postfachzugriff; der Testverein-Admin wurde ersatzweise direkt angelegt.
- **Migration `20260701010000_widen_season_planning_history_action_type_check.sql` ist nie
  angewendet worden** — und selbst ihre Whitelist enthält `auto_plan_completed` nicht.
  Beispiel für die in `AGENTS.md` beschriebene Altlast: Migrationsdateien bilden den
  Live-Zustand nicht ab. Das Drizzle-Schema kennt zudem fünf Spalten der Tabelle nicht
  (`changed_by`, `changed_by_role`, `changes`, `entity_id`, `entity_type`).

### P2 — Ehrlichkeit der Oberfläche

- **`/gamification` verschleiert einen 403** als „0 Punkte / 0 Badges / Noch keine Daten –
  besuche regelmäßig Trainings" statt zu sagen, dass das Modul nicht aktiviert ist.
  Fail-open-Darstellung. Modul ist laut `lib/features.ts` eingefroren, daher niedrige Prio —
  aber das Muster sollte nicht Schule machen.
- **`/news`** (Command-Palette) landet auf `/messages` — ein Eintrag ohne eigenes Ziel.

### P3 — Kleinigkeiten

- **`PUT /api/clubs/[id]/setup` gibt ein nacktes 405** ohne Fehlertext (nur `PATCH` existiert).
- **`tests/e2e/all-pages-render.spec.ts:32`** prüft `/member/preferences` nur gegen
  `/präferenz|einstellung|verfügbar/i` und war deshalb grün, während die Seite tot war.
  Überschriften-Regex belegt keine Funktion.

### Zu bewerten (kein Bug, aber auffällig)

- **`users` ist für jedes eingeloggte Mitglied vollständig lesbar** — `GET /rest/v1/users`
  liefert Namen aller Nutzer aller Vereine. Verifiziert mit einem Member-Token. Ob das so
  gewollt ist, gehört entschieden; die neue `directory`-Route gibt bewusst nur Mitglieder
  des eigenen Vereins heraus.

## Betriebshinweis

Auf dieser Maschine (16 GB) kollidieren Dev-Server, Chrome und Vitest-Worker: ein Lauf
scheiterte mit `Timeout waiting for worker to respond` bei 707 MB frei, ein weiterer riss
den Dev-Server mit (`ECONNREFUSED`). `--pool=threads` hilft, ein Browser-Aufräumen vorher
ebenfalls.
