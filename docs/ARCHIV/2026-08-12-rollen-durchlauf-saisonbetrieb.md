# Rollen-Durchlauf Saisonbetrieb — 12.08.2026

> Snapshot. Archivdokument, wird nicht weitergepflegt (siehe `AGENTS.md`).
> Methode: Der Ablauf einer echten Saison wurde aus der Sicht von Tennisschul-Chef,
> Vereins-Admin, Trainer und Mitglied durchgespielt und im Code nachverfolgt —
> nicht die Feature-Liste, sondern der Weg vom Plan bis zur Rechnung.

## Kurzfassung

Der Saisonplan wird korrekt berechnet, aber beim Veröffentlichen bricht die Kette
zwischen Plan und Alltag. Drei Fehler waren so gebaut, dass sie **lokal nie
auffallen und erst in Produktion auftreten**. Sie sind behoben (Commit `cddb110f`).
Drei weitere Befunde sind Workflow-Lücken, die eine Entscheidung brauchen.

Kein toter Link im gesamten Frontend (115 Seiten-Routen gegen alle internen
Verweise geprüft) — die Navigation ist in Ordnung. Die Probleme liegen tiefer.

---

## Behoben

### 1. Zugeteilte Mitglieder wurden nie zu Buchungen (schwer)

Beim Veröffentlichen entstanden nur `sessions`. Die Zuteilung der Mitglieder blieb
allein in `season_plan_entries.expected_participants` stehen. Nichts überführte sie
in `bookings` — kein Code, kein DB-Trigger (geprüft über alle 155 Migrationen).

Die Folge im Alltag:

| Rolle       | Liest aus                              | Sah tatsächlich    |
| ----------- | -------------------------------------- | ------------------ |
| Mitglied    | `bookings` (Dashboard "Meine Termine") | nichts             |
| Trainer     | `sessions.bookings` (Teilnehmerliste)  | leere Gruppe       |
| Anwesenheit | `bookings`                             | nichts zu erfassen |
| Abrechnung  | `expected_participants`                | **rechnet ab**     |

Das Mitglied bekam also eine Rechnung für ein Training, das die App ihm nie
gezeigt hat, und der Trainer stand ohne Teilnehmerliste in der Halle. Die
Abrechnung war die einzige Stelle, die die Zuteilung überhaupt kannte.

Behoben: Buchungen entstehen jetzt in derselben Transaktion wie die Sessions.
Ohne zugewiesenen Platz entsteht keine Buchung (`bookings.court_id` ist NOT NULL,
`sessions.court_id` nicht) — beide Fälle sind durch Tests abgedeckt.

### 2. Alle Trainingszeiten um 1–2 Stunden verschoben (schwer)

`setHours()` rechnet in der Zeitzone der Laufzeit. Die Entwicklungsmaschine steht
auf Europe/Berlin, Vercel läuft UTC. Nachgerechnet:

```
Server-TZ Europe/Berlin  | Admin plant 17:00 -> DB "15:00" -> Anzeige 17:00  ok
Server-TZ UTC            | Admin plant 17:00 -> DB "17:00" -> Anzeige 19:00  falsch
```

Lokal hoben Schreiben und Anzeigen sich gegenseitig auf, in Produktion nicht.
Deshalb war der Fehler durch Testen auf der Entwicklermaschine unsichtbar.
Verstärkend: kein einziger Formatter in `lib/format.ts` setzte eine Zeitzone,
Server Components (UTC) und Browser (Berlin) rendern dieselbe Session also
unterschiedlich — auch ein Hydration-Mismatch.

Behoben: neuer Helfer `lib/berlin-time.ts` erzeugt den Zeitpunkt zur gemeinten
Ortszeit, unabhängig vom Server, inklusive Zeitumstellung. Eingesetzt in
Confirm-Route **und** Vorschau, damit beide dasselbe zeigen. Formatter setzen die
Zone jetzt explizit. Die Konvention ist rückwärtskompatibel zu Bestandsdaten.

> Bemerkenswert: `lib/utils/admin-date.ts` beschreibt genau dieses Problem im
> Kommentar — es war für zwei Admin-Widgets erkannt, aber nie auf den
> Schreibpfad oder die übrigen Formatter übertragen worden.

### 3. Vertretungstrainer galt nur für den ersten Wochentermin (mittel)

Bei Gruppen mit zwei Terminen pro Woche wurde die Vertretung nur auf den ersten
angewandt; am zweiten stand weiter der abwesende Trainer im Plan.

**Prüfung:** `npx tsc --noEmit` sauber, volle Suite 1450 Tests grün, davon neu:
Regression auf `bookingsCreated` (mit und ohne Platz), Zeitzonen- und DST-Fälle.

---

## Offen — braucht eine Entscheidung

### 4. Ein veröffentlichter Plan lässt sich nicht mehr ändern (schwer)

`confirm/route.ts` überspringt Einträge mit `status === 'published'`, und **kein
Code setzt diesen Status je zurück**. Im echten Betrieb ist das der Normalfall:
Trainer fällt aus, Gruppe wird umgelegt, Halle fällt weg. Der Admin ändert den
Plan, klickt "Veröffentlichen" — und es passiert nichts. Keine Fehlermeldung, die
alten Sessions bleiben stehen. Ein stiller Fehlschlag, der wie ein erfolgreicher
Vorgang aussieht.

Empfehlung: Beim erneuten Veröffentlichen die Sessions eines geänderten Eintrags
ersetzen (alte künftige Sessions samt Buchungen löschen, neu anlegen) und
vergangene Termine unangetastet lassen. Mindestens aber eine ehrliche Rückmeldung
"0 Einträge veröffentlicht — bereits veröffentlichte Einträge werden übersprungen"
statt eines grünen Erfolgs.

### 5. Das Mitglied kann sich nicht abmelden (mittel)

`/api/bookings/[id]/cancel` existiert, wird aber aus keiner Mitglieder-Oberfläche
aufgerufen. Absenzverwaltung gibt es nur für Trainer und Admin. Damit fehlt der
häufigste Vorgang im Vereinsalltag überhaupt: "Ich kann diesen Dienstag nicht."
Heute landet das per WhatsApp beim Trainer — also genau die Handarbeit, die das
Produkt ersetzen soll. Mit Fund 1 behoben existieren die Buchungen jetzt, die
Route ist da; es fehlt nur der Knopf.

### 6. "Training" führt das Mitglied auf die Platzbelegung (leicht)

Die Schnellzugriff-Kachel "Training" zeigt auf `/training-schedule`, das per
Redirect auf `/scheduler` (allgemeiner Platzkalender) endet. Ein Mitglied, das
seine Trainingszeiten sucht, landet in einer Belegungsansicht. Es gibt keine
Seite "Mein Trainingsplan". Ebenso wird `training_group_memberships` beim
Veröffentlichen nicht gefüllt — "Meine Gruppen" bleibt leer, gefüllt wird die
Tabelle nur beim manuellen Gruppenwechsel.

---

## Einordnung

Die Funde 1, 2 und 4 haben dieselbe Wurzel: **Veröffentlichen wird als
Schreibvorgang auf `sessions` behandelt, nicht als der Moment, in dem ein Plan
für alle Beteiligten verbindlich wird.** Alles, was daran hängt — Buchungen,
Gruppenzugehörigkeit, spätere Änderungen — ist entweder nicht angeschlossen oder
nur in eine Richtung. Vor der nächsten Feature-Arbeit an der Saisonplanung
gehört dieser eine Übergang sauber definiert; danach werden die Einzelbefunde
klein.

Der Positionierung als Betriebssystem für Tennisschulen folgend ist Fund 4 der
teuerste: eine Saison ohne Änderung nach Veröffentlichung gibt es in der Praxis
nicht.

Verwandt: `docs/ARCHIV/2026-07-26-produktaudit-verkaufsreife.md`.
