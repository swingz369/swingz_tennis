# Matchday-Redesign: lokaler Abschlussstand vom 30.09.2026

Snapshot des fortgesetzten Arbeitsstands. Die bestätigten Redesign-Lücken sind
behoben; dieser Bericht ist keine Produktions- oder Verkaufsreifeabnahme.
Die lebende Designbeschreibung steht in [DESIGN.md](../DESIGN.md), verbleibende
Launch-Aufgaben stehen in [OPEN_ITEMS.md](../OPEN_ITEMS.md).

## Umgesetzte Korrekturen

- Responsive Profilköpfe für Mitglieder und Trainer sowie mobile Mitgliederkarten
  halten Identität und Aktionen sichtbar. Profilzahlen und weitere Kennzahlen
  verwenden den gemeinsamen `KpiBand`; seine Definitionslisten sind semantisch gültig.
- Das Wochenraster bleibt in seinem horizontalen Scrollbereich. Die rechte Seite
  ist auch bei 390 px erreichbar, ohne die gesamte Seite zu verbreitern.
- Der SEPA-Einstieg führt zum Mandatsformular. Qualifikationen lassen sich im
  Dialog eingeben; Validierung und Fehler bleiben sichtbar. Die Churn-Risk-Aktion
  verlinkt über die Vereinsmitgliedschaft statt über eine Benutzer-ID.
- Formulardialoge fokussieren ein sichtbares Eingabefeld und geben den Fokus beim
  Schließen zurück. Die geschlossene mobile Sidebar ist `inert`. Profilbildwechsel
  und freie Kalenderflächen verwenden benannte native Buttons; breite Tabellen
  sind per Tastatur scrollbar. Filter, Breadcrumbs und Seitengrößenauswahl haben
  zugängliche Namen.
- Textkontraste in beiden Themes wurden unter anderem bei Navigation, Statuswerten,
  Fortschritt und Trainerterminen korrigiert. Statusfarben verwenden die bestehenden
  themefähigen Tokens. Die Design-Ratsche erlaubt noch vier fachlich begründete
  Kennzahl-Heuristikausnahmen.
- Der vorhandene Webpack-Externals-Callback wurde repariert: normale Imports
  werden abgeschlossen; nur lokale `supabase/functions`-Pfade werden ausgelagert.
  `@supabase/functions-js` bleibt Teil des Bundles. Damit kompiliert der Webpack-
  Entwicklungsserver wieder Routen; sein Speicherproblem bei breiten Testläufen
  ist dadurch nicht gelöst.

## Bestandene Prüfungen

| Prüfung                                                                            | Ergebnis                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vollständiger Vitest-Lauf nach den letzten Codekorrekturen                         | 1.789 bestanden, 0 fehlgeschlagen, 10 übersprungen                                  |
| TypeScript `tsc --noEmit`                                                          | Bestanden                                                                           |
| ESLint für geänderte TS-/TSX-Dateien, neue Regressionstests und Next-Konfiguration | Keine Fehler; zuletzt geprüfte Fokus-/Kalenderkorrekturen auch ohne Warnungen       |
| `pnpm check:design` und `git diff --check`                                         | Bestanden                                                                           |
| Dauerhafte authentifizierte axe-Prüfung                                            | 20 Kombinationen bestanden                                                          |
| Redesign-Interaktionsregressionen                                                  | 4 Tests bestanden                                                                   |
| Zusätzliche responsive Browsermatrix                                               | 52 Ansichten; kein Seitenüberlauf über 1 px, keine schweren/kritischen axe-Verstöße |
| Gezielte HTTP-Prüfung der geänderten Churn-Risk-Route                              | Eigene und fremde Query-ID liefern ausschließlich Alpha-Mitgliedschaften            |

Der letzte gemeinsame Chromium-Lauf mit den 20 axe- und vier Interaktionstests
begann am 30.09.2026 um 08:20 UTC und endete nach rund 206 Sekunden mit
24 bestandenen Tests, ohne Wiederholungen oder übersprungene Fälle. Der lokale
Testaufruf verwendete eine temporäre Playwright-Konfiguration mit bestehendem
Dev-Server und erhöhten Zeitlimits für kalte Routenkompilierung.

Die dauerhaften Tests liegen in
[accessibility-authenticated.spec.ts](../../tests/e2e/accessibility-authenticated.spec.ts)
und [redesign-regression.spec.ts](../../tests/e2e/redesign-regression.spec.ts).
Geprüfte Abläufe: Profilidentität und SEPA-Formular auf Mobilgeräten,
Erreichbarkeit des Wochenrasters, Mitgliederkarten mit Dialogfokus und Escape
sowie Qualifikationsvalidierung mit Fehler- und Erfolgsantwort. Der Schreibaufruf
für Qualifikationen wurde im Test abgefangen; er erzeugt keine Datenbankeinträge.

### Responsive und axe-Matrix

Alle Ansichten wurden bei 1440 und 390 px, jeweils Hell/Dunkel, geprüft.
Animationen waren für stabile Kontrastmessungen reduziert. Die Matrix umfasst:

| Rolle      | Routen                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Admin      | `/admin`, `/admin/members`, `/admin/trainers`, `/admin/courts`, `/admin/billing`, `/admin/settings` |
| Mitglied   | `/member`, `/profile`, `/billing`                                                                   |
| Trainer    | `/trainer`, `/trainer/availability`                                                                 |
| Superadmin | `/superadmin`                                                                                       |
| Owner      | `/owner`                                                                                            |

Das ergibt 13 Routen mit je vier Ansichten. Ausgewählte Desktop- und
Mobil-Screenshots wurden zusätzlich visuell geprüft. Die dauerhafte axe-Suite
deckt fünf Kernseiten über dieselben Größen und Themes ab. Die Prüfungen liefen
mit Agent-Zugängen; Nutzervereine wurden nicht geändert und kein Seed ausgeführt.

Die Churn-Risk-Prüfung meldete für beide HTTP-Abfragen je zehn Risikomitglieder.
Alle ausgegebenen `memberId`-Werte wurden gegen Alpha-Mitgliedschaften geprüft.
Auch mit `clubId` und `club_id` aus Gamma lieferte die Route nur Alpha-Daten.
Diese gezielte Prüfung ersetzt keinen vollständigen Mandanten-Isolationstest.

## Offene Prüfgrenzen

- Der vollständige bestehende Seiten-/Rechtetestlauf wurde nicht abgeschlossen.
  Breite Läufe brachten den lokalen Entwicklungsserver an sein Speicherlimit;
  nachfolgende Kontrollen scheiterten unter anderem an Verbindungsabbrüchen.
  Diese Läufe zählen nicht als bestanden. Der abschließende begrenzte Lauf der
  24 Redesign-/axe-Tests lief anschließend erfolgreich mit Turbopack.
- Der vollständige HTTP-Tenant-Test scheiterte am Zehn-Minuten-Zeitlimit.
  Sein Ergebnis liefert keine vollständige Aussage zur Mandantenisolation.
- axe deckt nur automatisierbare Kriterien ab. Eine vollständige Screenreader-
  Abnahme und Kernaufgaben mit echten Vereinsnutzern bleiben offen.
- Kein neuer Produktionsbuild, Commit, Push oder Deploy wurde in dieser
  Fortsetzung vorgenommen. Produktionsverifikation bleibt Teil der Auslieferung.

Die Rohberichte und Screenshots dieses lokalen Laufs liegen als temporäre
Artefakte unter `/tmp/swingz-redesign-*`; sie sind nicht Teil der versionierten
Dokumentation und können nach einem Systemneustart fehlen.
