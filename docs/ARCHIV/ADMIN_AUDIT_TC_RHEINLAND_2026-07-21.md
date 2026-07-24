# Admin-Audit TC Rheinland Tennis — Stand 2026-07-21

Login: `admin@rheinland-tennis.de` (Admin, TC Rheinland). Ziel: jede Nav-Sektion/Seite/Tab
im Admin-Bereich durchklicken, auf fehlende Funktionen, Dummy-Inhalte und Bugs prüfen.
Direkt behebbare Bugs werden sofort gefixt, größere Befunde hier dokumentiert.

Legende: ✅ ok · ⚠️ Problem/Lücke · 🔧 direkt gefixt · ❓ zu klären

## Fortschritt

- [x] Dashboard (`/admin`)
- [x] Mitglieder → Alle Mitglieder + Genehmigungen (`/admin/members`)
- [x] Mitglieder → Familienkonten
- [x] Mitglieder → Nachrichten (`/messages`)
- [x] Mitglieder → E-Mail-Kampagnen
- [x] Training → Saisonplanung
- [x] Training → Wochenstundenplan
- [x] Training → Trainer-Profile, Stundennachweise, Abwesenheiten, Sonderveranstaltungen
- [x] Spielbetrieb (Platzverwaltung — bei TC Rheinland nur dieser Punkt sichtbar, Rest per Feature-Flag aus)
- [x] Finanzen (Abrechnung, Abonnement — Preisregeln/Shop bei TC Rheinland per Feature-Flag aus)
- [x] Vereinsführung (Einstellungen inkl. Branding-Tab, Auswertungen, Dokumente, Versammlungen, Board-Beschlüsse)
- [x] Orphan-Routen prüfen (audit-logs, approvals-Standalone, newsletters, court-types, perf-history — branding ist über Einstellungen erreichbar, kein Orphan)

**Klickthrough komplett (Stand 2026-07-22).** Alle Sektionen durchgeklickt, `tournaments`-Flag-Frage
unten geklärt (aus). Neue Befunde in Abschnitt 11.

Hinweis: Bei TC Rheinland sind laut Sidebar folgende Feature-Flags aus: `trial_training`,
`work_duty`, `weather_integration`, `league_lineup`, `tournaments`, `ai_matchmaking`,
`smart_court`, `dynamic_pricing`, `shop`. Das widerspricht dem Stand aus
[[nav-module-gating-audit-2026-07-21]] (der von `tournaments an` bei TC Rheinland ausging) —
entweder hat sich die Konfiguration seither geändert oder die alte Notiz war ungenau. In
Vereinseinstellungen verifizieren.

**Geklärt (Modul-Tab in Vereinseinstellungen, 2026-07-22)**: `tournaments` ist aktuell
**deaktiviert** für TC Rheinland — die alte Notiz aus [[nav-module-gating-audit-2026-07-21]]
war entweder ungenau oder die Konfiguration wurde seither geändert. Grundfunktionen
(Mitgliederverwaltung, Trainer, Saisonplanung, Finanzen) sind fest aktiv; alle 10 optionalen
Module (Shop, Turniere, Probetrainings, KI-Matchmaking, Wetter-Integration, Liga & Mannschaft,
Arbeitsdienst, Smart Court, Dynamische Preisgestaltung, KI-Analyse) sind deaktiviert.

## Befunde

### 🔧 Direkt gefixt

1. **Branding-Farben ohne Reset-Möglichkeit** (User-Wunsch während der Session):
   `app/(protected)/admin/(gated)/branding/branding-client.tsx` hatte keinen Weg, die
   Primär-/Sekundär-/Akzentfarbe auf die SwingZ-Standardwerte zurückzusetzen. Button
   "Auf Standard zurücksetzen" ergänzt (nutzt `DEFAULT_BRANDING.brand` aus `lib/branding.ts`
   statt eigener Literale).
2. **"Re: " in neuer (Nicht-Antwort-)Nachricht**: `app/(protected)/messages/page.tsx`
   `ComposeDialog` — beim Öffnen von "Neue Nachricht" (kein `replyTo`) war das Betreff-Feld
   mit `"Re: "` vorausgefüllt statt leer. Ursache: `replyTo?.subject ?? ''` griff auch ohne
   `replyTo`. Gefixt: Präfix nur wenn tatsächlich eine Antwort (`replyTo` vorhanden).
3. **Root-Cause-Fix: `aria-label="Button"` auf Icon+Text-Buttons app-weit** —
   `components/ui/button.tsx` `hasTextContent`-Heuristik prüfte nur direkte
   String/Number-Children. Sobald Text in einem Fragment steckte (z.B. `PageHeader`s
   `actions`-Buttons: `<>{Icon}{label}</>`), wurde `hasTextContent` fälschlich `false` und
   der Button bekam `aria-label="Button"` — trotz sichtbarem Text wie "Neue Nachricht".
   Für Screenreader-Nutzer klingt das schlimmer als gar kein Label (wirkt korrekt, sagt aber
   nichts aus). Root-Cause behoben mit rekursivem `nodeHasVisibleText()` (läuft durch
   Fragments/Elemente). Betrifft potenziell sehr viele der 165 Dateien, die `Button`
   importieren — z.B. alle bisher beobachteten "Button"-ohne-Namen-Fälle (Familienkonten,
   Mitgliederliste "Details"/"Deaktivieren", Nachrichten-Compose). `npx tsc --noEmit` clean
   danach.

4. **Root-Cause-Fix: `/scheduler` zeigte bei JEDER Session nur "Trainer" statt echtem Namen** —
   `app/api/sessions/route.ts` nutzte für die Trainer-/Mitglieder-Namensauflösung
   (`trainers`/`users`-Tabellen, sowie `bookings` → `users.full_name`-Join) den
   RLS-gescopten User-Client (`auth.supabase`). Per Netzwerk-Response empirisch verifiziert:
   `trainerId` war in fast jeder Session korrekt gesetzt, `trainerName` trotzdem immer
   `"Trainer"` (Fallback) — die Lookup-Queries kamen leer zurück, nicht die Namen. Ursache:
   RLS blockt selbst für Admin den Read auf fremde `trainers`/`users`-Zeilen über den
   User-Client. Fix: Namens-Lookups (Trainer + Buchende Mitglieder) laufen jetzt über
   `createServiceClient()` — die Haupt-Sessions-Query bleibt unverändert RLS-gescoped.
   Empirisch im Browser verifiziert (Maria Koch, Christina Schmidt, Hans Schäfer erscheinen
   jetzt korrekt). Kleinere Teilkorrektur vorher: `hasTextContent`-artiger Bug in derselben
   Datei — `trainersMap` wurde immer gesetzt (auch mit 'Trainer'-Fallback), was den
   nachgelagerten `users.full_name`-Fallback blockierte; ebenfalls behoben, war aber nicht
   die Hauptursache. `npx tsc --noEmit` clean.

5. **Nav-Reorganisation (User-Wunsch)**: Stundennachweise+Abwesenheiten zusammengelegt (ein Link,
   Tabs, `/admin/hours-logs`); Sonderveranstaltungen von Training nach Spielbetrieb verschoben;
   Dokumente+Versammlungen+Board-Beschlüsse zusammengelegt (ein Link, 3 Tabs, `/admin/documents`).
   Alte Routen (`/admin/absences`, `/admin/meetings`, `/admin/decisions`) per 307 (NICHT 308!)
   umgeleitet — Lehre aus Befund oben. `decisions/page.tsx`s RLS-Defense-in-Depth-SSR-Fetch
   (Kommentar: "policies require a real membership row...") 1:1 nach `documents/page.tsx`
   übernommen, nicht geschwächt.
6. **Dabei gefunden+gefixt: `meeting_invitations.club_id` existiert nicht** (Konsolen-Fehler beim
   Verifizieren sichtbar) — Tabelle hat laut Migration nur `decision_id`/`member_id`, keine
   Club-Spalte; Club-Scoping lief bisher fälschlich über eine nicht existierende Spalte (Query
   schlug fehl, Fehler wurde nur geloggt, Einladungsstatus im Board-Beschlüsse-Tab blieb leer).
   Gefixt: Scoping jetzt über `decision_id IN (...)` wie bei `decision_votes` (das Query war
   dort schon korrekt).
7. **`Vereinseinstellungen`**: "Maximale Mitgliederzahl" (freies Zahlenfeld) entfernt — das
   reale Geschäftsmodell hat kein Member-Limit, nur einen Preis-Tier-Wechsel ab 200 Mitgliedern
   (`lib/plans.ts SOLO_THRESHOLD`). Verifiziert: Die einzige Enforcement-Stelle
   (`Club.addMember()`/`ValidationService`) ist toter Code, wird nirgends aus echten API-Routen
   aufgerufen — Admins waren nie wirklich blockiert, aber das Feld suggerierte fälschlich eine
   reale Grenze. Ersetzt durch Infotext. Ebenso "Status"-Dropdown (aktiv/inaktiv/suspendiert)
   entfernt — verifiziert unused (`clubs.status` wird nirgends für Zugriffskontrolle geprüft).
8. **Englische Wochentage in Vereinseinstellungen** ("Monday", "Tuesday"...) auf Deutsch gefixt —
   Verstoß gegen CLAUDE.md-Regel "keine englischen UI-Texte".
9. **Übungsleiterpauschale-Recherche (User-Frage, keine Code-Änderung)**: Bestehende Logik
   (`app/api/billing/trainers/route.ts`) ist steuerlich korrekt — Pauschale ist ein Freibetrag
   AUF den Stundenlohn, keine Extra-Zahlung; Aggregation korrekt pro Person clubübergreifend
   (da `trainers.id` global pro Mensch ist, `trainer_club` nur Zuordnungstabelle). Echte Lücke
   gefunden: kein `gemeinnützig`-Flag im Schema — die Steuerfrei-Berechnung läuft unconditional
   für jeden Club, auch nicht-gemeinnützige e.V.s. User hat noch nicht entschieden, ob das
   gefixt werden soll (offen).

10. **Saisonplanung — 2 gemeldete Bugs (User-Report während der Session)**:
    a) **`seasons/[id]/edit` zeigte keinen Status, erlaubte strukturelle Änderungen an
    veröffentlichten Saisons** (season_type/Jahr/Zeitraum) ohne Warnung, obwohl bereits
    Sessions/Buchungen darauf basieren. **Gefixt**: Warnbanner + gesperrte Felder im Formular,
    UND serverseitige 409-Sperre in `PATCH /api/seasons/[id]` (Client-`disabled` allein ist
    keine echte Absicherung). Live verifiziert.
    b) **"1 offene Konflikte"-Badge dauerhaft falsch** — `planning_conflicts`-Tabelle wird nur
    beim Publish befüllt (`ConflictDetector.persistConflicts()`, bereits vorhanden — beim
    ersten Versuch übersehen und fälschlich dupliziert, dann korrigiert), aber nie erneut
    synchronisiert, wenn sich der Plan danach ändert. **Versuch, `persistConflicts()` auch aus
    dem GET/POST-Handler der "Konflikte anzeigen"-Seite aufzurufen, wurde wieder entfernt** —
    verursachte einen serverseitigen Hänger (Request blieb dauerhaft "pending", auch nach
    Revert weiterhin reproduzierbar → kein Regressions-Bug durch meine Änderung, sondern eine
    vorbestehende Drizzle/Supabase-Pooler-Instabilität in dieser Dev-Umgebung, vgl.
    [[vps-infra-2026-07-21]]). **Nicht gefixt** — braucht Diagnose in einer stabilen
    Umgebung (nicht diesem Dev-Sandbox) bevor der Sync-Call sicher ergänzt werden kann.
    c) **Nebenbei gefunden+gefixt**: `groups`-Tabellen-Query per Drizzle schlug reproduzierbar
    fehl ("Failed query...from groups") an zwei Stellen — `plan-grid/route.ts` (beim Öffnen
    des Grids) und `clustering-engine.ts` `loadGroups()` (beim "Gruppenplanung generieren"-
    Schritt im Wizard). Beide auf Supabase-REST (`auth.supabase`/`createServiceClient()`)
    umgestellt statt Drizzle — passend zur CLAUDE.md-Regel "Drizzle/postgres-js schlägt aus
    der Dev-Umgebung fehl". `npx tsc --noEmit` clean.
    d) **"0 aktiv" trotz veröffentlichter, laufender Saison**: `is_active` wurde nirgends
    automatisch gesetzt. **Gefixt** in `POST /api/seasons/[id]/planning/confirm` (Publish-Schritt)
    — setzt jetzt `is_active: true` für die veröffentlichte Saison und `false` für alle
    vorher aktiven Saisons desselben Vereins (max. 1 aktive Saison pro Verein). Gilt nur für
    _künftige_ Publishes — die bereits veröffentlichte "Sommer 2026" bei TC Rheinland bräuchte
    einmalig ein manuelles `is_active=true` (z.B. via Supabase-Dashboard), da der PATCH-Endpoint
    CSRF-geschützt ist und ich das nicht aus diesem Chrome-DevTools-Kontext heraus setzen konnte.
    e) **Noch offen, nicht angefangen**: "3 Seiten zu 1 zusammenfassen" (Übersicht/Planungs-
    Wizard/Bearbeiten) — größerer Umbau, laut User nach den Bugs vorgesehen, aus Zeit-/
    Kostengründen in dieser Session nicht mehr begonnen.

### ⚠️ Offene Befunde (nicht verändert, nur dokumentiert)

7. **Saisonplanung: zwei widersprüchliche Konflikt-Zähler.** `GET /api/seasons/[id]` liefert
   `open_conflicts` als Live-COUNT auf die `planning_conflicts`-Tabelle (`status='open'`) —
   das speist Dashboard-Kachel und Tab-Badge ("Konflikte (1)"). Die dedizierte
   "Konflikte anzeigen"-Seite (`GET /api/seasons/[id]/planning/conflicts`) führt dagegen
   eine komplett neue Live-Erkennung (`ConflictDetector`) gegen die aktuellen
   `season_plan_entries` aus und ignoriert die `planning_conflicts`-Tabelle vollständig —
   Ergebnis bei TC Rheinland: 0 echte Konflikte, "Die Planung ist konfliktfrei." Die
   `planning_conflicts`-Zeile mit `status='open'` (vermutlich aus einer früheren
   Wizard-Phase) wird nie synchronisiert/aufgeräumt und bleibt für immer als falsche
   "1 offene Konflikte"-Warnung stehen — es gibt keinen UI-Weg, sie aufzulösen. Nicht
   selbst gefixt (Workflow rund um Publish/Wizard nicht vollständig nachvollzogen, Risiko
   für Fehlfix zu hoch für eine Zwischen-Iteration).
8. **Saisonplanung "0 aktiv" trotz laufender, veröffentlichter Saison.** `seasons.is_active`
   ist ein manuell setzbares DB-Feld (`PATCH /api/seasons/[id]` erlaubt es), wird aber laut
   Code-Suche nirgends automatisch beim Veröffentlichen einer Saison auf `true` gesetzt und
   es gibt keinen sichtbaren "Aktivieren"-Button in der UI. "Sommer 2026" läuft
   (1.4.–30.9.2026, heute 21.7.), ist veröffentlicht — Dashboard zeigt trotzdem
   "SEASONS GESAMT 1, 0 aktiv". Unklar ob `is_active` überhaupt noch für irgendeine
   nutzerseitige Logik gebraucht wird oder toter Zustand ist — zu klären, nicht gefixt.
9. **UX-Nit:** Klick auf "1 offene Konflikte" auf der Saison-Übersichtskarte springt nur zur
   Übersicht-Tab statt direkt zum Konflikte-Tab (zwei Klicks nötig).

10. **Dashboard "Alle Aktivitäten anzeigen" verlinkt auf `/admin/billing`**, obwohl der
    Aktivitäts-Feed Mitglieder-Events zeigt (neue Mitglieder, Buchungen) — wirkt wie ein
    Copy-Paste-Linkfehler, es gibt vermutlich keine dedizierte Activity-Log-Seite.
11. **Dummy-/Test-Daten in "produktivem" Account**: Mitglieder `audit.tobias.frank@example.de`,
    `audit.sabine.kraus@example.de`, `audit.markus.wendt@example.de` (Genehmigungen-Tab,
    Telefon `+49 000 0000000`) — sehen wie automatisiert erzeugte Test-/Audit-Seed-Daten aus,
    nicht wie echte Vereinsmitglieder. Sollten vor einer echten Demo/Verkaufspräsentation
    bereinigt werden.
12. **`mitglied.1@tsv-dortmund.de` als Mitglied bei TC Rheinland gelistet** — laut
    Business Rules kann ein Member in mehreren Vereinen aktiv sein, aber die E-Mail-Domain
    passt nicht zu TC Rheinland; könnte legitime Testdaten-Überschneidung oder ungewollte
    Seed-Kontamination zwischen den beiden Test-Clubs sein. Nicht abschließend geklärt.
13. **Familienkonten mit nur 1 Mitglied**: Beide angezeigten "Familien" (Markus Schwarz,
    Lukas Schröder) haben nur je 1 Mitglied — fragwürdig als "Familie". Dummy-/Testdaten,
    kein Code-Bug.
14. **E-Mail-Kampagnen ohne Verlauf**: Seite zeigt nur ein "Neue Kampagne"-Formular
    (Empfänger/Betreff/Inhalt/Senden), keine Liste vergangener Kampagnen, kein Versand-Status,
    kein Scheduling. Ggf. bewusst minimaler MVP-Scope, aber für ein "Kampagnen"-Feature dünn.
15. **Mehrere Icon-Buttons ohne sinnvolles Label trotz Fix** — der Root-Cause-Fix (#3 oben)
    behebt nur die _falsche_ "Button"-Fehlmeldung bei Buttons mit verstecktem Text. Reine
    Icon-Buttons ganz ohne Text (z.B. Familienkonten-Kopfzeile, Mitgliederlisten-Aktionen,
    Trainer-Liste "Details"/"Deaktivieren", Platzverwaltung-Kebab-Menüs, Rechnungen
    "PDF herunterladen"/"Rechnung löschen") brauchen weiterhin ein explizites `aria-label` an
    der jeweiligen Aufrufstelle — das ist NICHT automatisch mitgefixt. Müsste Datei für Datei
    ergänzt werden (großer Umfang, hier nicht gemacht).

### 11. Rest-Klickthrough 2026-07-22 (Training/Spielbetrieb/Finanzen/Vereinsführung) — neue Befunde

**⚠️ Nicht gefixt, dokumentiert:**

11. **`GET /api/analytics` wirft 500** — speist den "Berichte & Exporte"-Tab unter
    Auswertungen & Berichte (alle KPI-Kacheln zeigen dauerhaft "--"). Root Cause:
    `app/api/analytics/route.ts` instanziiert `Drizzle*Repository`-Klassen
    (`DrizzleClubRepository`, `DrizzleScheduleRepository`, `DrizzleTrainerRepository`,
    `DrizzleCourtRepository`, `DrizzleBookingRepository`) direkt statt über Supabase-REST —
    derselbe Root-Cause wie die in dieser Session bereits gefixten Drizzle-Bugs (`groups`-Query
    in `plan-grid/route.ts` und `clustering-engine.ts`, vgl. Fund 10c). Der zweite Analytics-Tab
    ("Analytics", Standard-Tab) funktioniert einwandfrei (154 Mitglieder, Charts etc.) — nutzt
    vermutlich einen anderen, bereits Supabase-REST-basierten Endpoint. Braucht denselben Fix
    wie zuvor (Drizzle → Supabase REST), hier nicht umgesetzt (5 Repository-Klassen, größerer
    Umbau als die bisherigen Einzeiler-Fixes).
12. **Analytics-Seite zeigt KI-Features unconditional trotz deaktivierter Feature-Flags** —
    "KI Insights", "Matchmaking" und "Churn Prediction" werden auf `/admin/analytics` immer
    gerendert und `/api/ai/churn-prediction` wird sogar aufgerufen (200), obwohl im
    Modul-Tab (Vereinseinstellungen) sowohl "KI-Matchmaking" als auch "KI-Analyse
    (Saisonplanung)" für TC Rheinland explizit deaktiviert sind. Passt zum bereits bekannten
    fail-open-Gating-Muster aus [[nav-module-gating-audit-2026-07-21]] — dort wurden 7 ähnliche
    Bugs gefixt, dieser hier wurde nicht mitentdeckt. Relevant auch wegen echter Gemini-API-
    Kosten für Clubs, die das Feature bewusst abgeschaltet haben.
13. **Mitgliederzahl-Inkonsistenz zwischen Seiten** — Dashboard und Auswertungen zeigen
    "154 Mitglieder", die Abonnement-Seite zeigt "166 Aktive Mitglieder" für denselben Club
    zur selben Zeit. Unterschiedliche Queries/Zählweisen (evtl. Rollen- oder
    Status-Filterunterschiede) — nicht tief genug untersucht um die Ursache zu benennen.
14. **Pricing-Tier-Lücke in der Abonnement-Anzeige** — Starter wirbt mit "bis 200 Mitglieder",
    Professional mit "ab 250 Mitglieder". Der Bereich 201–249 ist in keinem der beiden Badges
    abgedeckt. `lib/plans.ts` `SOLO_THRESHOLD` liegt laut vorherigem Fund (#7 oben) bei 200 —
    die Professional-Karte sollte vermutlich "ab 200" statt "ab 250" zeigen, oder die
    Threshold-Logik hat tatsächlich eine andere Schwelle als die UI-Kopie suggeriert. Reiner
    Text-/Logik-Abgleich nötig, nicht gefixt.
15. **Settings-Formular fällt bei abgelaufener Session still auf Default-Werte zurück statt
    einen Re-Login zu erzwingen** — als die Supabase-Session mitten in der Session ablief
    (JWT `expires_in=3600`), schlug der Re-Fetch beim Wechsel zwischen den
    Vereinseinstellungen-Tabs (Allgemein/Branding/Vereinsregister/Audit-Logs) mit Toast
    "Fehler beim Laden der Einstellungen" fehl — das Formular zeigte danach LEERE/DEFAULT-Werte
    statt der echten Clubdaten (Vereinsname leer statt "TC Rheinland e.V.", Stundenpreis 18→15,
    Bundesland "Nordrhein-Westfalen"→"Bundesland wählen", Zahlungsweg "SEPA-Lastschrift"→
    "Überweisung", Rechnungspräfix "INV"→leer). Kein Redirect zum Login, keine deutliche
    Warnung. Hätte ein Admin in diesem Zustand auf "Speichern" geklickt, wären die echten
    Vereinsdaten mit Platzhaltern überschrieben worden — echtes Datenverlustrisiko bei
    Session-Timeout während der Nutzung. Root Cause nicht im Detail untersucht (Cookie-Refresh
    in `proxy.ts`/`@supabase/ssr` vs. Client-seitiges Error-Handling im Settings-Formular).
16. **VPS-Infra: intermittierendes TLS-Zertifikat-Problem bei `supabase.swingz.cloud`** —
    während der Session lieferte ein `openssl s_client`-Check kurzzeitig ein für eine völlig
    andere, seit 2021 abgelaufene Domain (`CN=serkan.cc`, `notAfter=Dec 4 2021`) ausgestelltes
    Zertifikat zurück (`CERT_HAS_EXPIRED` in den Next.js-Logs, alle Supabase-Calls schlugen
    fehl, Login brach mit "fetch failed" ab). Drei Sekunden später beim Retry wieder das
    korrekte `CN=supabase.swingz.cloud`-Zertifikat. Deutet auf ein instabiles/fehlkonfiguriertes
    TLS-Setup auf dem self-hosted VPS hin (z.B. SNI-Routing-Problem bei mehreren vhosts auf
    derselben IP/demselben Reverse-Proxy) — passend zu den bereits dokumentierten
    Pooler-/SSL-Instabilitäten in [[vps-infra-2026-07-21]]. `swingz.vercel.app` (Production)
    war zum Vergleichszeitpunkt normal erreichbar (200) — kein Totalausfall, aber ein reales,
    reproduzierbares Zuverlässigkeitsrisiko, das vermutlich auch Fund #15 (Session-Expiry-
    Kaskade) mitverursacht hat. Braucht VPS-seitige Diagnose (Nginx/Caddy-vhost-Config), nicht
    aus diesem Dev-Sandbox behebbar.
17. **Browser-Cache-308-Vorfall live reproduziert** (kein neuer Bug, aber empirisch bestätigtes
    Risiko): Ein Chrome-Profil, das `/admin/hours-logs` vor dem Umbau (als die Route noch ein
    `permanent:true`-Redirect-Ziel war) besucht hatte, blieb dauerhaft auf `/admin/trainers`
    hängen — selbst nach Server-Neustart, `.next`-Cache-Löschung und `ignoreCache:true`-
    Navigation. Nur ein expliziter Cache-Buster-Query-Parameter half. Bestätigt, dass der
    Kommentar in `next.config.js` ("ein 308 hier hat zuvor schon einmal eine Seite dauerhaft im
    Browser-Cache verschluckt") ein reales, wiederkehrendes Risiko beschreibt und nicht nur
    Theorie ist — für jeden Nutzer, der die alte URL vor dem Fix besucht hat, bleibt der Bug
    im eigenen Browser bestehen, bis der HTTP-Cache manuell geleert wird.

**Kleinere Beobachtungen, nicht tief genug geprüft für einen Fix:**

18. Platzverwaltung: "Platztypen verwalten 0 Typen" trotz Plätzen mit gesetzten Belägen
    (Hartplatz/Sand/Rasen) — evtl. bewusst getrennte Konzepte (freies Belag-Feld pro Platz vs.
    eigenständige "Platztyp"-Entität), evtl. Inkonsistenz. "Platz 9 Test" in der Platzliste
    passt zum bereits dokumentierten Muster von Test-Seed-Daten in einem sonst produktiven
    Account.
19. Sonderveranstaltungen-Dialog: zwei Zahlen-Spinner (vermutlich Teilnehmerzahl/Preis) ohne
    sichtbares Label und mit `valuemax="0"` — evtl. kleine Validierungs-/A11y-Lücke im
    Event-Formular.
20. "Audit-Logs" (Vereinseinstellungen-Tab) zeigt "Keine Audit-Logs vorhanden", obwohl in dieser
    und der vorherigen Session diverse Admin-Aktionen stattfanden (Branding-Änderungen,
    Settings-Saves) — möglicherweise ist Audit-Logging für diese Aktionstypen nicht
    verdrahtet, nicht abschließend verifiziert.
21. `/admin/perf-history` bestätigt als **bewusster** Orphan — internes Dev-Diagnose-Tool für
    Saisonplanungs-Benchmarks (lokale Läufe + nightly GitHub-Actions-Pipeline), zu Recht nicht
    in der Sidebar-Nav, kein Bug. Alle anderen geprüften "Orphan"-Kandidaten sind über Redirects
    oder Tabs erreichbar: `/admin/audit-logs` → Tab in Vereinseinstellungen,
    `/admin/approvals` → 307 zu `/admin/members?tab=approvals`, `/admin/newsletters` → 307 zu
    `/admin/email-campaigns`, `/admin/court-types` → 308 zu `/admin/settings`.
