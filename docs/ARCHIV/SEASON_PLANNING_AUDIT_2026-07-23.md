# Saisonplanung — Tiefenanalyse & Optimierungsplan (2026-07-23)

**Anlass:** Nach Anlage der Wintersaison 26/27 für TC Blau-Weiß Münster lud
`/admin/seasons` nicht mehr. Zusätzlich: vollständige Analyse des gesamten
Saisonplanungs-Flows (Detail-Seite → 4-Schritt-Wizard) auf Logik, Navigation,
Button-Benennung und fehlende Präferenz-Anzeige.

**Methode:** Live-Reproduktion im Browser (Chrome DevTools MCP, Login als
`superadmin@ts-westfalen.de`), direkte DB-Abfragen gegen die echte Dev-DB,
Code-Review aller Wizard-Dateien (`app/(protected)/admin/(gated)/seasons/**`,
`lib/season-planning/**`, zugehörige API-Routes).

---

## 1. Absturz-Ursache — behoben

**Symptom:** `/admin/seasons` blieb dauerhaft im Ladezustand (leerer `<main>`,
kein Fehler, kein Netzwerk-Traffic mehr) — reproduziert live im Browser.

**Root Cause:** `lib/season-planning/conflict-detector.ts` läuft über die
**eine gemeinsame Drizzle/postgres.js-Verbindung** (`src/infrastructure/persistence/db.ts`,
`max: 1`). Diese Verbindung ist bereits als intermittierend hängend bekannt
(self-hosted Supavisor-Pooler, siehe frühere Session). Hängt eine einzige
Query auf dieser Verbindung, warten **alle** nachfolgenden Drizzle-Queries
im ganzen Prozess für immer — inkl. Season-Liste, Season-Detail-API und
`POST .../planning/conflicts` (vom Wizard-Schritt 4 genutzt). Kein Fehler,
kein Timeout — einfach unendliches Laden.

**Fix (umgesetzt):**

- `detectConflictsForSeason()` läuft jetzt mit einem 8s-Timeout
  (`Promise.race`) — eine hängende Verbindung liefert ab jetzt einen Fehler
  statt die Seite für immer zu blockieren (`lib/season-planning/conflict-detector.ts`).
- `app/(protected)/admin/(gated)/seasons/page.tsx`: Konflikt-Zählung pro
  Season läuft jetzt über `Promise.allSettled` statt `Promise.all` — eine
  einzelne timeout-te Season blendet nicht mehr die komplette Liste aus.

**Noch zu tun (Infrastruktur, nicht Code):** Der Dev-Server musste neu
gestartet werden, um die aktuell blockierte Verbindung zu lösen. Das
grundsätzliche Pooler-Flackern auf `supabase.swingz.cloud` ist ein bekanntes,
noch offenes VPS-Thema (siehe Memory `vps-infra-2026-07-21`) — der Timeout-Fix
verhindert nur, dass ein einzelner Hänger die App lahmlegt.

---

## 2. Kritischer Datenfehler: zwei widersprüchliche Wochentag-Konventionen — behoben & präzisiert

**Fund:** `lib/season-planning/clustering-engine.ts:666` erzeugt
`dayOfWeek` als **0-indexiert** (`0=Montag..6=Sonntag`):

```ts
const dow = (new Date(d).getDay() + 6) % 7; // 0=Mon..6=Sun
```

`lib/season-planning/conflict-detector.ts` (Kommentar + `dayName()`)
geht dagegen von **1-indexiert** aus (`1=Mo..7=So`):

```ts
function dayName(dow: number): string {
  return DAY_LABELS[dow - 1] ?? `Tag ${dow}`;
}
```

**Konsequenz, live verifiziert:** In der neu angelegten Wintersaison stehen
mehrere `season_plan_entries` mit `day_of_week: 0` in der DB (= Montag laut
Clustering-Engine). Jede Konflikt-Meldung für diese Slots zeigt
„**Tag 0**" statt „Montag" an, weil `DAY_LABELS[-1]` `undefined` ist.

**Nachrecherchiert (per Nutzer-Rückmeldung):** `clustering-engine.ts:1928`
schließt Sonntag **absichtlich** aus (`// HARD CONSTRAINT: kein
Trainingsbetrieb am Sonntag — Vereinsrealität, Arbeits-/Ruhezeitregeln für
Trainer`), das war in Abschnitt 2 der Erstanalyse fälschlich als möglicher
Bug eingestuft. `use-schedule-plan.ts` dokumentiert außerdem explizit, dass
**0-indexiert (0=Mo..6=So) die app-weite Konvention** ist — inkl. Kommentar zu
einem früheren Bug, als genau diese zwei Konventionen vertauscht wurden.
`conflict-detector.ts` war der einzige Ausreißer.

**Umgesetzt:**

- `conflict-detector.ts`: `dayName()` nutzt jetzt `DAY_LABELS[dow]` statt
  `DAY_LABELS[dow - 1]` — keine „Tag 0"-Anzeige mehr.
- `preferences-summary/route.ts`: dieselbe Korrektur für die
  Ausfallraten-Warntexte (nutzte vorher `Tag ${day_of_week}` direkt).
- **Sonntag bleibt Standard-aus**, ist aber jetzt bewusst aktivierbar: neue
  Checkbox „Sonntag in die Planung einbeziehen" in Wizard-Schritt 1
  (`config-step.tsx`, Default `false`, mit Erklärtext zu Vereinsrealität/
  Ruhezeitregeln). Neues Config-Feld `includeSunday` durchgereicht via
  `ClusteringConfig` (clustering-engine.ts) → Wizard-State
  (`wizard-context.tsx`, `types.ts`) → Loop-Grenze
  (`dayOfWeek < (config.includeSunday ? 7 : 6)`). Kein DB-Schema nötig,
  request-scoped wie `teamSlotMinutes`/`teamLevels`.

---

## 3. Kaputter Link: „Präferenzen"-Tab führt ins Leere — behoben

**Das ist der Grund, warum Präferenzen „nicht angezeigt werden":**

Auf der Season-Detail-Seite (`app/(protected)/admin/(gated)/seasons/[id]/page.tsx`,
Tab „Präferenzen", nur sichtbar für veröffentlichte Seasons) gibt es einen
Button:

```tsx
<Button onClick={() => router.push(`/admin/seasons/${seasonId}/preferences`)}>
  Alle Präferenzen anzeigen
</Button>
```

Diese Route **existiert nicht**. Es gibt nur
`app/(protected)/admin/(gated)/seasons/[id]/preferences/new/page.tsx`
(ein Formular zum _Erfassen_ einer neuen Präferenz), aber keine
`preferences/page.tsx` zum _Anzeigen_ der eingereichten Präferenzen. Der
Button führt zu einem 404.

**Umgesetzt:** Neue Seite
`app/(protected)/admin/(gated)/seasons/[id]/preferences/page.tsx` — Tabelle
aller eingereichten/offenen Präferenzen (Name, Rolle, Status inkl.
Eingereicht-Datum, Level, Anzahl Zeitfenster, Wunschpartner-Anzahl,
Sonderwünsche). Nutzt die bereits vorhandene, unveränderte
`GET /api/seasons/[id]/preferences` — kein Backend-Fix nötig, nur die
fehlende Anzeige-Seite ergänzt.

---

## 4. Tote Funktion: Präferenz-Zusammenfassung wird berechnet, aber nie angezeigt — behoben

`lib/season-planning/wizard-context.tsx` definiert einen vollständigen
Action-Typ `SET_PREFERENCES_SUMMARY` mit Reducer-Logik, der State-Felder
`slotFailureRates`, `incompatibleWishPartnerPairs` und
`preferencesResponseRate` füllt. Die dazugehörige API-Route
`GET /api/seasons/[id]/planning/preferences-summary` existiert vollständig
und berechnet u.a. „Ausfallrate pro Zeitslot" und „inkompatible
Wunschpartner-Paare" — **wird aber von keiner einzigen Wizard-Komponente
jemals aufgerufen.** (`grep` über alle `.tsx` bestätigt: null Treffer
außerhalb von `wizard-context.tsx`/`types.ts`.)

Das erklärt einen zweiten Teil der Nutzer-Beobachtung: Wunschpartner-Konflikte
und Ausfallraten-Warnungen, die im Backend längst berechenbar wären, tauchen
im gesamten Wizard nirgends auf — nicht in Schritt 1 (Konfigurieren), nicht
in Schritt 2 (Trainer & Verfügbarkeit).

**Umgesetzt:** Neue Card „Präferenzen-Status" ganz oben in `ConfigStep`
(`PreferencesStatusCard`) — lädt beim Mount `GET .../preferences-summary`,
dispatcht `SET_PREFERENCES_SUMMARY` (bestehende, bis dato ungenutzte
Reducer-Logik) und zeigt Rücklaufquote sowie alle Ausfallraten- und
Wunschpartner-Konflikt-Warnungen an. Erscheint nur, wenn tatsächlich
Präferenzen-Zeilen für die Season existieren.

---

## 5. Navigations-/IA-Probleme

### 5.1 Drei Orte für „die Planung bearbeiten"

- Tab **„Bearbeiten"** (`SeasonPlanningTabs`) → `/edit` — Season-Metadaten
  (Name, Zeitraum, Deadline).
- Wizard-Schritt 1 **„Konfigurieren"** → Clustering-Parameter, Abrechnung,
  Mitgliederauswahl.
- Detail-Tab **„Plan"** → verlinkt auf `/scheduler` (gemeinsame
  Wochenplan-Ansicht) — **aber nur wenn veröffentlicht**, sonst nur ein
  Hinweistext „Noch keine Planung veröffentlicht" ohne Link zum Wizard.

Diese drei Wörter — „Bearbeiten", „Konfigurieren", „Plan" — bezeichnen für
Erstnutzer nicht erkennbar unterschiedliche Dinge. Ein Admin, der die
Trainingszeiten ändern will, kann ebenso gut auf „Bearbeiten" wie auf „Plan"
klicken und landet beide Male falsch.

**Umgesetzt:** Tab „Bearbeiten" → „Saison-Einstellungen" umbenannt
(`season-planning-tabs.tsx`); im „Plan"-Tab vor Veröffentlichung jetzt ein
Button „Zum Planungs-Wizard" (→ Schritt 3) statt nur Fließtext
(`seasons/[id]/page.tsx`).

### 5.2 Schritt 1 „Konfigurieren" ist überladen

`ConfigStep` (`config-step.tsx`) bündelt in einer einzigen, langen Seite:
Bereitschaftsprüfung, Präferenz-Erinnerung, 8 Clustering-Parameter,
3 Auto-Plan-Checkbox-Gruppen, ein `<details>`-Block mit erweiterten
Backtracking-Settings + Gruppen-Übernahme aus Vorsaison, Quick-Stats,
**komplette Abrechnungskonfiguration** (Stundensatz, MwSt., Zahlungsziel,
Mitgliedsbeitrag) und die Mitgliederauswahl. Das sind mindestens drei fachlich
getrennte Anliegen (Planungs-Parameter / Abrechnung / Mitgliederauswahl) in
einem Schritt — für einen Verkaufs-Demo-Ersteindruck wirkt das überfordernd
und unstrukturiert, nicht wie ein geführter 4-Schritt-Wizard.

**Umgesetzt:** Abrechnungskonfiguration in ein eigenes, standardmäßig
eingeklapptes `<details>`-Akkordeon verschoben (gleiches Muster wie die
bereits vorhandenen „Erweiterten Einstellungen") — klar als optionales,
separates Anliegen erkennbar, ohne den riskanteren Schritt einer
Datei-übergreifenden Verschiebung nach Schritt 4 zu gehen.

### 5.3 Uneinheitliche Primär-Button-Beschriftung auf der Detail-Seite

Derselbe Button ändert je nach Status Text UND Icon: „Wizard öffnen"
(draft) → „Planung fortsetzen" (in Arbeit) → „Saisonplanung ansehen"
(veröffentlicht) — technisch korrekt, aber führt zu drei visuell
unterschiedlichen Call-to-Actions für denselben Menüpunkt. Kombiniert mit
„Schnellstart" (überspringt Config direkt zu Auto-Plan) ergeben sich bis zu
zwei Primär-Buttons gleichzeitig im Header — für einen Erstnutzer nicht
selbsterklärend, welcher der „richtige" Einstieg ist.

**Umgesetzt:** „Schnellstart" hat jetzt einen erklärenden Tooltip
(`title`-Attribut), der beschreibt, dass sofort ein automatischer Plan mit
Standard-Einstellungen erzeugt wird.

---

## 6. Kleinere Beobachtungen (nicht tiefer verifiziert)

- **Saison-Rechnungen-Karte** (Detail-Seite, `SeasonInvoiceGenerator`):
  Das native Datums-Feld rendert im Accessibility-Snapshot mit leeren
  Spinbuttons (`value="0"`), obwohl kein Datum gesetzt sein soll — optisch
  wirkt das Feld dadurch wie ein falsch formatiertes Datum statt eines
  leeren Feldes. Nur beobachtet, nicht tief diagnostiziert.
- `season.club_id` wird an mehreren Stellen mit `?? ''` abgesichert
  (z. B. `SeasonInvoiceGenerator seasonId={id} clubId={season.club_id ?? ''}`)
  — deutet darauf hin, dass `club_id` theoretisch fehlen kann; im Zweifel
  lieber früh sichtbar fehlschlagen als mit leerem String weiterzureichen.
- Die Sidebar-Kopfzeile zeigte während der Analyse den Club-Namen des zuletzt
  aktiven Superadmin-Clubs, obwohl die gerade betrachtete Season zu einem
  anderen Club gehörte (Seiteninhalt war korrekt, nur der Header-Kontext
  wich ab) — für Superadmins mit mehreren Vereinen potenziell verwirrend,
  nicht weiter untersucht.

---

## Priorisierte Empfehlungen — Status

| #   | Fund                                                  | Status                                                                                              |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P1  | „Präferenzen anzeigen"-Button führt zu 404            | ✅ Umgesetzt — neue Übersichtsseite                                                                 |
| P1  | Präferenz-Zusammenfassung nirgends angezeigt          | ✅ Umgesetzt — Status-Card in Schritt 1                                                             |
| P2  | Day-of-Week-Label-Bug (`Tag 0` statt `Montag`)        | ✅ Umgesetzt — `dayName()`-Fix; Sonntag-Ausschluss war **kein Bug**, sondern gewollt (siehe unten)  |
| —   | Sonntag als Trainingstag                              | ✅ Neu: Opt-in-Checkbox in Schritt 1, Default aus (Vereinsrealität/Ruhezeitregeln bleiben Standard) |
| P2  | Schritt 1 entschlacken (Abrechnung abtrennen)         | ✅ Umgesetzt — eingeklapptes Akkordeon                                                              |
| P3  | „Bearbeiten"/„Konfigurieren"/„Plan"-Begriffe schärfen | ✅ Umgesetzt — Tab umbenannt, Plan-Tab hat jetzt CTA zum Wizard                                     |
| P3  | „Schnellstart" mit Erklärung versehen                 | ✅ Umgesetzt — Tooltip                                                                              |

**Nicht umgesetzt / bewusst zurückgestellt:** die kleineren, nicht tief
diagnostizierten Beobachtungen aus Abschnitt 6 (Datums-Spinbutton-Anzeige,
Superadmin-Sidebar-Kontext) — keine bestätigten Bugs, brauchen erst eine
gezielte Nachdiagnose, bevor sich ein Fix lohnt.

Alle Code-Änderungen: `npx tsc --noEmit` clean (0 Fehler).
