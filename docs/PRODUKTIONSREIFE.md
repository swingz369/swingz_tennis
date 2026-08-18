# Weg zur Produktionsreife

> Zuletzt verifiziert: 18. August 2026
>
> Lebendes Dokument. **Der Plan** — was in welcher Reihenfolge passieren muss, damit SwingZ ein
> Produkt ist, das ein Verein kauft, benutzt und behält.
>
> Verhältnis zu [`OPEN_ITEMS.md`](OPEN_ITEMS.md): dort steht die **flache Liste** aller bekannten
> Einzelbefunde (P0–P3). Hier steht die **Reihenfolge, die Begründung und das Abnahmekriterium**.
> Einzelbefunde werden hier per Verweis referenziert, nicht abgeschrieben. Wer einen Punkt
> erledigt, streicht ihn in `OPEN_ITEMS.md` und hakt hier das Phasen-Gate ab.

---

## 0. Wie dieses Dokument zu lesen ist

Jeder Punkt hat vier Angaben. Ohne die vier ist es kein Plan, sondern eine Wunschliste:

| Feld         | Bedeutung                                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| **Warum**    | Was im echten Leben schiefgeht, wenn es fehlt — nicht „Best Practice"          |
| **Nachweis** | Wie man _sieht_, dass es erledigt ist. Ein Befehl, ein Klickweg, eine Abfrage. |
| **Aufwand**  | S = ≤ ½ Tag · M = 1–3 Tage · L = ≥ 1 Woche                                     |
| **Braucht**  | Vorbedingung. Was ohne das Vorherige sinnlos ist                               |

**Herkunft der Befunde.** Mit ✅ markierte Aussagen habe ich am 18.08.2026 selbst gegen dieses
Repo bzw. die lokale DB geprüft. Mit 📄 markierte stammen aus `OPEN_ITEMS.md` / den Archiv-Audits
und sind **heute nicht nachgeprüft** — für die ist der erste Schritt jeweils „Zustand prüfen".

---

## 1. Was „produktionsreif" hier heißt

Nicht „fehlerfrei". Produktionsreif heißt: **ein fremder Verein kann SwingZ kaufen, allein in
Betrieb nehmen, eine Saison damit fahren und Geld einziehen — und wenn dabei etwas kaputtgeht,
merkst du es vor dem Kunden.**

Daraus folgen fünf Freigabekriterien. Alles in diesem Dokument dient genau einem davon:

| #      | Kriterium                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------- |
| **F1** | **Was gebaut ist, läuft.** Der Stand im Repo ist der Stand in Produktion.                          |
| **F2** | **Der Kunde kommt allein rein.** Registrierung → Bezahlung → eingerichteter Verein ohne dich.      |
| **F3** | **Der Alltag hält.** Die fünf Rollen kommen durch ihre Kernaufgabe, ohne Anleitung, auch am Handy. |
| **F4** | **Geld und Recht stimmen.** Rechnungen gehen raus, DSGVO-Pflichten sind bedienbar, Daten sicher.   |
| **F5** | **Ausfälle sind sichtbar.** Fehler, Ausfälle und stillstehende Jobs melden sich von selbst.        |

---

## 2. Ist-Stand, gemessen (18.08.2026)

Das Gute zuerst — die technische Basis ist deutlich besser als der Betriebszustand:

| Prüfung               | Ergebnis                                                   |
| --------------------- | ---------------------------------------------------------- |
| ✅ `npx tsc --noEmit` | 0 Fehler                                                   |
| ✅ `npm run lint`     | 0 Findings                                                 |
| ✅ `npx vitest run`   | 504 Suites, **1543 grün / 0 rot**, 10 übersprungen         |
| ✅ `npm run build`    | erfolgreich, alle Routen kompilieren                       |
| ✅ Migrationen lokal  | laufen von Baseline durch, inkl. der neuen Mitgliedsnummer |
| ✅ CI                 | 4 Workflows: `ci`, `db-audit`, `monitor`, `perf-bench`     |
| ✅ Umfang             | ~255 API-Routen, 99 Seiten, 5 Rollen                       |

Und jetzt der Betriebszustand — hier liegt das eigentliche Problem:

> ✅ **`main` steht auf dem Stand vom 12. August. Der Arbeitsstand ist 50 Commits + 69 geänderte
> Dateien davor. Vercel deployt aus `main`. Also läuft in Produktion nichts davon.**

Was dadurch **nicht** in Produktion ist (Auszug aus den 50 Commits):

- `fix(security): SSRF/CRON_SECRET-Leck in Backup-Route beheben` — ein Sicherheitsfix liegt seit
  Tagen unveröffentlicht herum.
- Die Baseline-Konsolidierung der Migrationen, die Club-Scoping-Fixes, 21 weitere `fix`-Commits.
- `.github/workflows/monitor.yml` — die Erreichbarkeits- und Backup-Überwachung. Der Workflow
  läuft laut GitHub-Regel **nur auf dem Standard-Branch**. Er liegt nicht auf `main`.
  **Es findet derzeit also gar keine Überwachung statt.**

Dazu 69 uncommittete Dateien im Arbeitsverzeichnis, die zwei unabhängige Vorhaben mischen: eine
Design-Vereinfachung (Aurora-/Noise-/Gradient-Effekte raus, netto −110 Zeilen über 60 Dateien)
und die heute gebaute Mitgliedsnummer — auf einem Branch, der `refactor/season-auth-helper-adoption`
heißt und mit beidem nichts zu tun hat.

**Das ist der wichtigste Befund dieses Dokuments.** Es nützt nichts, Features zu bauen, solange
der Auslieferungsweg verstopft ist. Deshalb ist Phase 0 keine Aufräumarbeit, sondern die
Voraussetzung für alles Weitere.

---

## 3. Die fünf Rollen im echten Leben

Nicht „der User", sondern konkrete Menschen in konkreten Situationen. Für jede Rolle: das
realistische Szenario, wo es heute bricht, und in welcher Phase das behoben wird.

### 3.1 Owner — du, Swingz GmbH

**Szenario.** Ein Verein sagt auf der Messe zu. Du willst ihn am selben Abend live haben und ab
dem nächsten Monat abrechnen.

| Schritt                               | Heute                                  | Bruch                                                        |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Verein anlegen                        | `/owner/clubs` ✅ vorhanden            | —                                                            |
| Admin einladen                        | `/api/owner/invite-admin` ✅ vorhanden | 📄 Einladungsmail geht nicht raus → Link muss manuell        |
| Verein zahlt                          | Abo-Gate existiert auf API-Ebene       | 📄 **Neukonten starten im Freemium-Default** → kein Geld     |
| Du siehst, dass es dem Kunden gutgeht | `/owner/audit`, `/owner/billing`       | ✅ keine Überwachung aktiv (s. o.) → Ausfall fällt nicht auf |

→ **Phase 1 (E-Mail), Phase 3 (Pflicht-Abo), Phase 0 + 5 (Überwachung).**

### 3.2 Superadmin — Leiter einer Tennisschule

**Szenario.** Betreut drei Vereine, wechselt im Laufe eines Abends zwischen ihnen hin und her.

Club-Switcher und Mehr-Vereins-Kontext sind gebaut (`/select-admin-club`, `ADMIN_CLUB_COOKIE`).
📄 Der bekannte Fallstrick: RLS-Policies, die `is_superadmin()` ungescoped auswerten, und
Abrechnungstabellen ohne erreichbares `club_id`. Das ist keine Bequemlichkeitsfrage — es
entscheidet, ob Verein A die Zahlen von Verein B sieht.

→ **Phase 2.**

### 3.3 Admin — ehrenamtlicher Vorstand

**Die wichtigste Rolle und die anspruchsvollste.** Realistisch: 55 Jahre, macht das nebenbei,
zwei Stunden die Woche, meist abends auf dem Sofa mit dem Handy oder dem alten iPad des Vereins.
Hat vorher Excel benutzt und wird sofort zurückwechseln, wenn etwas dreimal hakt.

| Aufgabe                  | Heute                                                                                                                           | Bruch                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Verein einrichten        | `/admin/onboarding`-Wizard ✅                                                                                                   | 📄 nie am Stück mit echten Vereinsdaten durchgespielt |
| Mitglieder importieren   | CSV-Import ✅ (auch in der Mitgliederverwaltung)                                                                                | —                                                     |
| Mitglied wiederfinden    | ✅ **seit heute: Suche nach Mitgliedsnummer** (s. Anhang A)                                                                     | —                                                     |
| Saison planen            | Wizard + Auto-Planung ✅                                                                                                        | 📄 Der Publish-Übergang ist die bekannte Bruchstelle  |
| Beiträge abrechnen       | Rechnungslauf, SEPA-pain008, DATEV-Export ✅                                                                                    | 📄 **Versand tot** — Rechnung bleibt auf `draft`      |
| Nachschauen, was los ist | Zu viele Orte: `/bookings`, `/bookings-unified`, `/my-bookings`, `/courts`, `/courts/daily`, `/scheduler`, `/training-schedule` | ✅ **7 Oberflächen für „wer ist wann auf dem Platz"** |
| Etwas mitteilen          | `/messages`, `/news`, `/newsletters`, `/email-campaigns`                                                                        | ✅ **4 Oberflächen für „ich will was sagen"**         |

Die letzten beiden Zeilen sind der Grund, warum ein ehrenamtlicher Vorstand aufgibt. Nicht ein
Fehler, sondern die Unmöglichkeit zu erraten, welche der sieben Seiten die richtige ist.

→ **Phase 1 (E-Mail), Phase 4 (Informationsarchitektur), Phase 3 (Onboarding-Probelauf).**

### 3.4 Trainer

**Szenario.** Freitag, 19:40, letzte Stunde vorbei, es nieselt. Er will in unter einer Minute
auf dem Handy eintragen, dass er heute drei Stunden gemacht hat, und nach Hause.

Erfassung, Abwesenheiten, Verfügbarkeiten, Gruppen sind vorhanden (`/trainer/*` — 7 Seiten).
📄 Der bekannte Punkt: die Sidebar ist für Trainer toter Code, der reale Einstieg sind die
Dashboard-Schnellaktionen. Ob der Weg „Login → Stunden eintragen → fertig" auf einem echten
Handy in unter einer Minute geht, ist nie gemessen worden.

→ **Phase 4.**

### 3.5 Mitglied und Eltern

**Szenario A.** Vater, will für die Tochter (9) die Wunschzeiten fürs Wintertraining eintragen.
**Szenario B.** Mitglied bekommt die Jahresrechnung und will sie bezahlen.

Familienkonten, Präferenzerfassung, Rechnungs-Checkout über Stripe sind gebaut. 📄 Zwei bekannte
Punkte: das Mitglied ohne aktive Mitgliedschaft landet in einer Sackgasse, und Präferenzen hingen
an einem Alters­gruppen-Bug. Neu und heute geprüft:

- ✅ **Es gibt keine Selbstauskunft nach DSGVO Art. 15.** Unter `/api/user/` liegen `delete`
  (Löschung/Anonymisierung ist verdrahtet), `me`, `club`, `member`, `notifications`, `roles` —
  aber keine Route, die einem Mitglied seine Daten als Paket herausgibt. Bei einem deutschen
  Vereins-SaaS ist das eine Anfrage, die kommt.
- ✅ Die heute vergebene Mitgliedsnummer sieht das Mitglied noch nicht (s. Anhang A, Rest).

→ **Phase 2 (DSGVO), Phase 4 (Sackgassen).**

---

## 4. Die Phasen

Streng in dieser Reihenfolge. Jede Phase hat ein Gate; ohne bestandenes Gate wird die nächste
nicht angefangen. Das ist der Punkt an dem Pläne sonst zerfallen.

---

### Phase 0 — Den Auslieferungsweg freimachen

> **Ziel: Was im Repo steht, läuft auch. (F1)**
> Ohne das ist jede weitere Arbeit unsichtbar. Diese Phase ist die kürzeste und die wichtigste.

| ID      | Aufgabe                                                                                                                                                   | Aufwand |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **0.1** | Arbeitsverzeichnis entflechten: Design-Vereinfachung und Mitgliedsnummer sind zwei Vorhaben und gehören in zwei Commits, nicht in einen Klumpen.          | S       |
| **0.2** | Branch `refactor/season-auth-helper-adoption` (50 Commits) nach `main` mergen. Vorher: `tsc`, `lint`, `vitest`, `build` — alle vier sind heute grün.      | S       |
| **0.3** | Deploy verifizieren: die Sicherheitsfixes sind wirklich live, nicht nur gemerged.                                                                         | S       |
| **0.4** | Prüfen, dass `monitor.yml` nach dem Merge auf `main` liegt und der 30-Minuten-Lauf tatsächlich feuert. Einen Fehlalarm provozieren und die Mail abwarten. | S       |
| **0.5** | Regel festhalten: kein Arbeitsstand älter als eine Woche außerhalb von `main`. Kleine Branches, häufig mergen.                                            | S       |

**Gate 0:** `git log main..HEAD` ist leer, `git status` ist sauber, der Health-Endpunkt in
Produktion antwortet, und der Monitor-Workflow hat mindestens einmal grün gemeldet.

**Aufwand gesamt: 1 Tag.**

---

### Phase 1 — Betriebsfähigkeit: die harten Blocker

> **Ziel: nichts ist mehr strukturell tot. (F4, F5)**
> Alle Punkte hier stehen in `OPEN_ITEMS.md` unter P0. Hier steht nur die Reihenfolge und
> was jeweils der Nachweis ist.

| ID      | Aufgabe                                        | Warum (echtes Leben)                                                                                                                                                                    | Nachweis                                                                                                                    | Aufwand |
| ------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| **1.1** | 📄 E-Mail-Versand reparieren                   | **Ohne Mail ist SwingZ kein Produkt.** Keine Einladung, keine Rechnung, keine Mahnung, keine Saisonbestätigung. Ein Verein, der Beiträge nicht einziehen kann, kündigt im ersten Monat. | Rechnung an eine echte Adresse verschicken, Zustellung im Postfach bestätigen; Status wechselt von `draft` auf `sent`.      | M       |
| **1.2** | 📄 Rohe SQL-/DB-Fehler nicht mehr durchreichen | Ein 500er lieferte das komplette Drizzle-Statement mit Tabellen- und Spaltennamen an den Browser. Das ist ein Bauplan für einen Angreifer und für den Nutzer wertlos.                   | Alle Routen mit `error.message` in der Antwort durchgehen; ein absichtlich erzeugter Fehler zeigt deutschen Text, kein SQL. | M       |
| **1.3** | 📄 Nicht angewendete Migrationen abarbeiten    | Migrationsdateien, die nie liefen, bedeuten: das Schema im Repo und das Schema in Produktion sind verschiedene Dinge. Jede Annahme darüber ist ab dann geraten.                         | `supabase_migrations.schema_migrations` gegen das Verzeichnis abgleichen; Differenz erklärt oder null.                      | M       |
| **1.4** | 📄 Tabellen mit RLS aber ohne Policies         | `season_planning_configs`, `season_statistics`: RLS an, 0 Policies. Das ist entweder eine Lücke oder eine bewusste Entscheidung — heute weiß es niemand.                                | Für jede Tabelle: Policy vorhanden **oder** in `DATABASE.md` als bewusst service-only dokumentiert.                         | S       |

**Gate 1:** Eine echte Rechnung wurde per Mail zugestellt und über den Stripe-Link bezahlt.
`OPEN_ITEMS.md` hat keinen P0-Eintrag mehr, der nicht entweder erledigt oder als
Infrastruktur-Thema nach Phase 5 verschoben ist.

**Aufwand gesamt: 1 Woche.**

---

### Phase 2 — Geld und Recht

> **Ziel: das Produkt ist in Deutschland verkaufbar, ohne dass ein Datenschutzbeauftragter
> es stoppt. (F4)**

| ID      | Aufgabe                                                     | Warum (echtes Leben)                                                                                                                                                                                             | Nachweis                                                                                                                | Aufwand | Braucht |
| ------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- | ------- |
| **2.1** | ✅ Selbstauskunft nach Art. 15 DSGVO                        | Ein Mitglied verlangt seine Daten. Frist: ein Monat. Ohne Route macht das ein Mensch von Hand aus fünf Tabellen — pro Anfrage, pro Verein.                                                                       | `GET /api/user/export` liefert alle personenbezogenen Daten des Anfragenden als JSON; ein Klickweg im Profil führt hin. | M       | —       |
| **2.2** | 📄 RLS-Scoping der Abrechnungstabellen abschließen          | `billing_periods` / `trainer_billings` / `billing_line_items` ohne erreichbares `club_id`. Ein Superadmin mit drei Vereinen sieht potenziell Fremdzahlen. Migration liegt vorbereitet.                           | Policy-Namen per `pg_policies` verifizieren, Migration anwenden, mit zwei Vereinen gegenprüfen.                         | M       | 1.3     |
| **2.3** | 📄 `users` ist cross-tenant lesbar                          | Jedes Mitglied kann die Namen aller Nutzer aller Vereine abrufen. Entweder gewollt (dann dokumentieren) oder nicht (dann Policy).                                                                                | Entscheidung in `BUSINESS_RULES.md`; bei „nicht gewollt": Abfrage aus fremdem Verein liefert 0 Zeilen.                  | S       | —       |
| **2.4** | 📄 Drizzle-Pfad umgeht RLS + unverschlüsselter DB-Transport | ~26 Routen laufen als `postgres` (BYPASSRLS); der Pooler akzeptiert Klartext. Zwei Infrastrukturthemen, keine Migration. Gehört sachlich hierher, terminlich in Phase 5, weil VPS-Arbeit.                        | Eigene App-Rolle ohne BYPASSRLS; `psql` verweigert unverschlüsselte Verbindung.                                         | L       | VPS     |
| **2.5** | Rechtstexte gegen den Ist-Zustand prüfen                    | `impressum`, `datenschutz`, `avv`, `terms` existieren als Seiten. Ob die Auftragsverarbeiter darin (Supabase, Stripe, Resend, Vercel, Google Gemini, Upstash) vollständig und aktuell sind, hat niemand geprüft. | Liste der tatsächlich eingesetzten Dienste aus `SERVICES.md` gegen die Datenschutzerklärung abgleichen.                 | S       | —       |
| **2.6** | Löschkonzept aufschreiben                                   | Löschung ist verdrahtet (`/api/user/delete` anonymisiert und erhält GoBD-Belege). Aber es gibt kein Dokument, das Fristen je Datenart festhält. Das ist die erste Frage im Audit.                                | Ein Abschnitt in `DATABASE.md`: Datenart → Aufbewahrungsfrist → Mechanismus.                                            | S       | —       |

**Gate 2:** Ein Mitglied kann Auskunft und Löschung selbst auslösen. Zwei Vereine im selben
Superadmin-Konto sehen nachweislich keine gegenseitigen Finanzdaten.

**Aufwand gesamt: 1–2 Wochen** (ohne 2.4).

---

### Phase 3 — Der erste zahlende Kunde ohne dich

> **Ziel: F2 — Registrierung bis eingerichteter, zahlender Verein ohne einen einzigen manuellen
> Handgriff von dir.**
> Solange du bei jedem Kunden dabei sein musst, ist es Beratung, kein SaaS.

| ID      | Aufgabe                                           | Warum (echtes Leben)                                                                                                                                                                                     | Nachweis                                                                                                                 | Aufwand | Braucht |
| ------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------- |
| **3.1** | 📄 Pflicht-Abo für Neukonten                      | Neukonten starten im Freemium-Default. Wer nicht bezahlen _muss_, bezahlt nicht. Das ist kein Feature, das ist das Geschäftsmodell.                                                                      | Neuer Verein ohne aktives Abo kommt über den Onboarding-Wizard nicht hinaus; nach Stripe-Checkout schaltet er frei.      | M       | 1.1     |
| **3.2** | Onboarding einmal am Stück durchspielen           | Der Wizard existiert. Ob ein fremder Mensch damit von null auf „erste Saison geplant" kommt, weiß niemand — das hat nie jemand durchgemessen. `TC Neuland e.V.` ist genau dafür da und absichtlich leer. | Ein Mensch ohne Vorwissen richtet `TC Neuland` ein. Jeder Punkt, an dem er fragen muss, ist ein Befund.                  | M       | 3.1     |
| **3.3** | Aus den Befunden aus 3.2 die Top-5 beheben        | Ein Onboarding, das an fünf Stellen hakt, hat eine Abbruchquote nahe 100 %.                                                                                                                              | Zweiter Durchlauf mit einem zweiten Menschen, ohne Rückfragen.                                                           | M       | 3.2     |
| **3.4** | Ersten Rechnungslauf vollständig durchführen      | Beiträge festlegen → Rechnungen erzeugen → versenden → Zahlung → Mahnung. Der Weg, für den der Verein bezahlt. Bisher nur in Einzelteilen belegt.                                                        | Ein kompletter Lauf in der Agent-Lane, inklusive einer absichtlich überfälligen Rechnung bis zur Mahnstufe.              | M       | 1.1     |
| **3.5** | Ein Ausstiegsweg (Datenexport des ganzen Vereins) | Kein Verein kauft ein System, aus dem er seine Mitgliederdaten nicht wieder herausbekommt. Das ist eine Verkaufsfrage, keine technische.                                                                 | Admin lädt Mitglieder, Buchungen und Rechnungen als CSV; die Datei öffnet sich in Excel korrekt (Umlaute, Trennzeichen). | S       | —       |

**Gate 3:** Ein Verein, den du nie angefasst hast, ist registriert, hat bezahlt, hat Mitglieder
importiert, hat eine Saison geplant und eine Rechnung eingezogen.

**Aufwand gesamt: 2–3 Wochen.**

---

### Phase 4 — Der Alltag hält

> **Ziel: F3 — die fünf Rollen kommen ohne Anleitung durch ihre Kernaufgabe, auch am Handy.**
> Hier wird nichts Neues gebaut. Hier wird weggeräumt und ehrlich gemacht.

| ID      | Aufgabe                                        | Warum (echtes Leben)                                                                                                                                                                                                                                       | Nachweis                                                                                                      | Aufwand |
| ------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| **4.1** | ✅ Platzbelegung: aus 7 Oberflächen 1 machen   | `/bookings`, `/bookings-unified`, `/my-bookings`, `/courts`, `/courts/daily`, `/scheduler`, `/training-schedule`. Ein ehrenamtlicher Vorstand kann nicht raten, welche gemeint ist. Jede zusätzliche Seite ist eine Fehlentscheidung, die er treffen muss. | Eine Seite pro Rolle für „wer ist wann auf dem Platz". Alte Pfade leiten um, sind nicht nur unverlinkt.       | L       |
| **4.2** | ✅ Kommunikation: aus 4 Oberflächen 1–2 machen | `/messages`, `/news`, `/newsletters`, `/email-campaigns`. Vier Wege, um dasselbe zu sagen. Der Admin nutzt am Ende keinen, weil er nicht weiß, welcher der richtige ist.                                                                                   | Ein Weg „an alle" und ein Weg „an eine Person". Alles andere weg oder eingegliedert.                          | M       |
| **4.3** | Ein Handy-Durchlauf pro Rolle, gemessen        | Der Trainer steht im Nieselregen. Wenn Stunden eintragen länger als eine Minute dauert, macht er es nicht — und dann stimmt die Abrechnung nicht.                                                                                                          | Pro Rolle ein echter Klickweg auf einem echten Handy, mit Zeitmessung. Alles über 60 Sekunden ist ein Befund. | M       |
| **4.4** | 📄 Sackgassen beseitigen                       | Mitglied ohne Mitgliedschaft, deaktivierte Module, leere Listen — überall dort steht heute teils eine Null statt einer Erklärung. Eine Null sieht aus wie ein Fehler des Nutzers.                                                                          | Jede leere Ansicht sagt, _warum_ sie leer ist und was zu tun ist.                                             | M       |
| **4.5** | 📄 Fail-open-Darstellungen aufspüren           | Ein 403 als „0 Punkte" anzuzeigen ist schlimmer als ein Fehler: es sieht aus, als funktioniere es. Der Fall ist einmal gefixt worden — es ist unklar, wie viele gleichartige Stellen es noch gibt.                                                         | Alle Stellen, die `fetch`-Antworten ohne `res.ok`-Prüfung rendern, durchgehen.                                | M       |
| **4.6** | 📄 Denglisch aus der Oberfläche                | „Season" im deutschen Vereinsvorstand-Kontext wirkt wie eine unfertige Übersetzung — und untergräbt das Vertrauen in alles andere auf der Seite.                                                                                                           | Sichtbare Texte durchgehen; Code-Bezeichner bleiben englisch.                                                 | S       |
| **4.7** | Mitgliedsnummer zu Ende führen                 | Heute vergeben und im Admin sichtbar (Anhang A). Fehlt: das Mitglied sieht sie selbst nicht, und der CSV-Export enthält sie nicht — genau die zwei Stellen, an denen eine Kundennummer ihren Zweck erfüllt.                                                | Nummer im eigenen Profil sichtbar, Spalte im Mitglieder-CSV.                                                  | S       |

**Gate 4:** Fünf Rollen, fünf Kernaufgaben, alle fünf auf dem Handy in unter zwei Minuten,
von jemandem, der die Software vorher nicht kannte.

**Aufwand gesamt: 3–4 Wochen.** (4.1 ist der Brocken und lohnt sich am meisten.)

---

### Phase 5 — Betrieb: Ausfälle bemerken, bevor der Kunde anruft

> **Ziel: F5.**

| ID      | Aufgabe                                        | Warum (echtes Leben)                                                                                                                                                                                                                                                                                   | Nachweis                                                                                     | Aufwand |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------- |
| **5.1** | ✅ `@sentry/nextjs` in `dependencies` schieben | Sentry ist ordentlich verdrahtet (`next.config.js`, `lib/logger.ts`, alle `error.tsx`), steht aber in `devDependencies`. Auf Vercel geht das gut; ein Build mit `--omit=dev` bricht. Fehlerüberwachung darf nicht an einem Installations-Flag hängen.                                                  | `npm ci --omit=dev && npm run build` läuft durch.                                            | S       |
| **5.2** | Prüfen, dass Sentry in Produktion Fehler sieht | Verdrahtet heißt nicht empfangend. Ein DSN kann fehlen und niemand merkt es — man sieht ja keine Fehler.                                                                                                                                                                                               | Absichtlicher Fehler in Produktion erscheint innerhalb von zwei Minuten im Sentry-Projekt.   | S       |
| **5.3** | Sechs Cron-Jobs überwachen                     | `vercel.json` fährt 6 Cron-Jobs (Mahnwesen, Backup, nuLiga, Erinnerungen, Reaktivierung, Log-Bereinigung). Ein stillstehender Mahnlauf fällt monatelang nicht auf — er erzeugt einfach nichts. Für das Backup gibt es bereits einen Totmannschalter (`ops_heartbeats`); die anderen fünf haben keinen. | Jeder Job schreibt einen Heartbeat; `/api/health` meldet einen überfälligen.                 | M       |
| **5.4** | Rücksicherung einmal wirklich proben           | Ein Backup, das nie zurückgespielt wurde, ist kein Backup, sondern eine Datei. `RUNBOOK-BACKUP-ROLLBACK.md` existiert — begangen wurde der Weg nie.                                                                                                                                                    | Restore in eine leere Datenbank, Anwendung startet dagegen, Zeitmessung im Runbook vermerkt. | M       |
| **5.5** | 2.4 abarbeiten (VPS: RLS-Rolle + TLS)          | Siehe Phase 2. Terminlich hier, weil es Arbeit an der Infrastruktur ist und nicht am Code.                                                                                                                                                                                                             | s. 2.4                                                                                       | L       |
| **5.6** | Support-Weg festlegen                          | Wenn der Vorstand um 20:30 nicht weiterkommt — wohin schreibt er? `/support` und `/contact` existieren als Seiten. Wer antwortet, in welcher Zeit, ist nirgends festgelegt.                                                                                                                            | Ein Kanal, eine zugesagte Reaktionszeit, in `HANDBOOK.md` und auf der Seite genannt.         | S       |

**Gate 5:** Ein absichtlich abgeschalteter Cron-Job und ein absichtlicher 500er erzeugen beide
innerhalb von 30 Minuten eine Meldung an dich, ohne dass du hingeschaut hast.

**Aufwand gesamt: 2 Wochen** (5.5 dominiert).

---

### Phase 6 — Damit es so bleibt

> **Ziel: das Erreichte verfällt nicht wieder.** Diese Phase hat kein Ende, sondern eine Kadenz.

| ID      | Aufgabe                                              | Warum                                                                                                                                                                                                  | Aufwand |
| ------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **6.1** | 📄 Integrationstests in CI zum Laufen bringen        | 10 Tests skippen ohne Service-Key. Lokal laufen sie gegen die lokale Supabase ✅ — in CI laufen sie nie. Ein Test, der nur lokal läuft, schützt `main` nicht.                                          | M       |
| **6.2** | E2E-Kernweg in CI                                    | 26 Playwright-Specs existieren. In CI läuft nur ein Smoke-Test, und der nur wenn Secrets gesetzt sind. Der Kernweg (Login → Mitglied → Rechnung) gehört in jeden PR.                                   | M       |
| **6.3** | Coverage-Schwelle halten und anheben                 | 60 % Zeilen / 55 % Zweige sind konfiguriert. Ziel ist nicht die Zahl, sondern dass sie nicht sinkt.                                                                                                    | S       |
| **6.4** | Toten Code entfernen (knip)                          | u. a. `AnonymizeService` — eine zweite, unbenutzte DSGVO-Anonymisierung neben der tatsächlich verdrahteten. Zwei Implementierungen für Löschung sind eine Falle: irgendwann pflegt jemand die falsche. | S       |
| **6.5** | `docs:check` und `docs:autogen` im Pre-Commit halten | Die Doku-Regeln in `AGENTS.md` wurden dreimal gebrochen, bis sie geprüft wurden. Prosa ohne Prüfung ist eine Bitte.                                                                                    | S       |
| **6.6** | Schema-Drift-Wächter                                 | Das Drizzle-Schema kennt mehrfach Spalten nicht, die in der DB existieren. Jedes Mal war es ein stiller Fehler.                                                                                        | M       |

---

## 5. Reihenfolge auf einen Blick

```
Phase 0  Auslieferung freimachen        1 Tag        ← zuerst, blockiert alles
Phase 1  Harte Blocker (E-Mail!)        1 Woche      ← braucht 0
Phase 2  Geld & Recht                   1–2 Wochen   ← braucht 1.3
Phase 3  Erster Kunde ohne dich         2–3 Wochen   ← braucht 1.1
Phase 4  Der Alltag hält                3–4 Wochen   ← braucht 3 (Befunde daraus)
Phase 5  Betrieb & Überwachung          2 Wochen     ← parallel ab Phase 2 möglich
Phase 6  Dauerhaft                      laufend
```

**Realistisch: 10–13 Wochen bis „verkaufbar".** Phase 5 kann ab Phase 2 nebenherlaufen, Phase 6
beginnt sofort und hört nie auf.

Wenn nur zwei Dinge gemacht werden: **Phase 0 und 1.1 (E-Mail).** Damit geht das Produkt von
„läuft nicht in Produktion und kann kein Geld einziehen" auf „läuft und kann Geld einziehen".

---

## 6. Bewusst nicht in diesem Plan

Damit nicht jemand später denkt, es sei vergessen worden:

- **Neue Features.** Turniere, Shop, Gamification, Partner-Finder, nuLiga sind gebaut. Bis Gate 4
  kommt nichts Neues dazu. Ein halbfertiges Produkt wird nicht durch ein weiteres Modul fertig.
- **i18n aktivieren.** Infrastruktur liegt, Zielmarkt ist Deutschland. Später.
- **React-19- und Tailwind-4-Migration.** Spikes liegen in `docs/tickets/`. Kein Kundennutzen.
- **Alles unter „Produkt-Roadmap" in `OPEN_ITEMS.md`.** Bleibt zurückgestellt.
- **Pen-Test.** Sinnvoll — aber erst nach Phase 2, sonst testet er einen Zustand, den es dann
  nicht mehr gibt.

---

## 7. Offene Entscheidungen — die brauche ich von dir

Diese vier kann ich nicht aus dem Code beantworten, und sie ändern den Plan:

1. **Preis-Enforcement (3.1):** Hartes Gate ohne Abo, oder eine Testphase mit Ablaufdatum?
   Testphase ist verkaufsfreundlicher und deutlich mehr Arbeit.
2. **`users` cross-tenant (2.3):** Sollen Mitglieder Nutzer anderer Vereine sehen können?
   Für den Partner-Finder über Vereinsgrenzen wäre es nötig; sonst zu.
3. **Platzbelegung (4.1):** Welche der sieben Oberflächen ist die richtige? Ich habe eine
   Empfehlung (`UnifiedCourtCalendar` unter `/scheduler`), aber das ist eine Produktentscheidung.
4. **VPS (2.4/5.5):** Bleibt die selbstgehostete Supabase, oder wird auf Supabase Cloud
   umgezogen? Das entscheidet, ob TLS und RLS-Rolle eine Woche Arbeit sind oder ein Häkchen.

---

## Anhang A — Mitgliedsnummer (umgesetzt 18.08.2026)

Vereinsweit fortlaufende Mitgliedsnummer („Kundennummer"). Umgesetzt, nicht geplant.

**Modell.** Die Nummer hängt an der **Mitgliedschaft**, nicht an der Person
(`user_club_memberships.member_number`). Ein Trainer, der in drei Vereinen aktiv ist, hat dort
drei Nummern — das ist der Punkt an „vereinsweit". Vergeben wird sie vom DB-Trigger
`assign_member_number()`, der den Zähler `clubs.next_member_number` per `UPDATE … RETURNING`
hochzählt; die Zeilensperre serialisiert das pro Verein, zwei gleichzeitige Anmeldungen können
also nicht dieselbe Nummer ziehen. `UNIQUE (club_id, member_number)` sichert das zusätzlich ab.
Bestandsmitglieder wurden nach Beitrittsdatum nachnummeriert.

**Sichtbar.** Spalte „Nr." in der Mitgliederliste, Mitgliedsnummer im Kopf der Detailansicht.
Die Suche erkennt eine reine Ziffernfolge als Nummer — `0042` findet Nummer 42, führende Nullen
sind reines Anzeigeformat (`formatMemberNumber`).

**Nachweis.** `psql "$DATABASE_URL" -f scripts/check-member-numbers.sql` — prüft, dass jede
Mitgliedschaft eine Nummer hat, keine doppelt ist, kein Club-Zähler zurückhängt, und dass drei
frische Anmeldungen fortlaufende Nummern bekommen. Rollt alles zurück.

**Offen** (→ 4.7): Das Mitglied sieht seine eigene Nummer nicht, und der Mitglieder-CSV-Export
enthält sie nicht.

---

## Anhang B — Belege dieser Analyse

Alles unter ✅ ist am 18.08.2026 so gemessen worden:

| Aussage                        | Befehl                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| Typen, Lint, Tests, Build grün | `npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` |
| `main` 50 Commits zurück       | `git log --oneline main..HEAD \| wc -l` → 50                             |
| 69 Dateien uncommitted         | `git diff --stat` → 69 files changed, +1216 −1326                        |
| `monitor.yml` nicht auf `main` | `git cat-file -e main:.github/workflows/monitor.yml` → fehlt             |
| 7 Platzbelegungs-Oberflächen   | `find app -name page.tsx`                                                |
| Keine DSGVO-Auskunftsroute     | `ls app/api/user/` → club, delete, me, member, notifications, roles      |
| Sentry in `devDependencies`    | `package.json`; Verdrahtung in `next.config.js`, `lib/logger.ts`         |
| 6 Cron-Jobs, 1 Heartbeat       | `vercel.json`; `app/api/health/route.ts` prüft nur `vps-backup`          |
