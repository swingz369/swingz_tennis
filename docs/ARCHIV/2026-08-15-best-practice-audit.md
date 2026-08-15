# Best-Practice-Audit SwingZ — 15.08.2026

> Snapshot-Dokument (Archiv-Kategorie nach `AGENTS.md`). Beschreibt den Zustand am
> 15.08.2026 nach den an diesem Tag durchgeführten Korrekturen. Wird nicht gepflegt —
> spätere Prüfungen bekommen ein eigenes Dokument.

**Umfang:** 318 API-Routen, 116 Seiten, 127 Testdateien, 105 Migrationen.
**Methode:** statische Auswertung des Repos + Live-Abfragen gegen die Produktions-DB
(`supabase.swingz.cloud`) + Prüfung einzelner Codepfade. Zahlen sind reproduzierbar,
die verwendeten Kommandos stehen bei den jeweiligen Befunden.

---

## 1. Audit-Log — ist die Abdeckung je Rolle sinnvoll und ausreichend?

**Kurzantwort: nein.** Von 227 mutierenden Routen schreiben 18 einen Audit-Eintrag.
Der Schwerpunkt liegt dabei ausgerechnet nicht dort, wo Nachweispflichten bestehen.

```bash
# mutierende Routen gesamt / davon mit Audit
grep -rlE 'export async function (POST|PATCH|PUT|DELETE)' --include=route.ts app/api | wc -l   # 227
… | xargs grep -l "logAudit\|auditService.log" | wc -l                                          # 18
```

### 1.1 Ist-Zustand je Rolle

| Rolle          | Wird protokolliert                                                                                                                                   | Fehlt                                                                                                                                                                                                | Bewertung                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **owner**      | Admin-Einladung, Membership-Änderung, Systemeinstellung, Zugangsanfrage genehmigt/abgelehnt, Verein anlegen/ändern/löschen/wiederherstellen          | **Wechsel in einen fremden Verein** (`/api/admin/switch-club`), Hard-Delete-Token-Ausgabe nur teilweise                                                                                              | Gut abgedeckt, eine kritische Lücke              |
| **superadmin** | erbt die Admin-Pfade                                                                                                                                 | Vereinswechsel, vereinsübergreifende Zugriffe                                                                                                                                                        | Lückenhaft                                       |
| **admin**      | Mitglied deaktiviert, Rolle geändert, Status geändert, Kündigung, CSV-Import, Familienkonto, Trainingseinheiten-Sammellöschung, Stripe-Mengensynchro | **29 Finanz-Routen** (Rechnungen erzeugen/ändern/versenden, SEPA-Lastschrift, Zahlungseingänge, Preisregeln, Zahlungseinstellungen), Mitglieder-Einladung, Registrierungsfreigaben, Gruppenzuordnung | **Unzureichend** — der GoBD-relevante Teil fehlt |
| **trainer**    | nichts                                                                                                                                               | Stundenerfassung, Anwesenheiten, **Notizen zu Mitgliedern**, Verfügbarkeiten, Ad-hoc-Buchungen                                                                                                       | **Lücke** — Notizen sind personenbezogene Daten  |
| **member**     | `PII_READ` / `READ_MEMBER` bei Listen- und Detailaufrufen                                                                                            | —                                                                                                                                                                                                    | **Zu viel** (siehe 1.3)                          |

### 1.2 Was fehlt gemessen an Best Practice

Maßstab: DSGVO Art. 5 Abs. 2 (Rechenschaftspflicht), Art. 32 (Sicherheit der
Verarbeitung), GoBD (Unveränderbarkeit steuerrelevanter Aufzeichnungen),
BSI IT-Grundschutz OPS.1.1.5 / ISO 27001 A.12.4 (Protokollierung).

1. **Anmeldeereignisse werden überhaupt nicht protokolliert.** Weder erfolgreiche
   noch fehlgeschlagene Anmeldungen, keine Abmeldungen, keine abgelehnten
   Berechtigungen. Die Aktionsnamen `login_success`, `login_failed`,
   `permission_denied` existieren als Typ, kein Codepfad schreibt sie.
   → Das ist die Standard-Mindestanforderung jeder Protokollierungsrichtlinie und
   die Voraussetzung, einen Angriff überhaupt bemerken zu können.

2. **Finanzvorgänge sind nicht nachvollziehbar.** Rechnungsstellung, Storno,
   SEPA-Einzug und Zahlungszuordnung laufen ohne Protokoll. Bei GoBD-relevanten
   Belegen ist die Nachvollziehbarkeit von Änderungen keine Kür.

3. **Trainer-Notizen zu Mitgliedern** (`/api/trainer/members/[memberId]/notes`)
   werden ohne Protokoll geschrieben und gelesen. Das sind personenbezogene
   Bewertungen — hier ist die Protokollierung inhaltlich zwingender als beim
   Lesen einer Mitgliederliste, wo sie heute stattfindet.

4. **Der Vereinswechsel des Owners** wird nicht protokolliert. Genau dieser
   Vorgang bekommt in der Oberfläche ein dauerhaftes Warnband („Fremder
   Verein") — die Aktion gilt also als heikel, hinterlässt aber keine Spur.

5. **Keine Aufbewahrungsregel.** `audit_logs` wird von keinem Cron-Job
   aufgeräumt. DSGVO Art. 5 Abs. 1 lit. e verlangt eine Begrenzung; GoBD
   verlangt umgekehrt 6–10 Jahre für den Finanzteil. Beides zusammen heißt:
   nach Kategorie unterschiedlich lange aufbewahren, nicht „alles für immer".

### 1.3 Was zu viel ist

`PII_READ` bei jedem Aufruf der Mitgliederliste erzeugt Masse ohne Erkenntnis
(60-Sekunden-Dedup je Akteur mildert das nur). Ein Admin, der zehnmal am Tag die
Mitgliederliste öffnet, ist kein Vorfall. Vorschlag: Lese-Protokoll auf
**Detailansichten** und **Exporte** beschränken — dort ist der Personenbezug
konkret und der Datenabfluss relevant. Weniger Einträge machen die verbleibenden
lesbar; ein Protokoll, in dem niemand mehr etwas findet, schützt niemanden.

### 1.4 Empfohlene Mindestabdeckung

| Kategorie                                                     | Protokollieren? | Begründung                          |
| ------------------------------------------------------------- | --------------- | ----------------------------------- |
| Anmeldung / Abmeldung / Fehlversuch / abgelehnte Berechtigung | **ja**          | Angriffserkennung, ISO 27001 A.12.4 |
| Rollen-, Rechte-, Mitgliedschaftsänderung                     | ja (vorhanden)  | Rechenschaftspflicht                |
| Rechnung, Zahlung, SEPA, Preisregel                           | **ja**          | GoBD                                |
| Personenbezogene Daten ändern oder löschen                    | ja (teilweise)  | DSGVO Art. 5 Abs. 2                 |
| Personenbezogene Daten **im Detail** lesen oder exportieren   | ja              | Nachweis der Zweckbindung           |
| Personenbezogene Daten in Listen lesen                        | **nein**        | Datenminimierung, Signal-Rausch     |
| Eigene Einstellungen eines Mitglieds ändern                   | nein            | kein Sicherheitsbezug               |
| Vereinswechsel eines Owners/Superadmins                       | **ja**          | vereinsübergreifender Zugriff       |

---

## 2. Befunde nach Schwere

### P1 — behoben am 15.08.2026

| Befund                                                                                                                                                                                                                            | Nachweis                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Audit-Log schrieb nichts.** `audit_logs` hatte 0 Zeilen bei ~15 Schreibern: keine INSERT-Policy (RLS verwarf jeden Insert über den User-Client), erfundene Spalten (`user_id`, `table_name`, `performed_by`), NOT-NULL-Verstöße | Live-Abfrage, jetzt zentral über `lib/audit.ts`    |
| **Admin-Mitgliederliste zeigte überall „—".** Namen, E-Mail und Telefon wurden über den RLS-Client aus `users` geholt; die Policy lässt Admins fremde Nutzerzeilen nicht lesen → leere Map → Platzhalter                          | `app/(protected)/admin/(gated)/members/page.tsx`   |
| **Kader-Import konnte fremde Vereine auslesen.** `POST /api/leagues/[id]/roster` akzeptierte eine beliebige `nuliga_roster_url` aus dem Request und schrieb die Klarnamen samt LK in die eigene Datenbank                         | jetzt gegen die eigene nuLiga-Vereinsseite geprüft |
| **Modul-Schalter speicherten nicht.** Ein Klick änderte nur lokalen State; ohne „Speichern" blieb `clubs.features` leer — Modul sah aktiv aus, Navigation blendete es aus                                                         | `components/onboarding/module-selection-step.tsx`  |
| **Owner bekam 403 in Admin-Routen.** Sechs Routen verglichen die Rolle von Hand (`auth.role !== 'admin'`) statt über die Hierarchie                                                                                               | `verifyRole()` in allen sechs                      |

### P2 — offen, sollte vor Vertrieb geschlossen werden

1. **Audit-Abdeckung Finanzen + Anmeldung** (Abschnitt 1) — 29 Finanz-Routen,
   0 Anmeldeereignisse.
2. **147 von 318 Routen ohne Rate-Limit.** Öffentliche Routen und Cron sind
   sauber geschützt; die Lücke liegt bei den authentifizierten Routen. Ein
   kompromittierter Account kann damit ungebremst Massenoperationen fahren.
3. **178 von 227 mutierenden Routen ohne Zod-Validierung.** Die Konvention steht
   in `docs/handbook/dev/api-conventions.md`, die Mehrheit hält sie nicht ein.
4. **343 `as any`** in `app/`, `lib/`, `src/`. Jedes davon ist eine Stelle, an der
   der Compiler beim nächsten Schemawechsel nichts mehr sagt — die kaputten
   Audit-Spalten (`table_name`, `performed_by`) standen genau hinter `as any`.
5. **Keine Aufbewahrungs-/Löschregel für `audit_logs`.**
6. **26 Dateien mit Icon-Buttons ohne jedes `aria-label`.** Für Screenreader sind
   das namenlose Schaltflächen (WCAG 2.2 4.1.2).

### P3 — Aufräumen

1. **`clubs`-Tabelle enthält Testmüll**: drei `Billing Test Club <timestamp>` —
   genau das Muster, das `AGENTS.md` nach dem DB-Reset verhindern sollte. Die
   Testläufe räumen nicht auf.
2. **`messages.metadata`** wird nicht mehr beschrieben (alles in `details`), die
   Spalte bleibt als Altlast stehen.
3. **`/api/audit-logs` und `/api/admin/audit-logs`** sind zwei Leseendpunkte auf
   dieselbe Tabelle mit unterschiedlichem Antwortformat; der Superadmin-Viewer
   braucht deshalb eine Feldübersetzung in der Route.
4. **4 öffentliche Seiten ohne `metadata`** (`/login`, `/register`, `/api-docs`,
   `/design-preview`) — für die Login-Seite ist das ein verschenkter Title-Tag,
   kein Beinbruch.
5. **Realtime-WebSocket schlägt lokal fehl** (`ERR_CERT_COMMON_NAME_INVALID` auf
   `supabase.swingz.cloud`) — bekanntes VPS-TLS-Thema, betrifft die Live-
   Aktualisierung von Nachrichten und Benachrichtigungen.

---

## 3. Was bereits gut ist

Damit die Liste oben nicht den Eindruck erweckt, es sei alles offen:

- **Security-Header vollständig**: CSP, HSTS, X-Frame-Options, Referrer-Policy,
  Permissions-Policy in `next.config.js`.
- **Cron-Routen** prüfen alle ein Secret; **öffentliche Routen** haben alle ein
  Rate-Limit — die von außen erreichbare Fläche ist die am besten geschützte.
- **Kein nacktes `fetch()`** in Client-Komponenten (alles über `apiFetch`),
  **kein `<img>`** statt `next/image`, **fünf** verbliebene `console.*`-Aufrufe.
- **Deutsche Oberfläche konsequent** — die Heuristik findet genau einen
  englischen Text, und der steckt in einer shadcn-Primitive (`sr-only` „Close").
- **RLS ist flächendeckend aktiv**, mit `FORCE ROW LEVEL SECURITY` auf den
  sensiblen Tabellen und club-gescopten Policies statt eines globalen
  Superadmin-Bypasses (Migrationen 20260805/20260812).
- **127 Testdateien** inkl. E2E mit echten Logins.

---

## 4. Empfohlene Reihenfolge

1. Anmeldeereignisse protokollieren (`login_success`, `login_failed`,
   `logout`, `permission_denied`) — kleinster Aufwand, größter Zugewinn.
2. `logAudit()` in die 29 Finanz-Routen einziehen.
3. `PII_READ` auf Detailansichten und Exporte reduzieren.
4. Aufbewahrungsjob: Sicherheits- und Leseprotokolle nach 12 Monaten löschen,
   Finanzprotokolle 10 Jahre behalten.
5. Rate-Limit als Standard in der Route-Vorlage, nicht als Zusatz.
6. `as any` dort abbauen, wo es DB-Spalten verdeckt (Supabase-Typen neu
   generieren statt casten).
