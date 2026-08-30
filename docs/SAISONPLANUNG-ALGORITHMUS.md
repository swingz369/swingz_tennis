# Saisonplanung — wie der Algorithmus arbeitet

> Zuletzt verifiziert: 30. August 2026 (Trainingsfenster und Medenspiel-Sperren am Code geprüft, Lauf gegen 500 Mitglieder gemessen)

Dieses Dokument beschreibt den **Ist-Zustand** von `lib/season-planning/clustering-engine.ts`
(≈3400 Zeilen): was er tut, warum er es so tut, wo er heute nachgibt und an welchen
Stellen sich Optimierung lohnt. Es ist für den gedacht, der ihn als Nächstes verbessern
will — nicht als Benutzerhandbuch.

Verwandt: `docs/BUSINESS_RULES.md` (was gelten muss), `docs/DATABASE.md` (welche Tabellen
er liest).

---

## 1. Was der Algorithmus löst

**Eingabe:** Mitglieder mit Spielstärke, Alter und wöchentlicher Verfügbarkeit ·
Trainer mit Verfügbarkeit, Qualifikation und Wochenstunden-Obergrenze · Plätze
(Sommer/Winter, Halle/Freiluft) · Präferenzen (Wunschpartner, Wunschtrainer,
Wunschplatz) · die Gruppen der Vorsaison.

**Ausgabe:** ein Wochenraster aus Zuweisungen `(Gruppe, Trainer, Platz, Wochentag,
Uhrzeit)` plus Warteliste plus eine Begründung je Zuweisung und je nicht
untergebrachtem Mitglied.

**Verfahren:** regelbasierter Greedy-Solver mit Backtracking und Multi-Start. **Kein
LLM.** Deterministisch — gleiche Eingabe, gleiches Ergebnis; es gibt keine
Zufallsquelle in der Engine.

**Einstieg:** `POST /api/seasons/[id]/planning/cluster` → `runClustering(dryRun)`.
Mit `dryRun: true` wird nichts geschrieben.

---

## 2. Ablauf

```
runClustering(dryRun)
│
├─ 0  loadConfig()              Planungs-Konfiguration aus season_planning_configs,
│                               fällt auf DEFAULT_CONFIG zurück
├─ 1  Daten laden (alle gecacht — Backtracking fragt die DB nicht erneut)
│     loadMembers()             Mitglieder + Verfügbarkeit + Präferenzen
│     loadTrainers()            Trainer + Verfügbarkeit + Qualifikationen
│     loadCourts()              Winter: nur has_indoor=true
│     loadBlockedCourtDays()    dauerhaft gesperrte Platz×Wochentag (Medenspiele)
│     loadGroups()              bestehende Gruppen des Vereins
│     loadSlotFailureRates()    historische Ausfallquote je Zeitfenster
│     loadHistoricGroups()      Gruppen der Vorsaison + deren Anwesenheitsquote
│
├─ 2  buildStandardTimeSlots()  Zeitraster 08:00–21:00 in slotDurationMinutes-Schritten
├─     buildSlotAvailabilityCaches()   O(1)-Lookups statt O(Mitglieder × Trainer)
│
├─ 3  Multi-Start: drei feste Startvarianten rechnen
│     ├─ { adultsFirst: false, useAffinity: true }   ← Default
│     ├─ { adultsFirst: true,  useAffinity: true }
│     └─ { adultsFirst: false, useAffinity: false }
│     je Variante:
│        greedyCluster()            Mitglieder sortieren, Gruppen bilden, Slots vergeben
│        backtrackForUnassigned()   nicht Untergebrachte durch Umlegen anderer retten
│        assignExtraSessions()      Zweittermin für Gruppen, wenn Kapazität übrig
│        computeMetrics()
│     die Variante mit dem besten `scorePlan` gewinnt
│
├─ 4  applyWaitlistLogic()      Überzählige nach waitlistPriorityRule auf die Warteliste
├─ 5  generateExplanations()    deutscher Klartext je Zuweisung und je Absage
└─ 6  saveToDatabase()          nur wenn dryRun === false
```

**Warum Multi-Start:** Bei einem Greedy-Verfahren entscheidet die Reihenfolge über das
Ergebnis — wer zuerst schneidet, bekommt die besten Trainer und Plätze. Statt einen
echten Constraint-Solver einzuführen, werden drei feste Varianten gerechnet und
verglichen. Kosten: Faktor 3 auf die reine Rechenzeit, die Daten werden nur einmal
geladen. Abschaltbar über `multiStart: false` (für Benchmarks).

---

## 3. Der Trainingsrahmen — die harten Bedingungen

Das ist der Teil, an dem sich entscheidet, ob ein Plan glaubwürdig ist. Die Slot-Liste
aus `buildStandardTimeSlots` reicht von **08:00 bis 21:00** — das ist die _Öffnungszeit
der Anlage_, nicht die Trainingszeit. Ohne die folgenden Grenzen legt der Algorithmus
eine Erwachsenengruppe auf Dienstag 08:00 und eine Mannschaft auf Samstagabend.

### Erhebungsgrundlage (Stand 30.08.2026)

| Verein / Verband                                                                                                                                                           | Beobachtung                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [TC Rödertal](https://www.tennisclub-roedertal.de/training/)                                                                                                               | Mannschaft Mo 17–20 · Damen Di 18–20 · Erwachsene Mi 17–20 · Kinder Sa 10–11 · Erwachsene Sa 11–12              |
| [TC Berlin Mitte](https://tc-berlin-mitte.de/trainingszeiten/)                                                                                                             | Kinder Mo/Do 14–18, Fr 14–19 · Jugend-Mannschaft Di 15–17 (2 h) · Anlage Mo–Fr bis 22, **Sa/So nur bis 20 Uhr** |
| [TSV Gaimersheim](https://www.tsvgaimersheimtennis.de/training)                                                                                                            | Erwachsene Mo/Fr 18–19, Di 17–18 · Kinder Sa 09–13                                                              |
| [Taunus Tennis](https://taunus-tennis.com/)                                                                                                                                | After-Work Do 19:30 (Anfänger) / 20:30 (Fortgeschrittene)                                                       |
| [TVN Winter-Medenspiele](https://www.tennis.de/tvn/spielbetrieb/mannschaftswettbewerbe/winter-medenspiele.html), [Bezirk 5](https://www.tvn-bezirk5.de/sport/medenspiele/) | Punktspiele **Fr abends, Sa und So** · Mannschaftstraining werktags, Schwerpunkt Di/Mi/Do ab 18 Uhr             |

### Die Regeln im Code

Alle in `findBestTimeSlot` als `continue`, also **harte** Bedingungen — nicht als Malus
in der Bewertung. Ein Verstoß ist kein schlechter Plan, sondern ein falscher.

| #   | Regel                                                   | Konfiguration                   | Default         |
| --- | ------------------------------------------------------- | ------------------------------- | --------------- |
| 1a  | Kinder Mo–Fr frühestens 14:00 (Schule)                  | fest                            | `14:00`         |
| 1b  | Kinder enden spätestens                                 | `MINOR_LATEST_END`              | `20:00`         |
| 2   | Erwachsene Mo–Fr frühestens                             | `adultEarliestWeekday`          | `17:00`         |
| 3   | Samstag nur im Fenster                                  | `saturdayStart` / `saturdayEnd` | `09:00`–`16:00` |
| 4   | Mannschaftstraining nur an diesen Tagen, ab dieser Zeit | `teamDays` / `teamEarliest`     | Mo–Do, `17:00`  |
| 5   | Sonntag ist spielfrei                                   | `includeSunday`                 | `false`         |
| 6   | Platz an diesem Wochentag dauerhaft gesperrt            | aus `court_closures` abgeleitet | —               |

**Zu Regel 2:** Vereine mit einer Vormittagsgruppe — meist Ü50 — setzen den Wert
herunter. Deshalb konfigurierbar statt fest verdrahtet. Die Verfügbarkeit der einzelnen
Mitglieder gilt zusätzlich; diese Fenster schneiden nur weg, was der Verein ohnehin
nicht anbietet.

**Zu Regel 4:** Mannschaften bekommen zusätzlich Doppelstunden
(`teamSlotMinutes: 120`). Als Mannschaft gilt: `ageGroup === 'kids' && level === 'advanced'`
(U18-Mannschaft) oder ein Level aus `teamLevels` (`advanced`, `professional`) bei
Erwachsenen.

### Regel 6 — Medenspiele, im Detail

Der Saisonplan ist ein **Wochenraster** (Wochentag + Uhrzeit), `court_closures` dagegen
ein **Datumsbereich**. Beides trifft sich nur über die Häufigkeit: eine Sperre an einem
einzelnen Samstag ist kein Grund, den Samstag dauerhaft freizuhalten — acht gesperrte
Samstage von zehn schon.

`loadBlockedCourtDays()` zählt deshalb je `Platz × Wochentag`, an wie vielen Tagen der
Saison eine aktive Sperre liegt, und nimmt die Kombination aus der Planung, wenn es
**mehr als die Hälfte** der Vorkommen dieses Wochentags sind.

Der Hauptfall dafür sind Heimspieltage: `POST /api/leagues/[id]/matchdays/[matchdayId]/courts`
legt je Platz eine `court_closure` mit `match_day_id` an, standardmäßig 09:00–20:00.
Wird der Spieltag gelöscht, gibt die DB die Plätze per `ON DELETE CASCADE` frei.

> **Bekannte Vereinfachung:** Die Sperre wird auf Tagesebene ausgewertet, nicht auf
> Stundenebene. Ein Platz, der samstags nur 09–13 Uhr für ein Heimspiel gesperrt ist,
> fällt für den ganzen Samstag aus der Planung. Solange Samstag ohnehin auf 09:00–16:00
> begrenzt ist (Regel 3), kostet das wenig; wer Regel 3 aufweicht, sollte hier
> nachziehen.

---

## 4. Weiche Bedingungen — die Bewertung

Was nicht hart verboten ist, geht als Punktzahl in die Slot-Wahl ein. Ein Slot gewinnt,
wenn er die höchste Summe erreicht.

| Kriterium                    | Wirkung                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Niveau-Homogenität           | `maxNiveauLevelSteps` (Default 1) begrenzt die Spanne innerhalb einer Gruppe hart; darunter zählt die Nähe                                   |
| Erfahrungsspanne             | `maxNiveauSpanBeginner` (4 Monate) / `maxNiveauSpanAdvanced` (8) — Anfänger vertragen weniger Streuung                                       |
| Wunschpartner                | Mitglieder mit gegenseitigem Wunsch werden zusammen sortiert (`computeAffinityGroups`)                                                       |
| Bewährte Gruppen             | `preferHistoricGroups` — wer letzte Saison zusammen und gut besucht war, bleibt zusammen (`provenGroupThreshold`, Default 80 %)              |
| Wunschtrainer / Wunschplatz  | Bonus in der Trainer- bzw. Platzwahl                                                                                                         |
| Ausfallanfällige Zeitfenster | `avoidHighFailureSlots` — historische Ausfallquote > `slotFailureThreshold` (30 %) gibt Malus, mit `treatHighFailureAsHard` sogar ein Verbot |
| Trainerauslastung            | `trainerUtilizationMaxPct` (100 %) deckelt die Wochenstunden je Trainer                                                                      |

---

## 5. Was der Algorithmus meldet, wenn es nicht aufgeht

Jede Absage bekommt einen deutschen Klartext-Grund. Das ist kein Beiwerk, sondern die
eigentliche Leistung: ein Verein muss erfahren, **warum** jemand keinen Platz hat.

```
"Keine freie Kapazität — 4 nutzbare Plätze (Wintersaison: nur Hallenplätze)
 und 20 Trainer sind ausgelastet"
"Kein verfügbarer Zeitslot mit Trainer (kids)"
"Zu Mittwoch 14:00 laut eigener Angabe nicht verfügbar — wird in zweiter Runde
 neu zugewiesen"
"Erfahrungs-Unterschied (0 vs 48 Monate)"
```

Wer am Algorithmus arbeitet, sollte diese Texte als **Regressionstest** benutzen: sagt
der Grund etwas anderes als die Zahl im Metrik-Block, stimmt eines von beiden nicht.

---

## 6. Kapazität — die Rechnung dahinter

Was in eine Woche passt, ist doppelt begrenzt: durch die Plätze **und** durch die
Trainer. Fenster Mo–Fr 14:00–21:30, Einheit 90 min → 5 Einheiten/Tag/Platz.

```
Platz-Slots/Woche  = Plätze × 5 Einheiten × 5 Tage × 0,65
Trainer-Slots/Woche = Trainer × 8 Einheiten   (~12 h Court-Zeit)
nutzbar             = min(beide)
```

Der Faktor **0,65** ist der Anteil der Primetime, der ins Training geht. Der Rest gehört
dem freien Spiel, den Medenspielen und der Platzpflege. Ein Verein, der jede Stunde
Primetime verplant, hat für seine Mitglieder keinen Platz mehr.

| Plätze | Training/Woche | Trainer nötig | Mitglieder (Ø 6/Gruppe) | Halle | **Winter** |
| ------ | -------------- | ------------- | ----------------------- | ----- | ---------- |
| 2      | 32             | 4             | ~190                    | 1     | 21 → ~126  |
| 3      | 48             | 6             | ~290                    | 1     | 21 → ~126  |
| 5      | 81             | 11            | ~490                    | 2     | 42 → ~250  |
| 8      | 130            | 17            | ~780                    | 3     | 63 → ~380  |
| 12     | 195            | 25            | ~1170                   | 4     | 85 → ~510  |

**Der Winter ist der Engpass, nicht der Sommer.** `loadCourts()` filtert in der
Wintersaison auf `has_indoor = true` — ein Verein mit 12 Plätzen und 4 Hallenplätzen
kann im Winter nur ein Drittel seines Sommerbetriebs fahren. Genau dort entsteht in
echten Vereinen die Warteliste, und genau das soll der Plan sichtbar machen.

Dieselbe Rechnung steckt in `scripts/seed-testdata.ts` (`wochenKapazitaet`), damit
Testdaten nicht mehr Gruppen enthalten, als der Verein unterrichten könnte.

---

## 7. Gemessenes Verhalten

Gegen **Claude Sandbox Gamma** (500 Mitglieder, 20 Trainer, 12 Plätze davon 4 Halle,
65 Gruppen, 400 Mitglieder-Präferenzen), lokal:

| Messung                             | Wert        |
| ----------------------------------- | ----------- |
| Rechenzeit `runClustering`          | **217 ms**  |
| Antwortzeit der Route (inkl. Laden) | 1,8 s       |
| Iterationen                         | 45          |
| Gebildete Gruppen                   | 38          |
| Zugeordnet                          | 371 von 500 |
| Niveau-Verletzungen                 | 0           |
| Trainer-Überlast-Warnungen          | 0           |

Belegung des Wochenrasters (Ausschnitt):

```
Mo 14:00×3   Mo 17:00×6   Mo 18:30×8
Di 17:00×3   Di 18:30×6
Mi 17:00×3   Mi 18:30×2
Do 17:00×3   Do 18:30×1
Fr 17:00×3
Sa —         So —
```

Nur Kids liegen auf 14:00, Erwachsene ab 17:00, Samstag ab 16:00 leer, Sonntag leer.

**Vor** dem Trainingsrahmen ordnete derselbe Lauf 404 Mitglieder zu — mit
Erwachsenengruppen um 08:00. Die 33 weniger sind kein Rückschritt, sondern der Preis
dafür, dass der Plan jetzt stimmt.

---

## 8. Wo Optimierung sich lohnt

Nach erwartetem Nutzen sortiert.

### 8.1 Greedy → echter Solver _(größter Hebel, größter Aufwand)_

Multi-Start mit drei Varianten ist ein Pflaster auf der Reihenfolge-Abhängigkeit des
Greedy-Verfahrens. Bei 500 Mitgliedern bleiben ~130 unversorgt, obwohl die reine
Kapazitätsrechnung mehr hergäbe — ein Teil davon ist echter Engpass, ein Teil sind
Sackgassen, in die sich der Greedy hineinsortiert hat.

Die Aufgabe ist ein Constraint-Satisfaction-Problem mit Zielfunktion. Bei 217 ms
Rechenzeit ist Luft für ein Verfahren, das eine Größenordnung teurer ist. Kandidaten:
lokale Suche über Tausch-Nachbarschaften auf dem Greedy-Ergebnis (billig, deutlich
besser) vor einem vollen MIP/CP-Solver (teuer, Abhängigkeit).

**Vorher messen:** wie viele der Unversorgten scheitern an Kapazität (`kapazitaetsHinweis`)
und wie viele an „kein Zeitslot mit Trainer"? Nur die zweite Gruppe ist überhaupt
gewinnbar.

### 8.2 Zweitermin-Gruppen _(mittel)_

`assignExtraSessions` vergibt einen zweiten Wochentermin, wenn Kapazität übrig ist.
Mannschaften trainieren real 2× pro Woche ([Tennis Warnemünde](https://www.tennis-warnemuende.de/spielbetrieb-training/):
„1-2× pro Woche Mannschaftstraining"). Heute ist das ein Nachgang, kein Ziel — eine
Mannschaft kann mit einem Termin durchgehen, während eine Anfängergruppe zwei bekommt.
Sinnvoll wäre ein Soll je Gruppentyp statt „was übrig ist".

### 8.3 Sperren auf Stundenebene _(klein, klar umrissen)_

Siehe Regel 6: `loadBlockedCourtDays` wertet Tage aus, nicht Stunden. Die
`court_closures`-Zeilen tragen keine Uhrzeit (nur `start_date`/`end_date`), das müsste
also erst das Schema hergeben. Solange Samstag auf 09:00–16:00 begrenzt ist, kostet die
Vereinfachung wenig.

### 8.4 Alter feiner als `kids | adult` _(klein)_

Die Engine kennt nur zwei Altersgruppen. Real trennen Vereine Bambini (4–6), Kinder
(7–10), Jugend (11–14), U18, Erwachsene, Ü50. Das schlägt auf die Zeitfenster durch:
Bambini trainieren 14:00, U18 auch mal 18:00, Ü50 vormittags. Mit `isMinor` als einzigem
Merkmal lässt sich das nicht abbilden — Regel 2 ist deshalb bewusst konfigurierbar
geblieben.

### 8.5 Ferien und Feiertage _(klein, hoher gefühlter Wert)_

Beide erhobenen Vereine schreiben „keine Trainingszeiten während der Schulferien und an
Feiertagen". `school_holidays` existiert als Tabelle, die Engine liest sie nicht.
`minTrainingWeeks` warnt nur, wenn die Saison zu wenige aktive Wochen hat.

### 8.6 Performance

Aktuell unkritisch (217 ms bei 500 Mitgliedern). Die vorhandenen Caches
(`_memberSlotAvail`, `_trainerSlotAvail`) haben den Lauf seinerzeit um ~44 % gedrückt.
Der nächste Engpass wäre nicht die Rechenzeit, sondern das Laden — die Route braucht
1,8 s bei 217 ms Rechnung.

---

## 9. Stellschrauben auf einen Blick

`ClusteringConfig`, Defaults in `DEFAULT_CONFIG`. Was aus `season_planning_configs`
kommt, ist pro Saison einstellbar; der Rest nur über den Konstruktor.

| Feld                                    | Default                | DB-Spalte? | Wirkung                                               |
| --------------------------------------- | ---------------------- | ---------- | ----------------------------------------------------- |
| `groupMinSize` / `groupMaxSize`         | 1 / 6                  | ✅         | Gruppengröße Erwachsene                               |
| `kidsGroupMinSize` / `kidsGroupMaxSize` | 1 / 8                  | ✅         | Kinder vertragen größere Gruppen                      |
| `slotDurationMinutes`                   | 60                     | ✅         | Länge einer Einheit                                   |
| `maxNiveauLevelSteps`                   | 1                      | ✅         | erlaubte Spielstärke-Spanne                           |
| `maxNiveauSpanBeginner` / `Advanced`    | 4 / 8                  | ✅         | Erfahrungsspanne in Monaten                           |
| `trainerUtilizationMaxPct`              | 100                    | ✅         | Auslastungsdeckel je Trainer                          |
| `provenGroupThreshold`                  | 80                     | ✅         | ab welcher Anwesenheit eine Gruppe „bewährt" ist      |
| `slotFailureThreshold`                  | 30                     | ✅         | ab welcher Ausfallquote ein Zeitfenster gemieden wird |
| `treatHighFailureAsHard`                | false                  | ✅         | Malus oder Verbot                                     |
| `backtrackDepth`                        | 3                      | ✅         | Tiefe der Umlege-Versuche                             |
| `unassignedRateThreshold`               | 0.05                   | ✅         | ab wann Backtracking überhaupt anläuft                |
| `teamSlotMinutes`                       | 120                    | ❌         | Doppelstunde für Mannschaften                         |
| `teamLevels`                            | advanced, professional | ❌         | wer als Mannschaft gilt                               |
| `adultEarliestWeekday`                  | `17:00`                | ❌         | Regel 2                                               |
| `saturdayStart` / `saturdayEnd`         | `09:00` / `16:00`      | ❌         | Regel 3                                               |
| `teamDays` / `teamEarliest`             | Mo–Do / `17:00`        | ❌         | Regel 4                                               |
| `includeSunday`                         | false                  | ❌         | Wizard-Checkbox pro Lauf                              |
| `multiStart`                            | true                   | ❌         | für Benchmarks abschaltbar                            |
| `minTrainingWeeks`                      | 12                     | ❌         | Warnung bei zu kurzer Saison                          |

> `backtrackDepth` stand einmal auf 0 — damit lief der komplette Backtracking-Pfad in
> Produktion nie. Wer eine Stellschraube ändert, prüft, ob der zugehörige Codepfad
> danach überhaupt erreicht wird.

---

## 10. Wie man eine Änderung prüft

1. **Unit:** `npx vitest run src/__tests__/season-planning` (11 Dateien, 197 Tests).
2. **Am echten Datenbestand:** `npm run seed:agent` baut Claude Sandbox Gamma neu
   (500 Mitglieder). Dann `POST /api/seasons/{id}/planning/cluster` mit
   `{ dryRun: true }` und CSRF-Header.
3. **Die vier Zahlen vergleichen:** zugeordnet · Gruppen · Rechenzeit ·
   `niveauSpanViolations`. Eine Änderung, die mehr zuordnet und dabei Verletzungen
   erzeugt, ist keine Verbesserung.
4. **Das Raster ansehen.** Liegt etwas Mo–Fr vor 17:00, das kein Kind ist? Liegt etwas
   auf Samstagabend oder Sonntag? Dann ist eine harte Bedingung gefallen.
5. **Die Absagegründe lesen.** Sie sind die schnellste Diagnose dafür, woran es klemmt.
