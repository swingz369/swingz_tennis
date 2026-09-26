# SwingZ – Prüfung der Verkaufsreife und umgesetzte Korrekturen

> Snapshot: 26. September 2026. Grundlage: Quellcode, lokale SQL-Abfragen, Tests,
> lokale Browserstichprobe sowie lesende Produktions- und GitHub-Abfragen.
> Arbeitsbasis: `feat/chat-unterhaltungen-news-ui`, HEAD `519cd7d6c705345e73930717143681545cdc82e2`
> plus uncommittierte Änderungen. Kein Deployment, keine Produktionsmigration.

## 1. Ergebnis

**Noch keine Verkaufs- oder Produktionsfreigabe.** Die Anwendung hat eine umfangreiche
funktionale Basis. Eine belastbare Freigabe scheitert derzeit insbesondere an zu weiten
Buchungsrechten, nicht atomarer Zahlungs-/Lagerverarbeitung, fehlendem Nachweis der
Auslieferung des geprüften Stands und einem nicht abschließend festgelegten Verkaufsmodell.

In diesem Lauf wurden konkrete Zahlungsfehler, Fehlerbehandlung im Zugangsformular und
mobile Layoutprobleme im Code korrigiert. Der abschließende Testlauf ohne DB-Integration
ist grün: **1.637 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Das ist kein Beleg für
reale Zahlungsabwicklung, vollständige Mandantentrennung oder funktionierende Geschäftsabläufe.

Empfehlung: erst die unten beschriebenen Sicherheits- und Geldflussabnahmen schließen,
dann einen betreuten Pilotbetrieb mit klar begrenztem Leistungsumfang beginnen. Die Vision
„kompletter Vereinsbetrieb“ ist ein Produktziel, derzeit kein verifiziertes Verkaufsversprechen.

## 2. Was tatsächlich geprüft wurde

| Bereich            | Nachweis und Grenze                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codebestand        | 322 API-Routen, 124 Seiten, 146 Unit-Testdateien und 26 E2E-Spec-Dateien gezählt; keine Behauptung, jede Funktion vollständig geprüft zu haben       |
| Strukturelle Suche | codebase-memory mit Coverage-Prüfung und Quellcodeabgleich; Index hatte auch partielle/unbrauchbare Dateien, daher kein Vollständigkeitsbeleg        |
| Datenbank          | Lokale Supabase-DB, Metadaten in `BEGIN READ ONLY`: Buchungs-Policies, Stripe-RPC-Rechte, Zahlungsindizes, Shop-Spalten, SECURITY-DEFINER-Inventar   |
| Browser            | Frühere lokale Stichprobe mit fünf Agent-Rollen und zwölf Seiten ohne erfasste API-/JavaScript-Fehler; keine vollständigen schreibenden Nutzerreisen |
| Produktion         | Health HTTP 200 am 26.09., 16:12:41 UTC; Supabase und sechs Job-Heartbeats vom Endpunkt als gesund gemeldet                                          |
| Betrieb            | Letzte acht abgefragte Monitor-Läufe erfolgreich; letzte abgefragte CI-Läufe separat betrachtet                                                      |
| Änderungen         | Typecheck, gezieltes ESLint, Regressionstests und breiter Testlauf ohne DB-Integration                                                               |

Browserseiten: `/landing`, `/register`, `/login`, `/admin`, `/admin/members`,
`/admin/billing`, `/admin/seasons`, `/member`, `/scheduler`, `/trainer`, `/superadmin`, `/owner`.
Die erste mobile Screenshot-Serie wurde unmittelbar nach dem Resize aufgenommen und
ist wegen Übergangsartefakten kein zuverlässiger Überlaufnachweis. Die erneute Abnahme
nach den UI-Korrekturen konnte nicht abgeschlossen werden: Turbopack meldete `EMFILE`,
der anschließende Webpack-Start blieb im beobachteten Zeitraum bei der Proxy-Kompilierung.
Breite Playwright- und HTTP-Mandantentests ergaben keinen vollständigen Abschluss und
werden hier ausdrücklich nicht als bestanden gezählt.

Es wurden keine Nutzervereine bestückt, keine echten Zahlungen ausgelöst und keine
Nachrichten verschickt. Lokale SQL-Ergebnisse sind keine Aussage über den heutigen
Produktions-Schemazustand. Ältere Dokumente dienten als Suchhinweise, nicht als Erfolgsbelege.

## 3. Priorisierte Befunde

### P0 – Buchungsrechte zu weit

Die lokale Tabelle `bookings` hat acht Policies. `booking_access` gilt für `ALL` und erlaubt
Zugriff bei eigener `member_id` **oder irgendeiner Mitgliedschaft im gleichen Verein**.
Die zweite Bedingung prüft weder Rolle noch `is_active`. Die permissive Policy erweitert
die Rechte trotz daneben vorhandener engerer Regeln. Normale Vereinsmitgliedschaft
kann damit fremde Buchungen zum Ändern freigeben. Quelle: tatsächliches `pg_policies`.

**Abnahme:** Produktions-Policies lesen, exakt benannte Alt-Policy korrigieren, Migration
auf leerer DB testen, anschließend direkte DB/API-Negativtests für fremde Buchungen,
inaktive Mitgliedschaften und andere Vereine; legitime Rollenpfade müssen weiter funktionieren.
In diesem Lauf wurde keine Migration geschrieben oder angewendet.

### P0 – Stripe-Event-RPC für unprivilegierte Rollen ausführbar

Lokal liefern die Rechte für `check_and_record_stripe_event(text,text)` weiterhin
`anon=true`, `authenticated=true`, `service_role=true`. Damit ist der Event-Marker
auch außerhalb des signaturgeprüften Webhook-Handlers erreichbar. Die vorhandene Migration
`20260924100000_stripe_event_rpc_service_role_only.sql` ist kein Beleg ihrer Anwendung.
Der ältere Produktionsbefund wurde am 26.09. nicht erneut per SQL geprüft.

**Abnahme:** dieselbe Rechteabfrage lokal und in Produktion muss `false,false,true`
ergeben; gültig signierte Ereignisse müssen funktionieren, unprivilegierte RPC-Aufrufe scheitern.

### P0 – Zahlungsstatus, Bestandsänderung und Event-Verarbeitung nicht atomar

Quelle: `app/api/webhooks/stripe/route.ts`, insbesondere `handleShopOrderPayment`.
Die Bestellung wird auf bezahlt gesetzt, bevor der Lagerbestand geändert wird.
Ein Fehler dazwischen lässt eine bezahlte Bestellung mit falschem Bestand zurück;
ein Retry kann wegen des bereits bezahlten Status überspringen. Lesen und Schreiben
des Bestands sind getrennt; konkurrierende Käufe sind dadurch nicht zuverlässig abgesichert.
Lokal existieren für `payments` nur Primärschlüssel- und Rechnungsindex, kein eindeutiger
Index auf `external_id`. Die Vorabprüfung allein verhindert konkurrierende Duplikate nicht.

**Abnahme:** fachlich eindeutige Zahlungsidentität, atomare Buchungs-/Bestandsänderung und
Fehlereinspielung nach jedem Schreibschritt. Doppelte sowie unterschiedlich sortierte
Ereignisse und zwei parallele Käufe dürfen weder doppelt abbuchen noch Bestand verlieren.
Die unten umgesetzten Handler-Korrekturen schließen diese Transaktionslücke nicht.

### P0 – Geprüfter Code ist nicht als ausgeliefert nachgewiesen

Der letzte abgefragte Monitor-Lauf vom 26.09., 15:42:27 UTC, lief auf `0ab8aed5…`.
Die letzten zwei abgefragten CI-Läufe: 21.09. `3ef9b2a4…` fehlgeschlagen,
20.09. `0ab8aed5…` erfolgreich. Der lokale HEAD lautet `519cd7d6…`, dazu kommen die
hier beschriebenen Änderungen. Ein gesunder Health-Endpunkt identifiziert diesen Code nicht.

**Abnahme:** ein bestimmter freigegebener Commit besteht CI, wird nachweisbar deployed
und anschließend fachlich sowie über Health/Monitor geprüft. Kein Push in diesem Lauf.

### P1 – Zugang und Verkaufsmodell stimmen noch nicht mit dem Ziel überein

`app/register/page.tsx` stellt eine manuell bearbeitete Zugangsanfrage dar.
Selbstständige Registrierung → Zahlung → eingerichteter Verein ist nicht nachgewiesen.
Landing/Preisoberfläche und vorhandene Tariflogik bilden monatliche Abos ab; die dokumentierte
Produktentscheidung sieht dagegen Einmalkauf je Tennisschule plus laufende Betriebskosten vor.
Preise, Vertragsumfang, Support und Übergang müssen vom Betreiber verbindlich entschieden
werden. Die lokale Bezahlschranke ist mit `SUBSCRIPTION_ENFORCEMENT=off` abgeschaltet.
Der heutige Produktionswert wurde nicht neu ausgelesen.

**Abnahme:** ein abgestimmtes Angebot, konsistente Preise in UI und Zahlungsanbieter,
Testkauf mit Rechnung, korrekte Entitlements, Mahn-/Kündigungs-/Rückerstattungsfälle.
Alternativ betreutes Onboarding ausdrücklich als Produktleistung vereinbaren; das bestehende
Selbstbedienungs-Gate F2 wäre dann bewusst zu revidieren.

### P1 – Überwachung und Analytics vermitteln noch keine belastbare Sicherheit

- Der lokale Start meldet fehlende Sentry-Instrumentation. `sentry.server.config.ts`
  allein ersetzt die von der installierten Next-Version erwartete `register`-Integration
  nicht; die Client-Konfiguration wird unter Turbopack ebenfalls beanstandet.
  Abnahme: echter Testfehler vom Server und Browser bis zum Alarm, mit geprüfter Datenfilterung.
- `app/api/analytics/insights/route.ts` bezeichnet seine Erzeugung selbst als vereinfachten
  Mock. Fehlende Besuchsdaten werden als lange Inaktivität gewertet; die ersten fünf Mitglieder
  erhalten pauschale Trainingsempfehlungen. Dies ist kein belastbares Prognosemodell.
  Abnahme: unbekannte Daten ausdrücklich als unbekannt behandeln und Empfehlungen erklären;
  bis dahin Funktion aus dem Leistungsversprechen nehmen oder eindeutig kennzeichnen.

Die 58 lokal für `authenticated` ausführbaren SECURITY-DEFINER-Funktionen sind ein
Prüfinventar, nicht 58 nachgewiesene Sicherheitslücken. Ebenso beweist das fehlende `club_id`
in `shop_orders` allein kein Datenleck; dafür müssen alle Zugriffswege geprüft werden.

## 4. In diesem Lauf umgesetzt

| Änderung                                  | Dateien / Wirkung                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zahlungsstatus aus realem Status ableiten | `app/api/webhooks/stripe/route.ts`: `payment_status` statt angebotener `payment_method_types`; bezahlte Karte mit zusätzlich angebotener SEPA bleibt bezahlt                      |
| Asynchrone Zahlungen verarbeiten          | `checkout.session.async_payment_succeeded` wird verarbeitet; PaymentIntent setzt Buchungs-/Shop-Pfade auch ohne Rechnungs-Payment-Zeile fort                                      |
| Fehler für Retry sichtbar machen          | Fehlende/unlesbare Buchung im PaymentIntent-Pfad löst Fehlerantwort aus                                                                                                           |
| Gemeinsamer Shop-Pfad                     | PaymentIntent nutzt dieselbe Lagerverarbeitung wie das Checkout-Ereignis; sequenzielle Wiederholung ist getestet, Parallelität bleibt offen                                       |
| Ehrliche Zugangs-CTAs                     | Landing und Pricing sagen „Zugang anfragen“; manuelle Einrichtung wird beschrieben                                                                                                |
| Formular robuster                         | Netzwerkfehler als Alert, erneuter Versuch möglich, Autofill und Fokus auf Erfolgsüberschrift                                                                                     |
| Abrechnung am Handy                       | Scrollbare Tabs, umbrechende Aktionsleisten, intern scrollende Tabelle und einzeilige Rechnungsnummern; visuelle Endabnahme offen                                                 |
| Unit-Tests isoliert                       | Bulk-Import erhält nur einen fiktiven Testschlüssel; QR-Test mockt den tatsächlich verwendeten Service-Client; Trainer-Service benötigt für Repository-Mocks keine echten Secrets |
| Lebende Doku                              | `OPEN_ITEMS.md`, `PRODUKTIONSREIFE.md` und `DESIGN.md` aktualisiert; vorhandene fremde Änderungen erhalten                                                                        |

Stripe-Referenz für den tatsächlichen Zahlungsstatus:
[Checkout Session – payment_status](https://docs.stripe.com/api/checkout/sessions/object).
Die technische Korrektur ist durch lokale Regressionstests belegt, nicht durch echte Stripe-Zahlungen.

## 5. Testnachweise

| Prüfung                                                | Ergebnis                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Neue Stripe-Regressionen vor Korrektur                 | 11 bestanden, 5 fehlgeschlagen                                                                                 |
| Stripe nach erster Korrektur                           | 16/16 bestanden                                                                                                |
| Abschließende gezielte Tests                           | 71/71 bestanden, darunter 17 Stripe-Tests sowie Bulk-Import, QR-/weitere Routen und Trainer-Service            |
| Breiter Lauf vor Mock-Korrekturen                      | 1.627 bestanden, 10 fehlgeschlagen; drei Testdateien waren nicht vollständig von realer Konfiguration isoliert |
| Breiter Lauf nach Korrekturen                          | 1.637 bestanden, 0 fehlgeschlagen, 0 übersprungen                                                              |
| `pnpm typecheck`                                       | Exit 0                                                                                                         |
| Gezieltes ESLint                                       | Exit 0 für geänderten Webhook und vier Testdateien; vorher auch geänderte UI-Dateien geprüft                   |
| `git diff --check`                                     | Exit 0 vor Berichtserstellung                                                                                  |
| Produktionsbuild                                       | In diesem Lauf nicht erfolgreich nachgewiesen                                                                  |
| Browser nach letzter UI-Änderung / HTTP-Mandantentests | Kein abgeschlossener Nachweis                                                                                  |

Reproduzierbarer breiter Testbefehl:

```bash
SUPABASE_SERVICE_ROLE_KEY= DATABASE_URL= TEST_DB_SCHEMA_READY=true \
  pnpm exec vitest run \
  --exclude 'src/__tests__/integration/**' \
  --exclude 'src/__tests__/lib/billing-engine.test.ts' \
  --maxWorkers=2 --reporter=json --outputFile=/tmp/swingz-readiness-unit-final.json
```

Die ausgeschlossenen DB-Tests zählen nicht als erfolgreiche Tests. Der Billing-Engine-Test
legt eigene Testvereine außerhalb der vorgesehenen Alpha/Beta-Lane an und wurde deshalb
nicht gegen die gemeinsam verwendete DB ausgeführt. Für die Freigabe ist ein isolierter
DB-Testlauf mit frisch aufgebautem Schema erforderlich.

Temporäre Belege: `/tmp/swingz-readiness-focused.json`,
`/tmp/swingz-readiness-unit-final.json`, `/tmp/swingz-readiness-data.jsonl`,
`/tmp/swingz-readiness-ci.json`, `/tmp/swingz-readiness-ci-build.json`,
`/tmp/swingz-readiness-typecheck-final.log`, `/tmp/swingz-readiness-lint-final.log`.
Diese Dateien sind flüchtige Arbeitsartefakte; die wesentlichen Resultate stehen deshalb hier.

## 6. Gestaltung: nächste sinnvolle Schritte

Die betrachtete Admin-Oberfläche besitzt bereits eine ruhige grüne Navigation, warme
Hintergründe und klare Kennzahlen. Eine pauschale Neugestaltung würde funktionale Risiken
nicht lösen. Die Root-Schriften und CSS-Palette weichen von älteren Designbehauptungen ab;
die unbelegte Design-Bestnote wurde aus den einleitenden Kapiteln entfernt.

Priorität für die nächste Gestaltungsetappe:

1. Drei reale Aufgaben optimieren: Platz buchen, Trainingsplan ändern, Rechnung bearbeiten.
2. Pro Aufgabe mobilen Ablauf, leere Daten, Ladezustand, Validierung und Fehlerfall abnehmen.
3. Reale Produktansichten statt inszenierter Beispieloberflächen in Verkaufsdarstellungen nutzen.
4. Mit Vereinsverwaltung, Trainer und Mitglied beobachten, ob Aufgaben ohne Erklärung gelingen.
5. Erst danach Animationen, Illustrationen und weitere Markenpolitur verfeinern.

## 7. Reihenfolge bis zum ersten zahlenden Kunden

| Schritt                       | Verantwortlichkeit       | Beobachtbarer Abschluss                                                                                              |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1. Rechte schließen           | Entwicklung + DB-Betrieb | Live-SQL geprüft, Migrationen auf leerer DB grün, Rollen-/Mandanten-Negativtests grün                                |
| 2. Geld und Bestand absichern | Entwicklung              | Signierte Testereignisse, Parallelität, Wiederholungen und Fehler zwischen Schreibschritten ohne inkonsistente Daten |
| 3. Angebot festlegen          | Betreiber                | Einmalkauf/Abo, Preise, Umfang, Support und Übergangsregeln verbindlich; Oberfläche und Entitlements konsistent      |
| 4. Kernreisen abnehmen        | Produkt + Vereinsnutzer  | Zugang → Einrichtung → Mitglieder → Planung → Buchung → Anwesenheit → Rechnung/Zahlung auf Desktop und Handy         |
| 5. Betrieb belegen            | Entwicklung + Betrieb    | Grüner Build/CI, identifizierter Deploy, Testalarm, erfolgreicher Restore in isolierte Umgebung                      |
| 6. Betreuten Pilot starten    | Betreiber                | Vereinbarter Leistungsumfang, erreichbarer Support, dokumentierte Abnahme und geregelter Datenexport                 |

Noch nicht nachgewiesen: vollständiger Backup-Restore, Last-/Parallelitätsverhalten,
DSGVO-Löschung über alle verbundenen Systeme, rechtliche Verkaufsunterlagen,
reale E-Mail-Zustellung, Zahlung/Rückerstattung/Mahnung, vollständige Saisonplanung,
umfassende Barrierefreiheit und alle Rollen im täglichen Schreibbetrieb. Hierfür werden
konkrete Testfälle und Betreiberentscheidungen gebraucht; vorhandene Dokumentation oder
grüne Mock-Tests reichen nicht aus.

Dieser Snapshot bleibt unverändert. Weitere Fortschritte gehören in die bestehenden
lebenden Dokumente; eine spätere erneute Gesamtprüfung erhält einen eigenen datierten Snapshot.
