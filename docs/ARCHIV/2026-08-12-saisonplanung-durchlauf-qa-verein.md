# Saisonplanung — Durchlauf mit frischem Verein, 12.08.2026

> Snapshot. Archivdokument, wird nicht weitergepflegt (siehe `AGENTS.md`).
> Methode: Ein neuer Verein wurde von Null aufgebaut (`scripts/seed-qa-club.ts`) und der
> Saisonbetrieb im Browser durchgespielt — Saison anlegen, Präferenzen, Wizard, Konflikt-
> prüfung, Veröffentlichen. Jeder Befund ist gegen die Live-Datenbank oder den Code geprüft.
> Umgebung: lokaler Build mit `TZ=UTC` gegen die produktive VPS-Supabase.

## Kurzfassung

**Eine veröffentlichte Saison entsteht in dieser Datenbank nicht.** Zwei voneinander
unabhängige Sperren im Buchungspfad brechen den Vorgang ab; die Fehlermeldung ist ein
roher SQL-Dump in der Oberfläche. Alles, was danach kommt — Trainer sieht Gruppe,
Mitglied sieht Termin, Abmeldung, Abrechnung — war deshalb nicht erreichbar.

Die Planung _davor_ läuft, produziert aber einen Plan, den ein Verein so nicht verwenden
kann: vier Mitglieder sind zu Zeiten eingeteilt, an denen sie laut eigener Angabe nicht
können, vier weitere fehlen ganz, und eine Gruppe hat keinen Platz. Die Konfliktprüfung
meldet dazu **„Keine Konflikte gefunden — die Planung ist konfliktfrei."**

Der Testverein: 4 Plätze (3 Sand außen, 1 Halle), 3 Trainer, 24 Mitglieder in fünf
Archetypen, davon 4 ohne abgegebene Präferenzen. Saison: Wintersaison 2026/27.

---

## A — Veröffentlichen ist blockiert

### A1. Die Datenbank verbietet mehrere Teilnehmer auf derselben Einheit (kritisch)

`20260505030000_fix_booking_rpc_and_overlap.sql:105` installiert einen Trigger, der jede
Buchung ablehnt, die sich mit einer bestehenden Buchung auf demselben Platz zeitlich
überschneidet:

```
Booking overlaps with 1 existing booking(s) on this court
```

Der Trigger schützt Platzreservierungen vor Doppelbelegung und kennt keine Ausnahme für
Buchungen, die zur **selben Einheit** gehören. Die Saisonplanung legt seit dem Fix vom
12.08. aber genau das an: eine Buchung je Teilnehmer, alle auf demselben Platz zur selben
Zeit. Ab dem zweiten Teilnehmer bricht die Transaktion ab.

Damit sind zwei Modelle aufeinandergestoßen: `bookings` ist als **exklusive
Platzreservierung** gebaut, wird von der Saisonplanung aber als **Teilnehmerliste**
benutzt. Live nachgewiesen: zwei Buchungen mit identischem `session_id`/`court_id`/
Zeitfenster, zweite abgelehnt (`P0001`).

Vorschlag (kleinstmöglich, erhält den Schutz): Im Trigger die Konfliktzählung um
`AND b.session_id IS DISTINCT FROM NEW.session_id` ergänzen. Teilnehmer derselben Einheit
kollidieren dann nicht mehr miteinander, eine fremde Buchung auf demselben Platz weiterhin
schon. Erfordert eine neue Migration und einen Nachtrag in `docs/DATABASE.md`.

### A2. `booking_type: 'lesson'` ist in der Live-DB kein zulässiger Wert (kritisch, behoben)

Die Confirm-Route schrieb `booking_type: 'lesson'`. Der Check-Constraint der Live-Datenbank
akzeptiert nur `'court'` und `'session'` — live durchprobiert:

| Wert                                                        | Live-DB       |
| ----------------------------------------------------------- | ------------- |
| `court`, `session`                                          | akzeptiert    |
| `regular`, `lesson`, `tournament`, `maintenance`, `blocked` | **abgelehnt** |

Die einzige Migration, die den Constraint definiert
(`20260503_court_booking_system.sql:81`), erlaubt genau die fünf abgelehnten Werte und
keinen der beiden echten. Die Datei bildet den Live-Zustand also nicht ab — der in
`AGENTS.md` beschriebene Migrations-Blindflug, hier mit unmittelbarer Wirkung.

Behoben: `booking_type: 'session'` in `app/api/seasons/[id]/planning/confirm/route.ts:373`.

### A3. Warum die Testsuite das nicht gefunden hat

`src/__tests__/api/confirm-publish.test.ts` mockt Schema und Datenbank vollständig. Alle
1450 Tests sind grün, während der Vorgang gegen eine echte Datenbank in keiner
Konstellation durchläuft. Der Buchungspfad hat nie eine reale Datenbank gesehen.

### A4. Roher SQL-Fehler in der Benutzeroberfläche (mittel)

Beim Fehlschlag rendert die Seite die vollständige Drizzle-Fehlermeldung: Insert-Statement,
alle Spaltennamen und ~80.000 Zeichen Parameterwerte inklusive Mitglieder-UUIDs. Das
verstößt gegen die Projektregel „Graceful, benutzerfreundliche deutsche Fehlermeldungen.
Kein Stack-Trace in der UI" und legt interne Struktur offen.

---

## B — Der Plan selbst

### B1. Konfliktprüfung meldet konfliktfrei, obwohl der Plan nicht durchführbar ist (kritisch)

Der Detektor (`lib/season-planning/conflict-detector.ts`) prüft sieben Dinge:
Trainer-Doppelbuchung, Mitglied-Doppelbuchung, fehlender Trainer, Platz mehrfach belegt,
Trainer über Limit, Slot mit hoher Ausfallrate, große Niveau-Spanne.

Drei Fälle, die im Testlauf auftraten, prüft er nicht:

- **Gruppe ohne Platz.** Der Platz-Check beginnt mit `if (!assignment.courtId) continue;`
  (Zeile 289) — genau der Fall wird übersprungen.
- **Mitglied außerhalb seiner Verfügbarkeit.** Keine Prüfung vorhanden.
- **Nicht eingeplante Mitglieder.** Keine Prüfung vorhanden.

Ergebnis: der Admin bekommt eine grüne Freigabe für einen Plan, den er per Hand hätte
korrigieren müssen.

### B2. Eine Gruppe ohne Platz — und die Folgekette (kritisch)

`clustering-engine.ts:799` beschränkt Wintersaisons auf Hallenplätze. Der Verein hat eine
Halle. Der Algorithmus legte trotzdem zwei Gruppen auf Dienstag 18:00; die zweite bekam
`court_id = null`.

Die Oberfläche zeigt das nur als Trennpunkt ins Leere:

```
Anfänger Gruppe 3   18:00–19:00 Uhr · Miriam Vogt · Halle 1
Anfänger Gruppe 4   18:00–19:00 Uhr · Kai Brenner ·
```

Beim Veröffentlichen überspringt `confirm/route.ts:364` Buchungen ohne Platz. Die sechs
Mitglieder dieser Gruppe wären für Mitglied- und Traineransicht unsichtbar — die
Abrechnung liest jedoch `expected_participants` und stellt ihnen eine Rechnung. Das ist
derselbe Mechanismus, der am 12.08. als Fund 1 behoben wurde, hier über einen anderen Weg
wieder erreichbar.

### B3. Vier Mitglieder sind zu Zeiten eingeplant, an denen sie nicht können (schwer)

Nachgerechnet aus `season_plan_entries.expected_participants` gegen
`user_training_preferences.weekly_availability`:

| Mitglied     | Angegeben verfügbar | Eingeplant         |
| ------------ | ------------------- | ------------------ |
| Marie Böhm   | Di, Do, Sa          | **Montag 15:00**   |
| Til Kaufmann | Di, Do, Sa          | **Montag 15:00**   |
| Helga Sommer | Mi, Fr (vormittags) | **Dienstag 18:00** |
| Werner Alt   | Mi, Fr (vormittags) | **Dienstag 18:00** |

Die beiden Senioren können ausschließlich vormittags. Mittwochvormittag ist frei und die
Cheftrainerin dort verfügbar — der Algorithmus nutzt es nicht. Von sechs möglichen
Wochentagen belegt der Plan zwei; Mittwoch bis Samstag bleiben leer.

### B4. Vier Mitglieder fallen still aus dem Plan (mittel)

24 Mitglieder waren zur Planung ausgewählt, der Plan enthält 20. Die vier ohne abgegebene
Präferenzen tauchen in keiner Gruppe und in keiner Warteliste auf. Die Kennzahl lautet
„4 Gruppen / 20 Mitglieder" — die Differenz muss der Admin selbst bemerken.

### B5. Ein Trainer bleibt ungenutzt (mittel)

Tomasz Nowak (Di/Do 18–21, Fortgeschrittene/Turniervorbereitung) bekam keine Gruppe,
während beide Dienstagabend-Gruppen auf die anderen Trainer und einen einzigen Platz
gelegt wurden. Trainer-Auslastung gesamt: 13 %.

---

## C — Zahlen, die dem Admin etwas anderes sagen als die Wirklichkeit

### C1. Präferenzquote kann strukturell nie unter 100 % fallen (schwer)

`app/api/seasons/[id]/planning/preferences-summary/route.ts:59` setzt

```ts
const totalMembers = prefs.length;
```

Das ist die Zahl der **Präferenz-Datensätze**, nicht die der Mitglieder. Wer das Formular
nie geöffnet hat, existiert für diese Statistik nicht. Im Testlauf: 24 Mitglieder,
20 Abgaben — angezeigt wurde „20 von 20 Mitgliedern eingereicht (100 %)".

Bemerkenswert: die Saison-Übersichtsseite rechnet daneben korrekt „20 von 24". Zwei
Oberflächen, dieselbe Frage, zwei Antworten.

Richtige Bezugsgröße: aktive Mitgliedschaften mit `include_in_planning = true`.

### C2. Trainer-Präferenzen sind unsichtbar, wenn `trainers.user_id` fehlt (schwer)

`planning/trainers/route.ts:55` verknüpft über
`innerJoin(trainersTable, eq(users.id, trainersTable.user_id))`.

**Alle drei Code-Pfade, die Trainer anlegen, setzen dieses Feld nicht:**
`members/invite/route.ts:185`, `members/bulk-import/route.ts:274` und
`trainer-profile.repository.ts:440` (`ensureTrainersRecord`) schreiben
`trainers.id = users.id` und lassen `user_id` leer.

Folge: Der Trainer erscheint in der Liste (die läuft über `trainer_clubs`), gilt aber
dauerhaft als „Präferenzen ausstehend — Standardverfügbarkeit wird verwendet". Seine
tatsächlichen Zeiten erreichen den Algorithmus nie.

Im Testlauf reproduziert: vor dem Setzen von `user_id` meldete Schritt 2 „0/3
eingereicht", danach „3/3" — bei unveränderten Präferenzdaten.

**Zum tatsächlichen Ausmaß, nachgezählt:** 14 der 49 Trainer haben kein `user_id` —
davon sind 13 „Test Trainer RLS" aus der Integrationstestsuite und einer der Platzhalter
„Noch nicht zugewiesen" (`trial-training.repository.ts:313`, bewusst ohne Nutzer). **Kein
produktiv genutzter Trainer ist betroffen**; die übrigen 35 haben das Feld gesetzt, wenn
auch nicht über einen der drei gefundenen Pfade. Der Fehler ist real und hätte jeden neu
eingeladenen oder importierten Trainer getroffen — aber er hat bisher keinen echten
Vereinsbetrieb beschädigt. Ein Nachzieh-Lauf für Bestandsdaten ist deshalb nicht nötig.

### C3. Schritt 1 und Schritt 2 widersprechen sich (mittel)

Das Bereitschaftsbanner in Schritt 1 zählt Präferenzzeilen direkt und meldete grün
„3 Trainer-Präferenzen", während Schritt 2 gleichzeitig „0/3 eingereicht" anzeigte. Zwei
Prüfungen derselben Tatsache über verschiedene Wege — der grüne Weg ist der unschärfere.

Ebenso zählt das Banner „23 Mitglieder-Präferenzen" und rechnet dabei die drei Trainer in
eine Mitgliederzahl hinein.

---

## D — Kleinere Befunde

- **Denglisch:** „Neue Season erstellen", „Season Details", „Season Name", „+ Neue Season"
  neben „Saisonplanung" und „Saison anlegen" auf derselben Seite. Projektregel: alle
  UI-Texte deutsch.
- **Niveau-Anzeige:** Alle 24 Mitglieder werden in der Auswahlliste als `beginner`
  geführt, obwohl die Präferenzen `intermediate`/`advanced` enthalten. Der
  „Niveau-Match: 100 %" der Planung bezieht sich damit auf eine Größe, die für alle gleich
  ist — die Zahl sagt nichts aus.
- **Leere Anwesenheitsspalte:** zeigt ein nacktes `%` ohne Wert statt „–".
- **Wizard verliert den Schritt:** Nach einem Seiten-Reload beginnt der Assistent wieder
  bei Schritt 1, auch wenn Plan und Konfliktprüfung bereits vorliegen.
- **`trainer_availabilities` ist datumsbasiert** (`trainer_id`, `date`, `status`), während
  `scripts/seed-trainer-availability-tc-rheinland.ts` wochentagsbasiert schreibt
  (`user_id`, `club_id`, `day_of_week`) — dieser Seeder kann gegen die heutige Tabelle
  nicht funktionieren. Die Readiness-Prüfung
  (`clubs/[id]/planning-readiness/route.ts`) liest diese Tabelle, der Wizard dagegen
  `user_training_preferences`.

---

## E — Bestandsdaten

In der Live-Datenbank stehen **869 Trainingseinheiten aus veröffentlichten Plänen und
genau 1 Buchung insgesamt** (Typ `court`). Alle vier bestehenden Saisons sind damit für
Mitglieder und Trainer unsichtbar. Der Fix vom 12.08. wirkt nur bei neuen
Veröffentlichungen; für Bestandssaisons braucht es einen Nachzieh-Lauf — der aber erst
möglich ist, wenn A1 behoben ist.

Nebenbefund: Die Datenbank enthält 34 Vereine, davon 31 Rückstände aus Integrationstests
(„RLS Test Club", „Billing Test Club <timestamp>"). Die Testsuite räumt nicht auf und
schreibt in dieselbe Datenbank wie der Produktivbetrieb.

---

## F — Nachtrag: was der entsperrte Durchlauf zusätzlich zeigte

Nachdem A1 und A2 behoben waren, lief die Veröffentlichung erstmals durch — und legte
weitere Fehler frei, die vorher hinter dem Blocker lagen.

### F1. Die Saison kannte ihr eigenes Start- und Enddatum nicht (kritisch, behoben)

Der erste erfolgreiche Publish erzeugte für die **Wintersaison 2026/27 (01.10.2026 –
31.03.2027)** Trainingstermine vom **27.08.2026 bis 09.11.2026** — fünf Wochen vor
Saisonbeginn startend, vier Monate zu früh endend, 10–11 statt 26 Termine je Gruppe.

Ursache: `src/infrastructure/persistence/schema.ts` deklarierte `seasons.start_date` und
`seasons.end_date` als `timestamp`, die Live-Spalten sind aber vom Typ `date`. Drizzle
lieferte für beide `null`. `confirm/route.ts:276` fällt in diesem Fall auf Notnagel-Werte
zurück:

```ts
let seasonStart = season.start_date ? new Date(season.start_date) : new Date();
let seasonEnd = season.end_date ? new Date(season.end_date) : new Date(Date.now() + 90 * 864e5);
```

Also: Saisonstart = Tag der Veröffentlichung, Ende = 90 Tage später. Bewiesen durch die
dabei angelegte `schedules`-Zeile — `season_start_date` = Ausführungszeitpunkt,
`season_end_date` = +90 Tage, `season_type` = `summer` bei einer Wintersaison.

Der Fehler war unsichtbar, weil beide Fallbacks _plausible_ Daten erzeugen. Niemand sieht
einem Plan an, dass er aus „heute + 90 Tage" statt aus der Saison stammt.

Behoben: beide Spalten als `date` deklariert. Derselbe Bruch bestand bei
`trainer_absences.start_date/end_date` — der Grundlage der Vertretungsplanung — und wurde
mit korrigiert. Weitere Kandidaten mit gleichem Muster (`special_events`, `tournaments`,
`trainer_assignments`) sind live ebenfalls `date`; sie liegen außerhalb dieses Durchlaufs
und sind ungeprüft.

Nach dem Fix: 97 Einheiten vom 01.10.2026 bis 18.03.2027, **558 Buchungen — für jede
Gruppe exakt Teilnehmerzahl × Termine**. Sommer-/Winterzeit stimmt (18:00 Ortszeit liegt
im Oktober als 16:00Z, ab November als 17:00Z in der DB).

### F2. Der Konflikt-Constraint kannte die neuen Prüfungen nicht (behoben)

`planning_conflicts_conflict_type_check` listete die acht ursprünglichen Typen. Sobald die
Prüfung aus B1 einen der neuen Typen fand, scheiterte das Speichern — und damit die
gesamte Veröffentlichung. Behoben mit Migration `20260812130000`.

### F3. Schulferien wurden nie übersprungen (schwer, behoben)

Die Gruppen trainierten lückenlos durch — auch am 24.12. und 31.12.2026. Kein einziger
Termin wurde ausgelassen.

Ursache war nicht, wie zunächst vermutet, ein veralteter Jahrgang: `holidays.ts` führte
sehr wohl Blöcke für 2025, 2026 und 2027. Die Liste war **lückenhaft**. Für
Nordrhein-Westfalen enthielt der 2026er-Block nur Oster- und Sommerferien — ausgerechnet
Herbst- und Weihnachtsferien fehlten. Und das fällt niemandem auf: Eine fehlende
Ferienwoche erzeugt keinen Fehler, sondern still ein Training am Heiligabend.

Genau darin liegt der Konstruktionsfehler. Über 300 Zeilen KMK-Termine im Quelltext
müssen jedes Jahr von Hand nachgepflegt werden, und niemand merkt, wenn es unterbleibt.
Parallel existierte die gepflegte Tabelle `school_holidays`, die dieser Pfad nicht las —
dasselbe Muster wie bei den Trainer-Verfügbarkeiten: zwei Quellen für dieselbe Tatsache,
die Planung liest die schlechtere.

Behoben, in dieser Reihenfolge:

1. Die brauchbaren Termine der Konstante wurden nach `school_holidays` übernommen
   (181 Einträge; die Tabelle deckt jetzt alle 16 Bundesländer und 2025–2027 ab,
   213 Zeilen). Vorhandene Einträge blieben unangetastet — sie sind gepflegt.
2. `HOLIDAYS` und `getHolidaysForState()` sind aus `holidays.ts` **entfernt**. Die Datei
   enthält nur noch Hilfsfunktionen und bleibt frei von Datenbankzugriffen.
3. Neu: `lib/season-planning/holidays.server.ts` mit `loadHolidaysForState()` — liest
   ausschließlich `school_holidays`. Fehlt ein Bundesland, wird ohne Ferienpause geplant
   und eine Warnung geloggt; einen stillen Rückfall auf Code-Daten gibt es nicht mehr.
4. Alle vier Aufrufer (Confirm, Clustering, Dry-Run, Saisonkalender) umgestellt.

Verifiziert am Testverein: Erneutes Veröffentlichen ersetzte 97 Einheiten durch 81. Die
16 entfallenen sind exakt die Ferientermine — Herbstferien 12.–23.10.2026 sowie
**24.12., 28.12., 29.12., 31.12.2026 und 04./05.01.2027**. 466 Buchungen, je Gruppe
weiterhin exakt Teilnehmerzahl × Termine.

### F4. Zeitzonenfehler in der Mitglieder-Ansicht (behoben)

„Mein Trainingsplan" zeigte das 18:00-Training als **16:00 – 17:00**.
`components/bookings/my-bookings.tsx` formatierte mit date-fns `format()`, das in der
Zeitzone der Laufzeit rendert — auf Vercel UTC. Die zeitzonenfesten Formatter aus
`lib/format.ts` (Fix vom 12.08.) wurden hier umgangen.

Das ist exakt die Symmetriefalle aus dem Vorbericht: Auf einer Entwicklermaschine in
Berlin sieht die Anzeige richtig aus, in Produktion nicht. Sichtbar wurde es nur, weil
dieser Durchlauf bewusst mit `TZ=UTC` lief.

Behoben: `formatTime()` und neu `formatWeekdayDate()` aus `@/lib/format`.

### F5. Rate-Limit zählte Fehlversuche mit (behoben)

Veröffentlichen ist auf 3 Versuche pro Stunde begrenzt — gezählt wurden auch Fehlschläge
und Ablehnungen wegen Konflikten. Ein Admin, dessen Veröffentlichung auf einen Fehler
lief, war danach eine Stunde ausgesperrt, ohne Erklärung in der Oberfläche. Neu:
`releaseRateLimitSlot()` gibt den Versuch bei Fehlschlag und bei 409 wieder frei, und die
429-Meldung ist deutsch und nennt den Grund.

### F6. 500 statt 409 bei fehlendem `acceptedWarnings` (behoben)

`confirm/route.ts:140` griff ungeprüft auf `body.acceptedWarnings` zu. Der Pfad lief zum
ersten Mal überhaupt, als es dank B1 einen kritischen Konflikt gab — und warf
`Cannot read properties of undefined`.

### Was jetzt nachweislich funktioniert

- Veröffentlichen erzeugt Einheiten im richtigen Saisonzeitraum, mit vollständigen
  Teilnehmer-Buchungen (558/558)
- Erneutes Veröffentlichen ersetzt künftige Einheiten sauber (42 verworfen, 97 neu)
- Die Konfliktprüfung blockiert einen Plan mit platzloser Gruppe statt ihn freizugeben
- Das Mitglied sieht unter „Mein Trainingsplan" seine Termine samt „Abmelden"-Knopf
- Sommer-/Winterzeit über den Saisonwechsel hinweg korrekt

---

## G — Der Betrieb nach der Veröffentlichung

Mit einer funktionierenden Veröffentlichung ließ sich erstmals prüfen, was Trainer und
Mitglied tatsächlich sehen. Ergebnis: Der Plan war zwar korrekt in der Datenbank, aber
für den Trainer unsichtbar und für das Mitglied zur falschen Uhrzeit.

### G1. Das Trainer-Dashboard war komplett leer (kritisch, behoben)

Miriam Vogt, Trainerin von 20 veröffentlichten Einheiten, sah „Gesamt Sessions 0 —
Keine bevorstehenden Sessions".

Weder RLS noch Daten waren schuld: `trainer/page.tsx` bettete `groups(name)` in die
Session-Abfrage ein. Zwischen `sessions` und `groups` gibt es aber keinen Fremdschlüssel
— die Gruppen hängen als jsonb-Array in `group_ids`. PostgREST beantwortete die Abfrage
mit `PGRST200`, `data` blieb `null`, und da der Code `error` nicht prüft, wurde daraus
kommentarlos eine Null.

Ein stiller Query-Fehler, der die zentrale Arbeitsfläche einer ganzen Rolle abschaltet.
Behoben: Einbettung entfernt, Gruppennamen über `group_ids` nachgeladen.

Zusätzlich zählte die Kachel „Diese Woche" alles ab einer Woche in der Vergangenheit —
also die ganze Saison. Sie zeigte „20 Einheiten diese Woche" für eine Saison, die erst im
Oktober beginnt. Jetzt Montag–Sonntag der laufenden Woche.

### G2. Kein Trainer sieht je den Namen eines Teilnehmers (kritisch, behoben)

Die Teilnehmerliste zeigte „0 zugesagt", nach dem ersten Fix dann sechs Zeilen mit dem
Namen „Mitglied". Zwei unabhängige Ursachen:

**a) Die Liste kam aus der falschen Tabelle.** `GET /api/sessions/[id]/rsvp` las
ausschließlich `session_rsvps` — die vierte Repräsentation von „wer ist in diesem
Training" neben `expected_participants`, `bookings` und `training_group_memberships`.
Beim Veröffentlichen entstehen Buchungen, keine RSVPs. Die Route leitet die Liste jetzt
aus den Buchungen ab: eingeteilt = zugesagt, storniert = abgesagt, eine ausdrückliche
RSVP überschreibt beides. Nebenbei lieferte sie snake_case, während die Komponente
camelCase liest — auch mit vorhandenen RSVPs hätte dort „Mitglied" gestanden.

**b) RLS ließ die Namen nicht durch — für niemanden.** Die Policy
`Members can view club members` auf `users` prüft per Unterabfrage, ob der gelesene
Nutzer eine Mitgliedschaft in einem Verein des Aufrufers hat. Diese Unterabfrage läuft
selbst unter RLS, und auf `user_club_memberships` erlauben **alle** Policies nur die
eigene Zeile oder Club-Admins:

```
memberships_select :: (user_id = auth.uid()) OR is_club_admin(club_id)
```

Für Trainer und Mitglieder liefert die Unterabfrage damit genau eine Zeile — die eigene.
Die Policy konnte nie jemand anderen freigeben. Nachgemessen: Miriam sah vor dem Fix
**1 Nutzer**, danach **28** (genau ihr Verein), und weiterhin **0** aus fremden Vereinen.

Behoben mit Migration `20260812140000` über eine `SECURITY DEFINER`-Funktion
`shares_active_club_with()` — das Standardmuster gegen genau diese RLS-Rekursion. Die
Sichtbarkeit bleibt die im Policy-Namen dokumentierte Absicht.

### G3. Abmeldung funktioniert — aber niemand erfährt davon (mittel, teilweise offen)

Das Mitglied kann sich unter „Mein Trainingsplan" per Klick abmelden; die Buchung wird
storniert, die Zähler stimmen danach (20 → 19 Termine). Der Trainer sieht die Abmeldung
seit G2 in seiner Liste als „Abgesagt (1) — Abwesend".

Offen bleibt: Es entsteht **keine Benachrichtigung** an Trainer oder Admin
(`notifications` bleibt leer), es gibt **keinen Abmeldegrund** und **keine Rückfrage** vor
dem Klick — und vor allem **keinen Weg zurück**: Eine stornierte Buchung lässt sich über
keine Oberfläche wieder aktivieren. Wer sich versehentlich abmeldet, braucht den Admin.

### G4. Die Abrechnung stellte 1.150 € zu viel in Rechnung (schwer, behoben)

`season-billing.service.ts:366` errechnete die Zahl der Trainingseinheiten aus der
Saisonlänge — `(endWeek − startWeek + 1) × sessions_per_week` — und zog davon nur
manuell deaktivierte Wochen ab. Die Schulferien, die der Plan korrekt ausspart, kannte
die Abrechnung nicht.

| Gruppe            | Abgerechnet       | Tatsächlich      | Differenz    |
| ----------------- | ----------------- | ---------------- | ------------ |
| Anfänger Gruppe 4 | 26                | 21               | +5           |
| Anfänger Gruppe 3 | 26                | 20               | +6           |
| Kids Gruppe 1     | 26                | 20               | +6           |
| Kids Gruppe 2     | 26                | 20               | +6           |
| **Summe**         | **104 (5.200 €)** | **81 (4.050 €)** | **+1.150 €** |

Bei 23 Mitgliedern und einem Trainersatz von 50 €/h sind das rund 22 % Überzahlung —
und zwar systematisch, nicht als Einzelfall.

Behoben: Ist die Saison veröffentlicht, sind die tatsächlich angelegten Einheiten die
Abrechnungsgrundlage; die Wochenschätzung bleibt nur für die Vorschau vor der
Veröffentlichung. Nachgeprüft: 21/20/20/20 Einheiten, 4.050 €.

### G5. Zeitzonenfehler an drei weiteren Stellen (behoben)

`sessions.timeslot_start/-end` sind `timestamp` **ohne** Zeitzone: Der Wert ist der
UTC-Zeitpunkt, trägt aber kein `Z`. `new Date()` liest ihn deshalb als Ortszeit des
Browsers — ein 18:00-Training erschien in Deutschland als 16:00. Betroffen waren die
Buchungsliste des Mitglieds, das Trainer-Dashboard und die RSVP-Liste; das
Mitglieder-Dashboard nutzte zusätzlich eigene `toLocale*String`-Helfer ohne Zone.

Neuer Helfer `asUtcIso()` in `lib/format.ts` plus `formatWeekdayDate()`; alle vier
Stellen nutzen jetzt die zeitzonenfesten Formatter. Verifiziert über die Zeitumstellung
hinweg: 06.10. (Sommerzeit), 27.10. und 03.11. (Winterzeit) zeigen alle 18:00–19:00.

### G6. Mitglieder-Dashboard zeigte fremde Trainings und gedeckelte Zahlen (behoben)

„Buchungen 3 bevorstehend" bei 20 Terminen — die Kachel zeigte schlicht
`upcomingBookings.length` bei `.limit(3)`. Und „Nächste Session" stammte aus einer
**vereinsweiten** Abfrage auf `sessions`: Angezeigt wurde das nächste Training des
Vereins, im Test das einer fremden Gruppe zur falschen Zeit. Beide Kacheln stützen sich
jetzt auf eigene Zählabfragen bzw. die eigenen Buchungen des Mitglieds.

---

## Was am Ende nachweislich funktioniert

- Veröffentlichen: 81 Einheiten vom 01.10.2026 bis 18.03.2027, **466 Buchungen**, je
  Gruppe exakt Teilnehmerzahl × Termine
- Ferien werden ausgelassen — inklusive 24.12. und 31.12.
- Erneutes Veröffentlichen ersetzt künftige Einheiten sauber
- Die Konfliktprüfung blockiert einen Plan mit platzloser Gruppe
- Mitglied: eigener Trainingsplan mit korrekten Zeiten, Abmeldung wirkt durch
- Trainer: 20 Einheiten, Gruppenname, Teilnehmer mit Klarnamen, 5 zugesagt / 1 abgesagt,
  Check-in je Teilnehmer
- Abrechnung: 4.050 € statt 5.200 €, deckungsgleich mit dem veröffentlichten Plan
- `npx tsc --noEmit` fehlerfrei, **1451 Tests grün**

---

## H — Anwesenheit, Rechnungslauf, Vertretung, Warteliste

### H1. Der Anwesenheits-Knopf führte in eine Sackgasse (behoben)

Er verwies auf `/attendance-history?session=…` — die Ansicht, in der ein **Mitglied**
seine eigene Anwesenheit sieht. Sie ignoriert den Parameter und zeigte dem Trainer
„Keine Einträge gefunden". Eine Erfassungsseite für Trainer existiert im ganzen Projekt
nicht.

Statt eine neue zu bauen, öffnet der Knopf jetzt die bereits vorhandene Teilnehmerliste
mit Check-in und wählt die angeklickte Einheit aus. Dafür wanderte die Auswahl aus
`TrainerRsvpList` in das Dashboard; die Komponente ist jetzt wahlweise gesteuert oder
eigenständig.

Zwei Fehler fielen dabei mit ab:

- `TrainerRsvpList` bekam weder `trainerId` noch `trainerName` — jeder Check-in wurde
  mit `trainerId: 'unknown'` gespeichert. Jetzt durchgereicht; verifiziert:
  `trainer_id 2f3a2eb7…`, `trainer_name "Miriam Vogt"`.
- Als Datum des Anwesenheitseintrags stand der **Zeitpunkt des Klicks**, nicht der
  Trainingstermin. Ein am 12.08. vorbereiteter Check-in für das Training am 03.11. wäre
  unter dem 12.08. gelandet und hätte jede Auswertung verfälscht.

### H2. Rechnungen bleiben auf dem Stand des ersten Publish (schwer, behoben)

Der Rechnungslauf meldete `created: []`, alle 23 Mitglieder `skipped`, HTTP 200 — ohne
Begründung. Der Grund fand sich in der Datenbank: Es lagen bereits **20 Rechnungen über
5.200,06 €**, erzeugt beim allerersten Veröffentlichen (dem mit den falschen
August-Terminen). Zwei weitere Veröffentlichungen mit völlig verändertem Plan haben sie
nicht angefasst.

Die Ursache ist der Idempotenz-Check: Wer für diese Saison schon eine Rechnung hat, wird
übersprungen — unabhängig davon, ob sich der Plan seither geändert hat. Ein Verein, der
nach dem Veröffentlichen etwas korrigiert, fakturiert damit dauerhaft den alten Stand.

Behoben: `generateInvoices(seasonId, { replaceDrafts })` verwirft beim erneuten
Veröffentlichen die noch offenen (`draft`) Saison-Rechnungen und rechnet neu. Bereits
versendete oder bezahlte Rechnungen bleiben unangetastet — die gehören storniert, nicht
überschrieben. Verifiziert: nach dem nächsten Republish 20 Rechnungen über **4.050,04 €**,
deckungsgleich mit der Vorschau.

### H3. Vertretungstrainer funktioniert — die Wochenzählung ist aber eine Falle

Tomasz Nowak wurde als Vertretung für die Saisonwochen 3–5 der Dienstagsgruppe
eingetragen. Nach dem Veröffentlichen steht er bei zwei Terminen im Plan: 27.10. und
03.11. Das ist **korrekt** — die Saisonwochen 2 und 3 fallen in die Herbstferien, in denen
kein Training stattfindet.

Fachlich richtig, in der Bedienung riskant: Der Admin denkt in Trainingsterminen („die
nächsten drei Einheiten"), das System zählt Kalenderwochen ab Saisonbeginn und rechnet
Ferienwochen mit. Ohne angezeigte Datumsspanne ist nicht erkennbar, welche Termine
tatsächlich betroffen sind. Empfehlung: im Vertretungs-Panel die konkreten Termine
auflisten statt der Wochennummern.

Nebenbefund: Die Substitutes-Route antwortet `success: true` samt Name des
Vertretungstrainers, **auch wenn das UPDATE null Zeilen trifft** (etwa bei einer
Gruppen-ID, die es nicht gibt). Erneut das Muster „grün melden, ohne zu prüfen".

Ebenfalls aufgefallen: `PATCH /api/seasons/[id]/plan-entries/[entryId]` kennt die
Vertretungsfelder nicht und antwortet auf unbekannte Felder mit **500 „No values to set"**
statt mit 400.

### H4. Die Warteliste kennt nur einen einzigen Fall — und hat keine Oberfläche

`clustering-engine.ts:2244` (`applyWaitlistLogic`) erzeugt einen Wartelisteneintrag
ausschließlich dann, wenn ein Mitglied einen **Wunschpartner** angegeben hat, der in einer
anderen, bereits vollen Gruppe sitzt.

Nicht auf der Warteliste landet:

- wer überhaupt nicht eingeplant werden konnte (keine Präferenzen, keine passende Zeit) —
  im Testlauf vier Mitglieder
- wer in eine volle Gruppe wollte, ohne einen Wunschpartner zu nennen
- wer nach der Veröffentlichung dazukommt

Dazu kommt: **Keine einzige `.tsx` ruft `planning/waitlist` auf.** Die GET-Route und die
POST-Route zum Nachrücken sind von keiner Oberfläche erreichbar; die Wizard-Kachel
„Warteliste 0" ist die gesamte Sichtbarkeit. Ein Nachrückverfahren gibt es im Produkt
faktisch nicht.

Das ist kein Fehler, sondern eine Lücke — sie wurde deshalb nicht „behoben", sondern hier
benannt. Praktisch abgemildert ist sie durch die neue Prüfung `member_unplanned` aus B1,
die die nicht eingeplanten Mitglieder namentlich meldet, statt sie stumm fallen zu lassen.

---

## Einordnung

Der Bericht vom 12.08. hielt fest, dass „Veröffentlichen als Schreibvorgang auf `sessions`
behandelt wird, nicht als der Moment, in dem ein Plan verbindlich wird". Dieser Durchlauf
zeigt die nächste Schicht desselben Problems: Der Übergang wurde inzwischen um Buchungen
erweitert, aber gegen ein Datenmodell, das für etwas anderes gebaut ist — `bookings` ist
eine Platzreservierung, keine Teilnehmerliste. Solange diese Frage nicht entschieden ist,
sind alle Folgeschritte (Abmeldung, Anwesenheit, Abrechnung) auf Sand gebaut.

Der zweite rote Faden: **Prüfungen, die grün melden, ohne zu prüfen.** Die
Konfliktprüfung, die Präferenzquote und das Bereitschaftsbanner geben dem Admin dreimal
unabhängig voneinander eine Freigabe für einen Zustand, den sie nicht erfasst haben. Für
ein Produkt, dessen Versprechen die Entlastung des Vereinsvorstands ist, ist das teurer
als jeder einzelne Bug.

## Reproduktion

```bash
npx tsx scripts/seed-qa-club.ts                    # Verein, Nutzer, Plätze, Trainer
# Admin (admin@gwa.example.com) legt in der UI eine Saison an
npx tsx scripts/seed-qa-club.ts --prefs <seasonId> # Präferenzen
npx tsx scripts/seed-qa-club.ts --purge            # alles restlos entfernen
```

Verwandt: `docs/ARCHIV/2026-08-12-rollen-durchlauf-saisonbetrieb.md`.
