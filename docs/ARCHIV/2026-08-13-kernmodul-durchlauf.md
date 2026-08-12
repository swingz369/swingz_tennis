# Kernmodul-Durchlauf: Onboarding → Saison → Rechnung, 13.08.2026

> Snapshot. Archivdokument, wird nicht weitergepflegt (siehe `AGENTS.md`).
> Methode: Ein neuer Verein wurde **über die echten Oberflächen** aufgebaut — Owner legt den
> Verein an, lädt den Admin ein, der Admin durchläuft den Onboarding-Wizard, lädt Trainer ein
> und importiert die Mitgliederliste per CSV. Erst danach Saison, Veröffentlichung, Abrechnung.
> Das unterscheidet diesen Lauf vom Vortag: `scripts/seed-qa-club.ts` schrieb Verein und Nutzer
> direkt per Service-Client in die Datenbank und sprang damit über genau den Weg hinweg, den ein
> zahlender Kunde nimmt.
> Umgebung: lokaler Dev-Server gegen die produktive VPS-Supabase. Testverein „TC Blau-Gold Moers".

## Kurzfassung

Der Kundenweg war an **drei Stellen hart blockiert** — jede einzelne hätte einen neuen Verein
zum Telefonhörer greifen lassen:

1. Die Admin-Einladung war eine **Sackgasse ohne Ausweg**: Scheiterte der Mailversand, endete
   auch jeder Wiederholungsversuch für dieselbe Adresse in einem englischen HTTP 500.
2. Der Onboarding-Wizard konnte den **ersten Platz nicht anlegen** — die API verlangte zwei
   interne Angaben, die der Wizard nicht kennt und die es für einen neuen Verein gar nicht gibt.
3. Die Trainer-Einladung im Wizard scheiterte an derselben Wurzel wie (1), ohne sichtbare
   Fehlermeldung.

Alle drei sind behoben; der Weg von der Vereinsgründung bis zur importierten Mitgliederliste
läuft jetzt durch. Dazu kamen zwei Konfigurationsfehler auf dem Server, die kein Code-Fix
beheben kann (siehe „Offen — Serverseite").

---

## A — Onboarding

### A1. Einladungen waren eine Sackgasse (kritisch, behoben)

`POST /api/owner/invite-admin` und `POST /api/members/invite` verließen sich vollständig auf
GoTrues `invite`-Endpunkt, der Nutzeranlage **und** Mailversand in einem Schritt erledigt.
Lehnt der Mailserver die Adresse ab, meldet GoTrue `Error sending invite email` — und legt den
Nutzer nicht an. Beide Routen gaben diesen englischen Text roh als HTTP 500 in die deutsche
Oberfläche weiter.

Der eigentliche Schaden liegt eine Ebene tiefer: Der Fehler ist **nicht selbstheilend**. Die
Routen behandelten nur den Fall „Nutzer existiert bereits" (`msg` enthält `already`) als
Erfolg. Ein Versandfehler fällt nicht darunter, also endete jeder weitere Versuch für dieselbe
Adresse erneut in 500. Ein Verein, dessen Admin-Adresse einmal nicht zustellbar war, bekam über
diesen Weg **nie** einen Admin.

Behoben: Scheitert der Versand, weichen beide Routen auf `admin/generate_link` aus. Das legt den
Nutzer ohne Mailversand an und liefert den Einladungslink zurück; existiert der Nutzer schon,
genügt ein Anmeldelink. Die Antwort trägt jetzt `mailSent` und `inviteLink`, die Meldung ist
deutsch und benennt, was zu tun ist. Neuer Helfer `lib/invite-feedback.ts` zeigt den Link in
allen vier Aufrufern (Owner-Vereinsliste, Onboarding-Wizard, Mitgliederliste, Trainerverwaltung)
als dauerhaft stehende Meldung mit „Link kopieren" — eine Meldung, die nach drei Sekunden
verschwindet, wäre bei der einzigen verbleibenden Zugangsmöglichkeit die falsche Bauform.

### A2. Der erste Platz ließ sich nicht anlegen (kritisch, behoben)

Wizard-Schritt 2 antwortete mit `400 courtTypeId is required`. Der Wizard sendet Platzname,
Belag und Lage — mehr fragt er auch nicht ab. `POST /api/courts` verlangte zusätzlich
`courtTypeId` und eine positive `number`.

Beides ist strenger als die Datenbank: `courts.court_type_id` und `courts.number` sind
**nullable**, und die Tabelle `court_types` enthält im gesamten System genau **eine** Zeile —
einen globalen Standard mit `club_id IS NULL`. Kein einziger Verein hat je eigene Platztypen
angelegt. Die Route verlangte also eine ID, die der Aufrufer nicht kennen kann.

Warum das nie auffiel: Alle bestehenden Vereine stammen aus Seed-Skripten, die Plätze direkt
per Service-Client in die Tabelle schreiben und die API nie anfassen.

Behoben: Fehlt `courtTypeId`, gilt der Platztyp des Vereins, sonst der globale Standard. Fehlt
`number`, wird fortlaufend weitergezählt (`max(number) + 1` je Verein). Mitgesendete Werte
verhalten sich unverändert. Die verbliebenen Fehlermeldungen sind deutsch.

### A3. Schrittzähler widersprach der eigenen Überschrift (leicht, behoben)

„Richte deinen Verein in 3 Schritten ein" — darunter „Schritt 1 von 4". Der vierte Schritt ist
die Abschlussmeldung. Der Zähler zählt jetzt nur die Eingabeschritte und verschwindet auf der
Abschlussseite.

### A4. 403 auf jeder Seite eines neuen Vereins (mittel, behoben)

`components/layout/sidebar.tsx` fragt über `useFamilyAccounts()` bei **jedem** Seitenaufruf
`/api/family-accounts` ab. Für einen Verein ohne das optionale Feature „Familienkonten"
antwortete die Route mit 403 — ein roter Konsolenfehler auf jeder Seite, obwohl nichts kaputt
ist. Zusätzlich stand „Familienkonten" ungated in der Sidebar und führte auf eine Seite, die
der Verein nicht gebucht hat.

Behoben: Die Route antwortet bei deaktiviertem Feature mit einer leeren Liste — so hält es
`/api/admin/family-accounts` bereits. Der Sidebar-Eintrag ist jetzt hinter dem Feature-Flag,
wie „Probetrainings" und „Arbeitsdienste" es schon waren.

### Was am Kundenweg nachweislich funktioniert

- Owner legt Verein an; Owner bekommt korrekt **keine** Mitgliedschaft im neuen Verein
- Eingeladener Admin landet nach dem Login zwingend im Onboarding (`/dashboard` und `/admin`
  leiten beide dorthin, solange `setup_completed_at` leer ist)
- Wizard läuft durch alle vier Schritte; Verein, Stadt, Platz und Trainer landen in der Datenbank
- Der eingeladene Trainer bekommt `trainers.user_id` gesetzt — ohne diese Spalte wäre er in der
  Saisonplanung dauerhaft „Präferenzen ausstehend" (Fund C2 des Vortagsberichts)
- CSV-Import: 28 Zeilen, 24 Mitglieder angelegt, die drei fehlerhaften Zeilen einzeln und auf
  Deutsch begründet (ungültige Mail, fehlende Mail, zu kurzer Name), Dublette ohne Doppelanlage.
  Zweiter Lauf derselben Datei erzeugt **keine** Duplikate. Geburtsdaten bei allen 24 übernommen.

---

## Offen — Serverseite (kein Code-Fix möglich)

### S1. Alle Auth-Links führen auf den Supabase-Host statt in die App

Auf dem VPS steht in `/home/deploy/swingz-supabase/.env`:

```
SITE_URL=https://supabase.swingz.cloud
ADDITIONAL_REDIRECT_URLS=
```

GoTrue verwirft damit jedes `redirect_to`, das die App mitschickt, und ersetzt es durch die
eigene `SITE_URL`. Nachgemessen an einem echten Einladungslink: `redirect_to` zeigte auf
`https://supabase.swingz.cloud` statt auf die App. **Jeder** Einladungs-, Passwort-Reset- und
Bestätigungslink landet damit auf der API statt im Produkt.

Nötig (vom Serverbetreiber auszuführen):

```
SITE_URL=https://swingz.vercel.app
ADDITIONAL_REDIRECT_URLS=https://swingz.vercel.app/**,http://localhost:3000/**
```

danach `docker compose up -d auth` im Verzeichnis `/home/deploy/swingz-supabase/`.

### S2. `NEXT_PUBLIC_APP_URL` zeigt auf eine tote Domain

`.env.local` setzt `NEXT_PUBLIC_APP_URL=https://swingz.cloud`. Diese Domain antwortet nicht
(Verbindungsfehler); die App läuft auf `https://swingz.vercel.app`. Jeder absolute Link, den die
App daraus baut, geht ins Leere. Der Wert gehört korrigiert — lokal **und** in den
Vercel-Umgebungsvariablen.

---

## B — Saisonplanung

### B1. Ein Verein ohne Halle konnte keine Wintersaison planen (kritisch, behoben)

`loadCourts()` in `lib/season-planning/clustering-engine.ts` filterte für eine Wintersaison
hart auf `has_indoor = true`. Der Testverein hat zwei Außenplätze und keine Halle — die Abfrage
lieferte **null Plätze**, und die Planung erzeugte trotzdem klaglos einen vollständigen Plan, in
dem **alle vier Gruppen ohne Platz** dastanden.

Das trifft nicht nur Testvereine: Viele deutsche Clubs haben keine eigene Halle und spielen im
Winter auf Freiplätzen weiter. Für sie war die Wintersaison unplanbar, und der einzige Hinweis
war der Ratschlag der Konfliktprüfung, „einen freien Platz zuzuweisen" — also etwas Unmögliches.

Behoben: Liefert der Hallenfilter im Winter nichts, weicht die Planung auf die aktiven
Trainingsplätze aus und protokolliert das. Nachgeprüft: Danach hat jede Gruppe einen Platz, und
die beiden zeitgleichen Dienstagsgruppen bekommen korrekt **verschiedene** Plätze.

### B2. Mitglieder wurden zu Zeiten eingeplant, an denen sie nicht können (schwer, behoben)

Der Zeitslot einer Gruppe wird anhand der Verfügbarkeit gewählt — aber nur eines _Teils_ der
Gruppe. In die Gruppe kamen anschließend trotzdem **alle** Mitglieder der Cluster-Slice.
Konkret: drei Jugendliche (verfügbar Di/Do 16–19 Uhr, Sa 10–13 Uhr) landeten im Montagstraining
um 15:00; zwei Senioren (verfügbar Mi/Fr 9–12 Uhr) im Dienstagstraining um 18:00.

Die Konfliktprüfung meldete das korrekt als `member_unavailable` — zu diesem Zeitpunkt stand der
Plan aber schon. Behoben: Nach der Slotwahl bleiben nur die Mitglieder in der Gruppe, die zu
dieser Zeit auch können; die übrigen gehen denselben Weg wie Kapazitäts- und Avoid-Überhänge in
die zweite Runde.

Der Preis dieser Korrektheit ist sichtbar und gewollt: Zwei Senioren sind seither in **keiner**
Gruppe statt in einer, die sie nie hätten besuchen können. Ein nicht eingeplantes Mitglied kann
der Admin behandeln — ein falsch eingeplantes bekommt eine Rechnung für Training, zu dem es
nicht erscheinen kann.

### B3. Schulferien wurden nicht ausgespart, weil das Bundesland fehlte (schwer, behoben)

Die erste Veröffentlichung erzeugte **104 Einheiten** — exakt 4 Gruppen × 26 Wochen, also keine
einzige ausgelassene Ferienwoche. Trainiert wurde am 28. und 29. Dezember.

Die Ferienlogik selbst ist in Ordnung; sie hängt an `clubs.bundesland`, und dieses Feld war leer,
weil der Onboarding-Wizard nie danach fragt. Ein über die Oberfläche gegründeter Verein hat also
systematisch keine Ferien.

Behoben: Der Wizard fragt das Bundesland in Schritt 1 ab (Pflichtfeld, mit Begründung im
Hilfetext), die Auswahlwerte kommen aus `BUNDESLAND_NAMES`, damit `resolveBundeslandCode()` sie
wiedererkennt. Nachgeprüft: 104 → **80 Einheiten**, in Herbst- und Weihnachtsferien liegt kein
einziger Termin mehr.

### B4. Eine Vierergruppe hieß nach einem einzelnen Mitglied (mittel, behoben)

Im Plan stand „Einzeltraining Kids — Marie Böhm" über einer Gruppe mit **vier** Teilnehmern —
sichtbar für den Trainer und für alle Beteiligten. Der Name entsteht im Moment der Gruppenanlage,
als die Gruppe noch aus einer Person bestand; die drei weiteren kamen in der zweiten Runde dazu,
und die Gruppe wird bei jedem weiteren Lauf wiederverwendet.

Behoben in `saveToDatabase()`, wo die endgültige Belegung feststeht: Hat eine „Einzeltraining …"-
Gruppe mehr als einen Teilnehmer, wird sie umbenannt. Aus dem Beispiel wurde „Kids Gruppe 2".

### B5. Neuplanung nach dem Veröffentlichen zerstörte den Kalender (kritisch, behoben)

Nach einem erneuten Planungslauf einer bereits veröffentlichten Saison scheiterte das
Veröffentlichen mit einem rohen SQL-Fehler im Buchungs-Insert.

Ursache: `sessions.plan_entry_id` hat `ON DELETE SET NULL`. Der Planungslauf löscht die
Planeinträge — die 80 veröffentlichten Einheiten verloren dadurch nur ihren Verweis und blieben
**samt 360 Buchungen** im Kalender stehen. Die Ersetzungslogik des Veröffentlichens sucht die zu
verwerfenden Einheiten über genau diesen Verweis und fand sie deshalb nicht mehr; die neuen
Termine kollidierten mit den alten auf demselben Platz.

Im Vereinsalltag heißt das: Wer einen veröffentlichten Plan noch einmal neu berechnen lässt, kann
ihn nie wieder veröffentlichen — und im Kalender bleiben Geistertermine samt Buchungen stehen,
die keine Oberfläche mehr anzeigt.

Behoben: Der Planungslauf verwirft die **künftigen** Einheiten der gelöschten Planeinträge samt
Buchungen selbst; vergangene Termine bleiben als Historie erhalten. Nachgeprüft über den vollen
Zyklus veröffentlichen → neu planen → erneut veröffentlichen: 80 Einheiten, **0 verwaiste**.

> **Bestandsdaten:** Vereine, die vor diesem Fix nach dem Veröffentlichen neu geplant haben,
> tragen solche verwaisten Einheiten noch in der Datenbank. Sie sind an
> `sessions.plan_entry_id IS NULL` erkennbar und sollten vor dem nächsten Veröffentlichen
> geprüft werden — bewusst keine automatische Migration, weil dabei echte Buchungen gelöscht
> würden.

### B6. Die Warteliste kannte nur einen einzigen Fall (behoben)

`applyWaitlistLogic` erzeugte einen Eintrag ausschließlich dann, wenn ein Mitglied einen
Wunschpartner in einer vollen Gruppe hatte. Wer überhaupt nicht eingeplant werden konnte, fiel
lautlos heraus.

Jetzt kommt jedes Mitglied, das in keiner Gruppe gelandet ist, auf die Warteliste der fachlich
passendsten Gruppe (gleiches Niveau und gleiche Altersgruppe, sonst gleiche Altersgruppe, sonst
die erste). Im Wizard standen die Namen schon immer — die Liste war nur leer. Neu ist der Knopf
**„In Gruppe aufnehmen"**, der die bereits vorhandene, bis dahin von keiner Oberfläche
aufgerufene POST-Route nutzt. Automatisches Nachrücken bei Abmeldungen gibt es bewusst nicht.

Ergebnis im Testlauf: 2 Einträge — genau die beiden Mitglieder, die Präferenzen abgegeben, aber
keinen Platz bekommen haben. Die vier Mitglieder ohne abgegebene Präferenzen bleiben davon
unberührt und werden weiterhin namentlich im Konflikt `member_unplanned` gemeldet.

---

## C — Rollenübergreifende Funde

### C1. Mitglieder und Trainer hatten keinen Vereinskontext (kritisch, behoben)

`/api/me` lieferte jedem Mitglied `clubId: null`, `/api/user/club` antwortete mit 404.

`resolveActiveClub()` gibt für Trainer und Mitglieder **absichtlich** keinen Verein zurück — dort
gibt es kein Auswahl-Cookie, und die Server-Komponenten nutzen `requireMemberContext()`.
`withApiAuth()` übernahm diesen Wert aber ungeprüft als `auth.clubId`. **114 API-Routen** bauen
darauf auf; für die beiden häufigsten Rollen war er dauerhaft leer. Feature-Prüfungen liefen ins
Leere, der geteilte Hook `useUserData()` bekam nichts.

Behoben: Hat ein Mitglied oder Trainer genau eine aktive Mitgliedschaft, ist sein Verein
eindeutig und wird gesetzt. Bei mehreren bleibt es bei `null`, weil es ohne Auswahl keine
richtige Antwort gibt. Nachgeprüft: `/api/me` und `/api/user/club` liefern für das Mitglied jetzt
den Verein; alle 1459 Tests bleiben grün.

### C2. Vier Abfragen lieferten seit einer Schema-Änderung keine Daten mehr (schwer, behoben)

Seit `user_club_memberships.deactivated_by` einen Fremdschlüssel auf `users` bekam, gibt es
**zwei** Beziehungen zwischen den beiden Tabellen. PostgREST kann ein blankes `users(...)`-Embed
seither nicht mehr auflösen und antwortet mit `PGRST201` / HTTP 300 — also mit gar keinen Daten.

Betroffen waren `GET /api/trainers` (die Trainerliste eines Kernmoduls), die Mitgliederauswahl in
Ligen und Arbeitsdiensten sowie die Präferenzenseite des Mitglieds. Alle vier nennen jetzt die
Beziehung ausdrücklich (`users!user_club_memberships_user_id_fkey`).

Das ist dieselbe Fehlerklasse wie Fund G1 des Vortagsberichts: **ein stiller Query-Fehler, der
eine ganze Ansicht abschaltet, ohne dass irgendwo etwas rot wird.**

---

## D — Was am Ende nachweislich funktioniert

Der komplette Weg, ohne einen einzigen Eingriff an der Datenbank:

- Owner legt Verein an → Admin einladen → Onboarding-Wizard (Verein, Bundesland, Platz, Trainer)
- 24 Mitglieder per CSV importiert, drei fehlerhafte Zeilen einzeln begründet, keine Dubletten
- Saison angelegt, 23 Präferenzen erfasst, Präferenzquote meldet ehrliche **83,33 %** (20/24)
- Plan erzeugt: 4 Gruppen, jede mit Trainer und Platz, zeitgleiche Gruppen auf verschiedenen Plätzen
- Konfliktprüfung meldet nur noch, was wirklich offen ist: 6 nicht eingeplante Mitglieder
  namentlich, davon 4 ohne abgegebene Präferenzen
- Veröffentlicht: **80 Einheiten** vom 05.10.2026 bis 30.03.2027, **360 Buchungen**, keine
  Termine in Herbst- oder Weihnachtsferien
- Zeitzonen über die Umstellung hinweg korrekt (05.10. als 13:00 UTC, 21.12. als 14:00 UTC —
  beides 15:00 Ortszeit)
- Trainer sieht 60 Einheiten mit Gruppennamen, Uhrzeiten und Teilnehmerlisten
- Mitglied sieht 20 Termine, „Mein Trainingsplan" mit Abmelden-Knopf, seine Rechnung unter
  „Rechnungen & Zahlungen"
- Abrechnung deckungsgleich mit dem Plan: 18 Rechnungen, 20 Termine je Mitglied, gestaffelt nach
  Gruppengröße, **4.000,01 €**
- Voller Änderungszyklus: veröffentlichen → neu planen → erneut veröffentlichen, ohne Rückstände
- `npx tsc --noEmit` fehlerfrei, **1459 Tests grün** (89 Dateien)

---

## E — Offen (benannt, nicht behoben)

- **Zahlen widersprechen sich zwischen Seiten.** Das Mitglieder-Dashboard zeigt „Rechnungen 0
  offen", während `/billing` für dasselbe Mitglied „Ausstehend 333,33 € / 1 Rechnung" meldet;
  auf `/billing` selbst steht daneben „Gesamt 0 Rechnungen". Kein Datenfehler, sondern drei
  Kacheln mit drei verschiedenen Zählweisen.
- **Saison-Trainingsrechnungen erscheinen unter „Sonstiges — Shop, Platzgebühren, etc."** in der
  Monatsübersicht des Mitglieds.
- **Vertretungstrainer** werden weiterhin in Kalenderwochen ab Saisonbeginn eingetragen, nicht in
  konkreten Terminen (Fund H3 des Vortagsberichts, unverändert offen).
- **`resolveBundeslandCode()` fällt bei unbekannter Eingabe dokumentiert auf Hessen zurück.** Mit
  dem neuen Pflichtfeld im Onboarding ist der Weg dorthin schmaler geworden, aber ein Verein mit
  abweichend geschriebenem Bundesland bekommt weiterhin fremde Ferientermine.

---

## F — Nachtrag: die offenen Punkte, abgearbeitet

### F1. Mitglieder sahen Rechnungsentwürfe des Vereins (schwer, behoben)

Die widersprüchlichen Zähler („0 offen" im Dashboard, „1 Rechnung ausstehend" unter
`/billing`) hatten zwei verschiedene Ursachen, und die zweite wog schwerer:

- Das Dashboard zählte ausschließlich `status = 'open'`. Eine **verschickte, überfällige oder
  angemahnte** Rechnung fiel durch das Raster — systemweit betraf das 40 überfällige Rechnungen,
  deren Empfänger „0 offen" sahen.
- `/billing` zählte umgekehrt „alles außer bezahlt" — **inklusive Entwürfen**. Die 18 Rechnungen
  aus der Saisonveröffentlichung stehen auf `draft`; das Mitglied sah also eine Forderung, die
  der Verein nie verschickt hat und die beim nächsten Republish verworfen wird.

Behoben mit einer gemeinsamen Definition in `lib/billing/invoice-visibility.ts`: Entwürfe sind
für Mitglieder und Trainer unsichtbar (Admins sehen sie weiterhin), und „offen" umfasst alle
Status, bei denen tatsächlich Geld aussteht. Der Versandweg existiert bereits
(`POST /api/billing/invoices/[id]/send-email` setzt `sent`), das Verbergen führt also in keine
Sackgasse.

### F2. Saison-Trainingsrechnungen standen unter „Sonstiges" (leicht, behoben)

Die Monatsübersicht sortierte nach Positionstyp: Enthielt eine Rechnung keine Position vom Typ
`membership_fee`, landete sie unter „Sonstiges — Shop, Platzgebühren, etc.". Sortiert wird jetzt
nach `invoice_type` (`membership` | `season` | `adhoc`); Saisonrechnungen bekommen eine eigene
Zeile „Saisontraining".

### F3. Vertretung meldete Erfolg, ohne etwas geändert zu haben (mittel, behoben)

`POST …/planning/substitutes` führte ein Update aus, ohne das Ergebnis zu prüfen, und antwortete
auch bei null getroffenen Zeilen mit `success: true` samt Trainername. Jetzt liefert das Update
`.returning()`, und eine Gruppe ohne Trainingstermin in dieser Saison ergibt einen 404 mit
deutscher Begründung.

Zusätzlich beantwortet die Route jetzt die Frage, die der Admin wirklich hat: Sie gibt die
**konkreten Termine** zurück, die in das gewählte Wochenfenster fallen, und das Panel zeigt sie an
(„Vertretung für 2 Termine · 27.10.2026, 03.11.2026"). Wochennummern ab Saisonbeginn zählen
Ferienwochen mit — ohne Datumsangabe war nicht erkennbar, welche Einheiten betroffen sind.

### F4. Unbekannte Felder ergaben 500 statt 400 (leicht, behoben)

`PATCH …/plan-entries/[entryId]` baut sein Update aus einer Feld-Whitelist. Enthielt der Request
nur unbekannte Felder, blieb das Update leer und Drizzle warf „No values to set" — ein Serverfehler
für einen Eingabefehler. Jetzt: 400 mit Klartext. Die drei Vertretungsfelder, die in der Tabelle
stehen, aber nie in der Whitelist standen, werden zusätzlich akzeptiert.

### F5. Falschmeldung „Bundesland nicht erkannt" (mittel, behoben)

Die Warnung verglich die Roheingabe gegen die Liste der **Kürzel** (`NW`). Das Onboarding schreibt
seit F/B3 aber **Klarnamen** (`Nordrhein-Westfalen`), die korrekt aufgelöst werden. Jeder neu
angelegte Verein hätte also gemeldet bekommen, seine Ferien würden mit Hessen gefiltert — obwohl
alles stimmte. Neu ist `tryResolveBundeslandCode()`, das `null` liefert statt zu raten; gewarnt
wird nur noch, wenn die Auflösung wirklich fehlschlägt.

### F6. Der Trainer erfuhr nichts von einer Abmeldung (mittel, behoben)

Meldet sich ein Mitglied ab, gingen bisher nur ein Last-Minute-Alert an die übrigen Mitglieder
und ein Wartelisten-Nachrücken raus — der **Trainer der Einheit** bekam nichts. Genau dieser Weg
landet im Verein sonst per WhatsApp bei ihm. `POST /api/bookings/[id]/cancel` schreibt jetzt eine
Benachrichtigung an den Trainer mit Name und Termin (nicht-fatal: schlägt sie fehl, bleibt die
Abmeldung wirksam).

Bewusst **nicht** gebaut: das Rückgängigmachen einer Abmeldung. Der freigewordene Platz kann
zwischenzeitlich an einen Wartelisten-Eintrag gegangen sein; ein stilles „Undo" würde dann
überbuchen. Das gehört als eigener Vorgang entworfen, nicht als Knopf nachgereicht.

### F7. Ein Test hing am Kalendertag (behoben)

`trainer-availability-manager.integration.test.tsx` leitet seine Fixtures aus `new Date()` ab
(Montag der laufenden Woche). In der Nacht zum 13.08.2026 fiel die Datei deshalb mitten im
Durchlauf mit drei Fehlern um — nachgeprüft auch auf unverändertem `HEAD`, also keine Regression
dieser Arbeit. Die Systemzeit ist jetzt im Test fixiert.

### F8. E-Mail-Versand ist vollständig blockiert (kritisch, nicht behebbar im Code)

Beim Versuch, eine Rechnung zu verschicken, antwortete Resend:

```
The swingz.cloud domain is not verified.
```

Das ist die wahre Ursache der Einladungsfehler aus A1 — nicht die Empfängeradresse, sondern die
**Absenderdomain**. `EMAIL_FROM` steht auf `SwingZ <noreply@swingz.cloud>`, und diese Domain ist
bei Resend nicht verifiziert. Damit verschickt SwingZ **derzeit keine einzige E-Mail**:
Einladungen, Rechnungen, Mahnwesen, Saisonbestätigungen.

Nötig: Domain in Resend verifizieren (DNS-Records) oder `EMAIL_FROM` auf eine verifizierte
Absenderdomain umstellen. Die in A1 gebaute Ausweichlösung (Einladungslink statt Mail) hält den
Onboarding-Pfad bis dahin offen — sie ersetzt den Mailversand aber nicht.

### Stand nach dem Nachtrag

`npx tsc --noEmit` fehlerfrei, **1459 Tests grün** (89 Dateien).

---

## G — Nachtrag 2: Infrastruktur und die restlichen Produktentscheidungen

### G1. Auth-Links führen wieder in die App (behoben, Serverseite)

Auf dem VPS gesetzt und mit `docker compose up -d auth` übernommen:

```
SITE_URL=https://swingz.vercel.app
ADDITIONAL_REDIRECT_URLS=https://swingz.vercel.app/**,https://swingz.cloud/**,http://localhost:3000/**
```

Beide Domains stehen bewusst drin, damit der geplante Wechsel auf `swingz.cloud` nichts bricht.
Nachgeprüft an einem echten Link: `redirect_to` zeigt jetzt auf die App statt auf den
Supabase-Host. Sicherung der alten Datei: `/home/deploy/swingz-supabase/.env.bak-20260813-authurl`.

### G2. Vercel-Umgebung korrigiert (behoben)

`NEXT_PUBLIC_APP_URL` und `NEXT_PUBLIC_SITE_URL` stehen jetzt in **Production und Preview** auf
`https://swingz.vercel.app`. Sie greifen erst mit dem nächsten Deployment.

Zwei Nebenbefunde: Das Repo war lokal mit dem **falschen** Vercel-Projekt verknüpft (`tennis`
statt `swingz`) — korrigiert. Und `swingz.cloud` hängt in Vercel am Projekt **`master`**, während
die DNS-Einträge der Domain auf einen Hetzner-Host zeigen; deshalb antwortet sie nicht.

### G3. Eine Basis-URL statt zwei Variablennamen (behoben)

Dreizehn Stellen lasen `NEXT_PUBLIC_APP_URL` oder `NEXT_PUBLIC_SITE_URL` mit fünf verschiedenen
Rückfallwerten — darunter zweimal die tote Domain `swingz.cloud` und einmal ein leerer String.
Neu ist `lib/app-url.ts` mit `appBaseUrl(fallback?)`: validiertes `env` zuerst, dann `process.env`,
dann der Fallback des Aufrufers (etwa `request.nextUrl.origin`), zuletzt die produktive Adresse.

### G4. Das Benachrichtigungssystem war stumm (kritisch, behoben)

Beim Testen der Abmelde-Benachrichtigung landete nichts in der Datenbank. Grund:
`notifications_type_check` erlaubte nur `info | warning | success | error | booking | invoice |
training`. Von zehn Insert-Stellen im Code verwendeten **neun** einen anderen Typ —
`waitlist_promoted`, `member_deactivated`, `absence_alert`, `billing`, `message_received`,
`membership_created` und weitere. Jeder dieser Inserts schlug fehl, und weil alle Aufrufer den
Fehler bewusst als nicht-fatal abfangen, fiel es nie auf: Die Tabelle enthielt **systemweit
0 Zeilen**.

Migration `20260813090000_notifications_type_values.sql` weitet die Constraint auf die tatsächlich
verwendeten Typen; angewendet und nachgeprüft. Danach landen die Benachrichtigungen — verifiziert
mit Abmeldung und Rücknahme, beide mit korrekter Berliner Uhrzeit. `docs/DATABASE.md` hält die
Regel fest, dass ein neuer Typ im Code eine Migration braucht.

### G5. Abmeldung lässt sich zurücknehmen (neu)

Neue Route `POST /api/bookings/[id]/reactivate` und der Knopf **„Doch teilnehmen"** unter „Mein
Trainingsplan". Der Platz wird nur zurückgegeben, wenn er noch frei ist — zwischen Abmeldung und
Reue kann jemand von der Termin-Warteliste nachgerückt sein; sonst gäbe es eine überbuchte
Einheit. Der Trainer bekommt auch die Rücknahme als Benachrichtigung.

### G6. Warteliste rückt automatisch nach (neu)

`lib/season-planning/waitlist-promotion.ts` füllt frei gewordene Plätze aus `season_waitlists`.
Ausgelöst wird das im Plan-Editor: Schrumpft `expected_participants` eines Eintrags, rücken
Wartende nach. Ein Mitglied rückt nur nach, wenn in **allen** Terminen der Gruppe Platz ist — eine
Gruppe mit zwei Einheiten pro Woche ist eine Einheit, kein halber Platz.

### G7. Rechnungen sammelweise versenden (neu)

`/admin/billing` zeigt jetzt „**N Rechnungen im Entwurf — für Mitglieder noch nicht sichtbar**"
mit dem Knopf „Alle Entwürfe versenden"; bei getroffener Auswahl „Ausgewählte versenden". Der
Versand läuft seriell über dieselbe Route wie der Einzelversand, damit bei einem Teilfehler
erkennbar bleibt, welche Rechnung betroffen ist.

### G8. „Meine Gruppen" gebaut (neu)

`GET /api/user/member/groups` las `training_group_memberships` — eine Tabelle, welche die
Saisonplanung nie beschreibt. Die Route lieferte deshalb jedem Mitglied eine leere Liste, und
keine Oberfläche rief sie auf. Sie leitet die Gruppen jetzt aus dem Saisonplan ab und liefert
Name, Termin, Trainer, Platz und Gruppengröße. Neue Karte `components/bookings/my-groups.tsx` auf
„Mein Trainingsplan". Nachgeprüft: „Anfänger Gruppe 4, Dienstag 18:00–19:00, Kai Brenner,
Platz 1, 3 Teilnehmer".

### G9. Trainer-Identität: der Doppelbau ist entschärft (behoben)

Der dokumentierte Doppelbau bestand aus zwei Routen auf derselben Tabelle. Gefährlich war nicht
die Doppelung, sondern dass sie **den Trainer unterschiedlich auflösten**: `GET
/api/trainer/availability` und `GET /api/trainer/me` suchten über `trainers.email` (`ilike`), der
Admin-Pfad und der POST derselben Datei über `trainers.user_id`. Sobald eine Adresse geändert wird
oder zwei Trainerzeilen dieselbe tragen, zeigen Selbst- und Adminansicht verschiedene Daten.

Beide Lesepfade laufen jetzt über `trainers.user_id`. Die beiden Routen bestehen weiter — sie
widersprechen sich aber nicht mehr. Dabei fiel auf, dass `/api/trainer/me` „diese Woche" als
„alles ab vor sieben Tagen" zählte und für eine im Oktober beginnende Saison 60 Einheiten meldete;
jetzt Montag bis Sonntag der laufenden Woche (nachgeprüft: 0).

### G10. Kein Vereinswechsel für Trainer und Mitglieder (Entscheidung)

Bestätigt und in `docs/BUSINESS_RULES.md` festgehalten: Trainer und Mitglieder arbeiten immer im
Kontext genau eines Vereins. Nur `superadmin` und `owner` wechseln. `auth.clubId` kommt für die
beiden Rollen aus der einzigen aktiven Mitgliedschaft; bei mehreren bleibt der Wert `null`.

## Reproduktion

```bash
npx tsx scripts/seed-qa-club.ts --csv > mitglieder.csv   # Mitgliederliste zum Import
# Owner legt Verein an und lädt den Admin ein; Admin durchläuft /admin/onboarding
# und importiert mitglieder.csv unter /admin/members
npx tsx scripts/seed-qa-club.ts --prefs <seasonId>       # Präferenzen
npx tsx scripts/seed-qa-club.ts --purge <clubId>         # alles restlos entfernen
```

Verwandt: `docs/ARCHIV/2026-08-12-saisonplanung-durchlauf-qa-verein.md`,
`docs/ARCHIV/2026-08-12-rollen-durchlauf-saisonbetrieb.md`.
