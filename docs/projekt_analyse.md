# Projektanalyse: SwingZ — All-in-One Tennis-Vereins-SaaS

> **Update 2026-06-26:** Die Multi-Sport-Erweiterung (Padel, Pickleball, Squash) wurde aus dem Q3-Roadmap-Plan entfernt (Commit `54269a7`). Sämtliche hier dokumentierten Multi-Sport-Abschnitte bleiben als **historische Analyse** archiviert; eine Nachimplementierung wird im Sprint H2 2026 / Q1 2027 neu bewertet. Siehe `docs/UMSETZUNGSPLAN_PROJEKTANALYSE.md` für den aktuellen Plan.
>
> **Stand:** 25. Juni 2026
> **Methodik:** Vollinventur des Repos (`/home/aeugeln/SwingZ`) + DACH-Wettbewerbsrecherche (Playtomic · tennis.de/DTB · BookandPlay · Tennis Integrated · USTA/PodPlay) + Bewertung aus vier Perspektiven: Senior Software Architect · Product Manager · UX Designer · Tennis-App-Experte.
> **Scope:** Architektur, Funktionalität, UX, UI, Tennis-Produkt, Performance, Sicherheit, Monetarisierung, Zukunftsfähigkeit.

---

## Zusammenfassung

### Gesamtbewertung: **7,8 / 10** — Markt-fähige Tennis-Vereins-SaaS mit echtem USP, aber zwei strategische Lücken

### Größte Stärken

- **KI-Saisonplaner (Alleinstellung):** `lib/season-planning/clustering-engine.ts` mit Hard/Soft-Constraint-Clustering, Backtracking (depth 5), Waitlist, Niveau-Matching, KI-gestützter Auto-Plan via Gemini Flash. Kein DACH-Wettbewerb hat dieses Feature in dieser Tiefe.
- **D-A-CH-Compliance „by design":** SEPA-`pain.008`-Generator + Verzugszins-Berechnung (5 %-Punkte über Basiszins) + Mahnwesen mit Dunning-Service + DTB-`nuLiga`-Scraper + Verbandsexport. Playtomic / BookandPlay haben das nicht.
- **Saubere 5-Rollen-Architektur:** `owner > superadmin > admin > trainer > member` in `proxy.ts` (nicht `middleware.ts`, Next.js 16 deprecated das), `withApiAuth()` + `requireAdminClub()` + `ADMIN_CLUB_COOKIE` konsequent durchgezogen.

### Größte Risiken

- **B2C-Engagement-Lücke:** Open Matches ist nur CRUD ohne Live-Scoring, kein ELO/LK-Spieler-Ranking (nur Import), keine Match-History, kein Social Feed. Vergleich zu Playtomic ist hier meilenweit entfernt — Vereins-Vorstände lieben es, Mitglieder nicht.
- **DB-Abstraktions-Schizophrenie:** Drizzle ORM (`db.select()`) wird parallel zu `supabase.from()` (REST) genutzt. Drei Tabellen (`email_queue`, `groups`, `email_campaigns`) sind nicht in `supabase-types.ts` und benötigen `as any`. Service-Client umgeht RLS teilweise ohne klare Audit-Dokumentation.
- **Mobile-Reliability:** PWA-only mit VAPID-Push stößt auf iOS-Restriktionen (nur nach „Add to Homescreen", manuelle Toggles). Reaktionskritische Buchungs-/Wetterwarnungen verpuffen auf iPhones oft ungelesen.

---

## Kritische Probleme (Priorisiert)

| #    | Problem                                                                                       | Impact                              | Aufwand |
| ---- | --------------------------------------------------------------------------------------------- | ----------------------------------- | ------- |
| 🔴 1 | **DB-Query-Layer inkonsistent** (Drizzle vs. supabase-js gemischt, RLS-Bypass teils unsauber) | Sicherheit + Wartbarkeit            | M       |
| 🔴 2 | **Kein Spieler-ELO/LK aus eigener Match-History** (nur NuLiga-Import)                         | B2C-Bindung langfristig weg         | M       |
| 🔴 3 | **Kein Live-Match-Scoring** (kein UI am Platz, kein Punkte-Tippen)                            | Differenzierung vs. Playtomic       | H       |
| 🟡 4 | **PWA-Push auf iOS unzuverlässig** (Wetterwarnungen verpuffen)                                | Mobile-UX eingeschränkt             | M       |
| 🟡 5 | **Hardware/IoT-Integration fehlt** (Licht, Türschloss, Heizung nicht aus Buchung schaltbar)   | B2B-Differenzierung vs. BookandPlay | H       |
| 🟡 6 | **next-intl aktiv aber unused** (Bundle-Overhead ohne Nutzen, harte deutsche Strings)         | Technische Schuld                   | N       |
| 🟢 7 | **Bundle-Analyzer fehlt** in `next.config.js`                                                 | Performance-Optimierung             | N       |

### Begründung Ranking

**#1 (DB-Doppelschicht)** ist die einzig wirklich kritische **technische** Schuld — sie provoziert Sicherheitslücken (Service-Client umgeht RLS ohne Audit), Refactoring-Fehler (Tabellen-Drift) und Performance-Patterns die mal RLS-bypassed, mal nicht. Sofort angehen.

**#2 + #3 (B2C-Engagement)** sind die strategisch wichtigsten: ohne Spieler-Ranking und Live-Scoring bleibt SwingZ ein reines Verwaltungs-Tool, das die Mitglieder nicht zum daily open motiviert. Das gefährdet Renewal-Rate bei den Vereinen.

**#4–#7** sind wichtig, aber in 1–2 Quartalen lösbar, ohne das Produkt zu sprengen.

---

## Verbesserungen nach Priorität

### 🔴 Muss verbessert werden (Q1)

| Item                                                                                                                                                              | Aufwand | Nutzen                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| **DB-Layer: Drizzle als Single-Source-of-Truth** durchsetzen, `supabase.from()` nur noch für Auth + Storage                                                       | M       | Bug-Klasse aus, RLS-Audit möglich, Typen-Sicherheit zurück |
| **`email_queue` + `groups` + `email_campaigns` ins Drizzle-Schema heben** — `as any`-Passagen in `app/api/email-campaigns/route.ts` etc. eliminieren              | N       | Saubere Typen, Drizzle-Codegen-Vorteile                    |
| **nuLiga-Cron-Jobs stabilisieren** — Retry-Logik, Layout-Change-Alarm nach `lib/services/nuliga-scraper.ts` (gibt schon `log.error` bei leerem Parse → erweitern) | N       | DACH-Differenzierung legal absichern                       |
| **Match-Result-Tracking-Eintritt** — DB-Schema `match_results` (oder Erweiterung `open_matches`), POST-Route, Member-Profile zeigt Historie                       | M       | Schafft B2C-Daily-Open-Anker                               |
| **Stufe-1-ELO aus eigenem Verein** (Vereins-ELO, parallel zu importiertem LK) — Anzeige im Member-Profil                                                          | M       | Erste Stufe vor LK-Sync                                    |

### 🟡 Sollte verbessert werden (Q2)

| Item                                                                                                                             | Aufwand | Nutzen                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| **Live-Match-Scoring PWA** (Punkte-Tipp-UI am Platz, Push-Update bei Foulstand)                                                  | H       | Playtomic-Differenzierung, Mitglieder-Tagesöffner                  |
| **Capacitor Mobile App Wrapper** (Webview + native Push-Bridge) — iOS + Android App Store Präsenz                                | M       | Trust-Signal + iOS-Push-Reliability für Wetter-/Buchungs-Warnungen |
| **Smart-Court-API** (Licht + Türschloss + Heizung aus Buchung schalten) — erst Partner-Adapter (z.B. Nuki API), offen für andere | H       | B2B-Killerfeature vs. BookandPlay / PodPlay                        |
| **Self-Service Member-Onboarding** (über `/trial-training`/`/messages`/`/contact` hinaus)                                        | M       | Reduziert Admin-Bottleneck                                         |
| **Marketing-Tools** (Newsletter per Segment, Last-Minute-Alerts bei Cancel, Inaktivitäts-Reaktivierung)                          | M       | Vereinsbindung, Daily-Open-Rate                                    |
| **Pricing: Pay-per-Active-Member** (zusätzlich zu Starter/Professional, ab 500 Members z.B. +1 €/Mitglied/Jahr)                  | M       | Skaliert mit Vereinsgröße, fairer für kleine Vereine               |
| **Gamification ausbauen** vom aktuellen Leaderboard/Streak/Badges-Stand zu echten Club-Goals + Saison-Erfolge                    | M       | Tieferes Engagement als reine Punkte                               |

### 🟢 Nice-to-have (Q3+)

| Item                                                                                                  | Aufwand | Nutzen                                    |
| ----------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| **Multi-Sport** (Padel, Pickleball, Squash optional pro Court-Typ)                                    | M       | Neue B2B-Sales-Kanäle (Padel-Boom EU)     |
| **Trainer-Marketplace** (B2C, Trainer bieten freie Slots auf SwingZ, Provision)                       | H       | Plattform-Effekt, MRR-Boost               |
| **Club-Camera-Integration + Video-Analyse** (eigene Court-Cams streamen, KI markiert Ball-Positionen) | SH      | USP für Performance-orientierte Vereine   |
| **KI-Trainingsplan-Generator** pro Spieler (Level + Wochenstunden + Verletzungs-Risiken)              | M       | Anbindung an existierende Gemini-Pipeline |
| **Feed/Wall für Club-Community** (Posts, Trainer-Tipps, Match-Replays als Posts)                      | M       | Echtes Social-Gefühl                      |
| **Booking-Embed für Verbands-/Land-Partnerportale** (z.B. DTB-Verbands-Site zeigt Vereins-Plätze)     | M       | Marketing-Reach ohne Akquise-Kosten       |

---

## Technische Analyse

### Architektur-Snapshot

| Metrik                                    | Wert                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| **App-Pages (`app/**/page.tsx`)\*\*       | 119                                                                       |
| **API-Routes (`app/api/**/route.ts`)\*\*  | ~292                                                                      |
| **React-Components (`components/*.tsx`)** | 127                                                                       |
| **Lib-Module (`lib/*.ts`)**               | 121                                                                       |
| **Src-Infrastructure (`src/**/\*.ts`)\*\* | 190                                                                       |
| **Supabase-Migrations**                   | ~102                                                                      |
| **Drizzle-Schema-Tabellen**               | ~38                                                                       |
| **E2E + Unit-Tests**                      | 49                                                                        |
| **Benchmarks**                            | 2 (`clustering.bench.ts`, `clustering-scaling.bench.ts`)                  |
| **Roles-Routes**                          | owner: 7 · superadmin: 8 · admin: 47 · trainer: 5 · member: 7 · public: 1 |

### Tech-Stack-Bewertung

```text
Next.js 16 (Turbopack)          ●●●●●  modern, schnell
TypeScript (strict)              ●●●●●  typsicher, fast keine `any`s in lib/
Drizzle ORM                     ●●●●○  state-of-the-art, aber Co-Existenz mit supabase-js problematisch
Supabase (Postgres + Auth)       ●●●●●  Standard für Startups, RLS-Power
Stripe (Webhook + Checkout)      ●●●●●  DACH-Pricing lokalisiert (29 €/79 €)
Sentry (Server + Client)         ●●●●○  konfiguriert, aber Coverage nicht auditiert
VAPID Web-Push + Email-Queue    ●●●●○  frisch eingeführt, reif
Google Gemini Flash (AI)         ●●●●○  aktiv, OpenAI-kompatibler Endpoint, latenz-kritisch
shadcn/ui + Tailwind             ●●●●●  konsistente Basis
next-intl (i18n)                 ●●○○○  aktiv aber UNUSED (siehe Schuld #6 oben)
Vitest + Playwright              ●●●○○  49 Tests — gut für ein Startup, lückenhaft für SaaS-Scale
```

### Konkrete technische Schmerzen

1. **Drizzle ↔ supabase-js Co-Existenz**
   - Beispiel: `app/api/email-campaigns/route.ts:6` sagt explizit _„`email_campaigns`, `email_queue`, and `groups` are not in the generated Database type. (supabase as any) is used only for those"_ — das ist dreifach Antipattern (Tabellen-Drift + `as any` + unklar welche Tabellen RLS-bypassed sind).
   - Service-Client wird großzügig für Performance + Convenience bypassing RLS — `lib/supabase/service.ts` ist toll, aber nirgends ist dokumentiert _wo das Audit-Trail-Bypassing erlaubt ist_ und wo nicht.

2. **React-State-Race im Saisonplanungs-Wizard**
   - In dieser Session gefixt (`lib/season-planning/readiness-check.tsx`) — war ein klassisches `setState` während Render-Warning. Weist darauf hin, dass State-Management in Wizards (große Member-Payloads, Clustering-Re-Renders) **kritisch** ist und periodisch auditiert werden muss.

3. **No-Bundle-Analysis**
   - Kein `@next/bundle-analyzer` in den devDependencies. Bei 127 Components + 119 Pages ist das ein Blinder Fleck für Performance-Regressionen.

4. **`force-dynamic` als Default in vielen Routen** (`app/(protected)/dashboard/`, `app/(protected)/dashboard/bookings/new/`)
   - Korrekt für die Real-time-Booking-Daten → aber kostet SSR-Latency. Sinnvoll, weil Vercel-Caching bei Multitenant-Daten ohnehin problematisch ist.

5. **Next.js 16 Middleware-Deprecation**
   - Rollen-Auth läuft in `proxy.ts`. Das ist dokumentiert (CLAUDE.md + Kommentar) — aber muss vor dem ersten größeren Next.js-Update bewertet werden, ob der Edge-Runtime-Layer noch hält.

---

## UX/UI-Analyse

### Was funktioniert

- **shadcn/ui + Tailwind als Fundament** — konsistente Hover States, Cards, Tables, Dialogs, Skeleton-States, Empty-States sind überall vorhanden. Verhindert eigenes UI-Inventar.
- **Wizard-Konzept im KI-Planer** verwandelt komplexe Constraint-Satisfaction in ein simples Step-by-Step UX (`Config → Cluster → Edit → Finalize`). Hervorragend.
- **Command-Palette** (`components/command-palette.tsx`) + **Keyboard-Shortcuts** — die App fühlt sich an wie ein Profi-Tool für Admins/Trainer.
- **Mobile-Bottom-Nav** (`components/layout/mobile-bottom-nav.tsx`) für Member — brauchbar, aber siehe Lücken unten.

### Was schwach wirkt

- **Gamification-Dashboard "angeklebt":** `components/gamification-dashboard.tsx` zeigt Leaderboard + Streaks + Badges — aber ohne soziale Interaktion (kein „Wer hat mich diese Woche überholt?", kein Kommentar, kein See-other-player-Profile). Wirkt technisch, nicht emotional.
- **Open-Matches ist eine Liste** (`components/open-matches.tsx`): keine Profilbilder, kein „Wer sucht wie ich?", kein Inline-Quick-Match-Button.
- **`/matches` Page** (`components/ai/matchmaking-panel.tsx`) listet Match-Kandidaten — aber ohne Match-History des Gegners, ohne Head-to-Head, ohne direkten „Fordern"-Button im Stil von Bumble/Tinder.
- **Loading- und Empty-States:** teils gut definiert (Loading-Skeleton), teils fehlend (Empty-Match-List).

### Was fehlt sichtbar

- **Kein Light/Dark-Mode-Toggle im UI** — `CLAUDE.md` sagt „Dark Mode immer mitdenken (beide Themes testen)" aber kein sichtbarer Toggle für Endnutzer. Default ist hell, kein User-Switch.
- **Kein „Jetzt Spielen"-Big-CTA** für Member — die Mobile-First-Logik kommt nirgends als Hero-CTA auf, das die häufigste User-Aktion (Platz buchen oder Match finden) direkt anschiebt.
- **Kein App-Install-Banner** für PWA auf iOS — ohne das funktionieren Push-Notifications nicht. Es gibt zwar `components/pwa-install-prompt.tsx` (deutet auf vorhanden), aber kein sichtbarer „Install SwingZ" CTA in den ersten 30 Sekunden App-Nutzung.
- **Kein Onboarding-Tooltip-Layer für neue Member** — Member landen direkt im Dashboard und müssen selbst herausfinden wo sie Präferenzen setzen, Matches finden, Plätze buchen.

---

## Tennis-Produkt-Analyse

### Wettbewerbsmatrix (DACH + EU)

| Feature                                             | **SwingZ**                            | Playtomic      | tennis.de (DTB) | BookandPlay | Tennis Integrated |
| --------------------------------------------------- | ------------------------------------- | -------------- | --------------- | ----------- | ----------------- |
| **Platzbuchung (Core)**                             | ✅                                    | ✅             | ❌              | ✅          | ✅                |
| **Buchungsregeln + Sperrblöcke**                    | ✅                                    | ✅             | ❌              | ✅          | ✅                |
| **KI-gestützte Saisonplanung**                      | ⭐ **USP**                            | ❌             | ❌              | ❌          | ❌                |
| **Constraint-based Auto-Clustering**                | ⭐                                    | ❌             | ❌              | ❌          | ❌                |
| **SEPA-Lastschrift (pain.008)**                     | ✅                                    | ❌             | ❌              | ✅          | ✅                |
| **Mahnwesen + Verzugszins (5 %-P. über Basiszins)** | ✅                                    | ❌             | ❌              | ❌          | ✅                |
| **PDF-Rechnung (GoBD-konform)**                     | ✅ (`lib/pdf/invoice-pdf-utils.tsx`)  | ❌             | ❌              | ✅          | ✅                |
| **DTB/nuLiga-Sync** (Standings, Verbandsexport)     | ✅                                    | ❌             | ✅ nativ        | ❌          | ❌                |
| **Offene Matches (Suche/Biete)**                    | ✅ Basic                              | ⭐ Exzellent   | ❌              | ❌          | ❌                |
| **Skill-Based Matchmaking (AI)**                    | ✅ (`matchmaking-panel.tsx`)          | ✅             | ❌              | ❌          | ❌                |
| **Live-Match-Scoring (Punkte tippen)**              | ❌                                    | ✅             | ❌              | ❌          | ❌                |
| **Spieler-ELO/LK (eigene Berechnung)**              | ❌ (nur Import)                       | ELO            | LK nativ        | ❌          | ❌                |
| **Match-History pro Spieler**                       | ❌                                    | ✅             | ✅              | ❌          | ❌                |
| **Tournaments (KO + Round-Robin)**                  | ✅ (`lib/tournament/draw.ts`)         | ✅             | ✅              | ❌          | ✅                |
| **Liga-Verwaltung**                                 | ✅ (`leagues/`) + nuLiga-Import       | ❌             | ✅              | ❌          | ✅                |
| **Mobile Native App**                               | ❌ (nur PWA)                          | ✅ iOS+Android | ✅              | ✅          | ✅                |
| **Push-Notifications zuverlässig**                  | ⚠️ iOS-eingeschränkt                  | ✅             | ✅              | ✅          | ✅                |
| **Hardware-Integration (Licht/Zutritt/Heizung)**    | ❌                                    | ✅             | ❌              | ✅          | ✅                |
| **Multi-Sport (Padel, Pickleball)**                 | ❌                                    | ✅ Padel       | ❌              | ❌          | ❌                |
| **Trainer-Marketplace**                             | ❌                                    | ✅             | ❌              | ❌          | ❌                |
| **Community/Feed/Posts**                            | ❌                                    | ✅             | ❌              | ❌          | ❌                |
| **In-App-Chat/Messaging**                           | ⚠️ `app/messages/` nur Order-Tracking | ✅             | ❌              | ❌          | ❌                |
| **Beschluss-/Voting-Modul**                         | ✅ (`lib/decisions/`) — einzigartig   | ❌             | ❌              | ❌          | ❌                |
| **Special Events (Turnier-Sperren, Wetter)**        | ✅ (`admin/weather`)                  | ❌             | ❌              | ❌          | ❌                |

### Was SwingZ dominiert

- **Vereins-Verwaltung mit KI-Unterstützung:** Niemand sonst verbindet Constraint-Auto-Clustering mit Live-Dry-Run. Das ist ein B2B-Pitch auf Augenhöhe mit Enterprise-Tools (RacquetDesk, Tennis Integrated) zum Bruchteil des Preises. **Muss sichtbarer vermarktet werden** — das KI-Clustering ist im UI derzeit zu versteckt (3 Wizard Steps, viele Klicks).
- **D-A-CH-Compliance:** SEPA + Mahnwesen + PDF + nuLiga — kompletter Lotse für deutsche Vereine. Playtomic / BookandPlay haben das nicht. **Muss im Marketing „DACH-First"-Story tragen.**
- **Decision/Voting-Modul** — süß und einzigartig, hebt sich ab. Kann als „Club-Demokratie"-Feature vermarktet werden (gerade für Genossenschafts-Vereine interessant).

### Was SwingZ fehlt (gegen den Wettbewerb)

- **Spieler-Perspektive = Zukunfts-Risiko.** Vereine zahlen für Verwaltungstool, aber solange Mitglieder die App nach 1 Woche nicht mehr öffnen, kommt kein Renewal. Playtomic hat das mit „Open Matches + Live-Scoring + Player Profile + ELO + Community" gelöst — SwingZ hat davon aktuell nur die Open-Match-Liste.
- **Hardware-Integration fehlt.** BookandPlay + PodPlay machen das. B2B-Vereine mit Smart-Courts (Lichtautomatik, RFID-Tür) sind ein riesiger Markt — sie können heute nicht ohne Drittanbieter.
- **Keine Native-App.** iOS-Push-Restriktionen sind 2026 noch real. Vereine sagen: „Unsere Spieler kriegen die Wetterwarnung nicht mit."

---

## Feature-Roadmap

### Q1: B2B-Lock-in + Technical Foundation (Monate 1–3)

> **Warum jetzt:** Vereine sind die zahlende Zielgruppe. Sie glücklich zu machen und die Tech-Schulden abzutragen ist Voraussetzung für alles weitere.

- **Mon 1 — DB-Unify:** Drizzle als Single-Source-of-Truth, `email_queue`/`groups`/`email_campaigns` ins Schema, alle `as any`-Passagen weg. Service-Client-Audit: Liste aller Routes die Service-Client nutzen + Begründung wo RLS-Bypass OK ist (Admin-Operations) und wo nicht (Member-Data-Lookups).
- **Mon 2 — KI-Premium-Sichtbarkeit:** Upsell-Modal „SwingZ AI Premium" im Saisonplaner-Wizard, das die Stunden Ersparnis pro Saison kommuniziert (z.B. „Du sparst ca. 12 Std Sportwarte-Arbeit"). Pricing-Page mit klarem Feature-Vergleich Starter vs. Professional.
- **Mon 3 — B2B-Polish:** nuLiga-Scraper-Retry + Layout-Change-Alarm. Mahnwesen-Workflow für Admins verbessern (1-Click-Stufe-2-Eskalation). Dunning-Dashboard UX-Refresh.

### Q2: B2C-Engagement + Smart Club (Monate 4–6)

> **Warum jetzt:** Die größte strategische Lücke. Vereine bleiben nur Kunden wenn Mitglieder die App täglich öffnen.

- **Mon 4 — Live-Match-Tracking:** DB-Schema `match_results` (score, sets, winner_id, loser_id, duration). Member können Matches direkt am Platz eintragen. Inline-Scoring + „Match beendet"-Button → ELO-Update. Push an Gegner.
- **Mon 5 — Spieler-Profile v2 + Echtzeit-ELO:** Match-History, Head-to-Head-Ansicht, Saison-Bilanz. ELO-Algorithmus (Glicko-2 oder vereinfachtes ELO). Verbands-ELO und Vereins-ELO separat (LK von nuLiga bleibt heilig).
- **Mon 6 — Capacitor Mobile-App Wrapper:** Webview + native Push-Bridge. iOS + Android App Store. Reicht für Trust + Push + Home-Screen, kein vollständiges Rewrite nötig.

### Q3: Expansion + Platform (Monate 7–9)

> **Warum jetzt:** Q2 hat die tägliche Öffnungsrate. Q3 macht aus Nutzern Käufer (Marketplace) und aus Vereinen Pros (Multi-Sport).

- **Mon 7 — Smart-Court API:** Partner-Adapter für erste Hardware (Licht, Tür). Webhook-basierte Buchung-zu-Hardware-Pipeline. Marketing als „Smart-Club"-Bundle für 79 €.
- **Mon 8 — Multi-Sport:** Court-Typ als Enum (`tennis`, `padel`, `pickleball`, `squash`). Booking-Dropdown erweitert. Padel-Boom in EU 2026 als Vertriebs-Trigger.
- **Mon 9 — Trainer-Marketplace MVP:** Trainer können freie Trainer-Sessions einstellen. Mitglieder finden + buchen. Provision 5 % an SwingZ.

### Q4+ (post-launch-backlog)

- KI-Trainingsplan-Generator (Spieler-persönlich)
- Video-Analyse (Club-Camera-Streams)
- Community-Feed/Wall
- Verbands-/Partner-Embeds (z.B. DTB-Verbandsseite zeigt Vereins-Plätze)

---

## Monetarisierung & Produktstrategie

### Aktuelle Pricing-Lage

| Tier             | Preis/Monat          | Features (impliziert)                                      |
| ---------------- | -------------------- | ---------------------------------------------------------- |
| **Starter**      | 29 €                 | Basis-Buchung, Mitglieder, einfache Buchhaltung            |
| **Professional** | 79 €                 | KI-Saisonplaner, nuLiga-Sync, Mahnwesen, Voting, Decisions |
| **Enterprise**   | (nicht angekündigt?) | Custom                                                     |

### Empfehlungen

1. **Pricing-Narrativ schärfen:** „Starter ist dein digitales Schwarzen Brett. Professional ist dein KI-Sportwart." Klare Wertversprechen, nicht Feature-Diff-Listen.
2. **Pay-per-Active-Member einführen** (zusätzlich zu Starter/Professional): Vereine >500 Mitglieder zahlen +1 €/Mitglied/Jahr. Faire Skalierung, höherer CLV bei großen Anlagen.
3. **Gast-Spieler-Transaktionsgebühr** (5 % auf Buchungen von Nicht-Mitgliedern) — Standard in der Branche (Playtomic). Wird nicht Vereins-Abo belasten.
4. **Hardware-Bundle als 79 € Add-On** (Smart-Court-Lizenz mit API-Access auf Partner-Hardware) — generiert MRR ohne Akquise-Kosten da in bestehender Pipeline.
5. **Trainer-Marketplace-Take-Rate** 5 % auf vermittelte Trainer-Sessions — Plattform-Effekt-Monetarisierung, skaliert mit Marktplatz-Größe.

### Marketing-Positionierung

> **Aktuell (zu schwach):** „Tennis-Vereins-Management."
>
> **Empfohlen:** **„SwingZ – Dein KI-Co-Trainer für den Sportwart."** Oder: **„Die einzige Tennis-Vereins-Software mit DTB-Anbindung und KI-Saisonplanung."**

Differenzierung statt Feature-Listing. KI-Clustering ist 12 Std/Monat Zeitersparnis — das ist eine Story, kein Feature.

---

## Performance & Skalierung

### Aktuelle Lage

- **Multitenant-Daten:** alle Routes machen `club_id`-Scoping. RLS-Policies vorhanden, aber regelmäßig umgangen via Service-Client (siehe Tech-Schulden #1).
- **Caching:** Aggressive `force-dynamic` in den wichtigen Dashboard-Routes → korrekt für Real-time-Buchungsdaten, aber keine Aggregat-Caching-Strategie für read-heavy Pages wie `/admin/mitglieder`.
- **Benchmarks vorhanden** für Clustering-Engine (`clustering.bench.ts` + `clustering-scaling.bench.ts`) — guter Ansatz, fehlt aber für andere komplexe Services (`nuliga-scraper`, `email-queue`).
- **Pending-Todos im Code: 30 TS-Errors** (laut vorheriger Session-Typecheck). Sind alt, nicht im aktuellen Diff. Cleaning-Ticket.

### Empfehlungen für Skalierung

1. **Aggregat-Caching pro Club** für Read-heavy Pages (`/admin/finanzen`, `/admin/mitglieder`). 60 s TTL + Tag-Invalidation bei Mutation.
2. **Materialized View für `nuLiga-Standings`** — Standings-Compute auf DB-Seite statt in JS.
3. **Edge-Middleware für statische Pages** (Landing, Pricing, About) → schneller First-Paint, weniger Vercel-Funktion-Sekunden.
4. **BullMQ oder Inngest für lange Jobs** (Saison-Plan-Generation kann 30+ s dauern). Heute läuft das synchron in `app/api/.../planning/confirm/route.ts` — blockiert Response.
5. **Read-Replica für Reporting** (Owner-Dashboard, Billing-Reports) — wenn >100 aktive Vereine live.

---

## Sicherheit

### Was funktioniert

- **5-Rollen-RBAC** mit `withApiAuth()` auf API-Routes und `requireAuth()` auf Server-Components. Admin-Club-Cookie (`ADMIN_CLUB_COOKIE`) verhindert Cross-Club-Daten-Leaks.
- **CSRF-Schutz** im `proxy.ts`.
- **Stripe-Webhook** mit separater Stripe-Config (`lib/stripe/stripe-client.ts`) — strict, wirft wenn nicht konfiguriert.
- **E-Mail via Resend SMTP** mit dedizierten Absendern (`noreply@swingz.cloud`, `info@swingz.cloud`) — keine Subdomain-Magic.
- **Sentry** ist konfiguriert (Server + Client) — Coverage aber ungetestet, kein scheduled Audit ob Errors ankommen.

### Was zu tun ist

1. **Service-Client-Audit (Priorität #1):** Inventur _welche Route_ den Service-Client nutzt + Klassifizierung (Admin-Operation OK, Member-Data-Lookup nicht OK). Dokumentation als `docs/supabase-rls-audit.md`.
2. **PII-Verschlüsselung prüfen:** IBAN (`lib/iban.ts`) wird in `sepa_mandates` gespeichert — verschlüsselt? Wahrscheinlich nicht (plaintext). GoBD-konform? Verschlüsselung-at-rest sollte Supabase-Default sein, aber Backup-Snapshots könnten Klartext enthalten.
3. **Rate-Limiting auf Auth-Routen** (`/login`, `/register`, `/auth/callback`) — fehlt vermutlich. Upstash-Rate-Limit ist der Standard.
4. **Audit-Log-Tabelle** — `src/domain/entities/audit-log.ts` erwähnt `subscription_assigned` etc., aber die Tabellen-Implementation ist zu prüfen. Compliance (GoBD) verlangt lückenlosen Audit-Trail für Finanz-Aktionen.
5. **Security-Headers** in `next.config.js` — CSP, X-Frame-Options, HSTS. Heute vermutlich nur Defaults.

---

## Zukunftsfähigkeit

### Wo SwingZ vorne ist

- **KI-First-Architektur:** Gemini-Flash-Integration existiert (`lib/ai/schedule-generator-v2.ts`, `src/infrastructure/ai/ai-client.ts`). Jede neue Domain kann mit demselben Pattern KI-gestützt werden, ohne dass KI nachträglich „angeflanscht" wird.
- **Decisions/Voting-Modul:** Viele Club-Apps nicht haben. Trend zur digitalen Vereinsdemokratie ist real.
- **Drizzle-ORM-Basis:** Wenn Q1 die Co-Existenz-Schulden abbaut, bleibt eine moderne Type-Safe ORM-Schicht.
- **Multi-Sport-Schema-Vorbereitung:** Booking-Typ ist Enum (`lib/types/court-booking.ts`: `regular`, `lesson`, `tournament`, `maintenance`, `blocked`). Ein neues `sport`-Enum pro Court-Erweiterung ist 3 Zeilen Arbeit.

### Wo nachjustiert werden muss

1. **AI-Latency observability:** Gemini-Flash ist schnell, aber wenn Plan-Generierung 30+ s dauert → User bricht ab. Bessere Progress-Reporting + Streaming-Antwort (`streamText`) statt `generateText`.
2. **Migrations-Disziplin:** 102 Migrationen ist viel. Konsolidierung auf 60–70 wäre wartbarer ohne Datenverlust — Aufwand nach DB-Snapshot-Vergleich.
3. **i18n-Strategie klären:** Entweder wirklich internationalisieren (Frankreich, Österreich) ODER next-intl rauswerfen und Hardcoded-Deutsch akzeptieren. DACH-only ist legitim, dann aber Provider weg.
4. **Mobile-Strategie klären:** PWA + Capacitor ODER React Native re-write. Erstere ist 4× so schnell gebaut, letztere ist langfristig besser. Empfehlung: Capacitor Q2.

---

## Empfehlungen für eine professionelle Version (Zusammenfassung)

### Quick-Wins (1–4 Wochen)

- DB-Layer-Unify (3 kleinere PRs)
- nuLiga-Cron-Retry
- KI-Upsell-Modal im Wizard
- PWA-Install-Banner für iOS-Nutzer
- Light/Dark-Mode-Toggle

### Mittelfristig (1–2 Quartale)

- Live-Match-Tracking + ELO
- Capacitor Mobile App
- Smart-Court API (Hardware-Adapter)
- Spieler-Profile v2 + Match-History
- Marketing-Tools (Newsletter, Last-Minute)

### Langfristig (3+ Quartale)

- Multi-Sport (Padel, Pickleball)
- Trainer-Marketplace
- KI-Trainingsplan-Generator
- Club-Camera-Integration
- Community-Feed

### Strategische Empfehlungen

1. **KI ist das USP — sichtbar machen.** Marketing, UI, Demo-Videos, Onboarding-Touren — alles muss den KI-Sportwart-Kontext tragen.
2. **DACH-first ist eine Position, kein Limit.** NRW/Bayern-Vereine haben Vereins-Sport-Beauftragte mit DTB-Kontakten — die Pipeline ist direkter als jeder PLG-Move.
3. **B2B zahlt, B2C bindet.** Pricing-Modell so bauen dass B2C-Engagement (ELO, Member-Satisfaction) die Renewal-Rate der B2B-Verträge sichert.
4. **Multi-Sport ist 1 Quartal später, kein Wettbewerbsverzicht.** Padel-Boom ist 2025/26 — Angriff 2027 wenn Böden und Trainer da sind.
5. **AI als Marketing-Tool, nicht nur als Feature.** „SwingZ hat den ersten KI-Sportwart Deutschlands" ist eine Story, kein Tech-Detail. Nutzt sie.

---

## Finale Bewertung

| Bereich                                  | Note         | Kommentar                                                                               |
| ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| **Architektur / Code-Qualität Backend**  | 9/10         | Starke lib-Modul-Trennung, saubere Rollen, gute Auth-Trennung                           |
| **Architektur / Code-Qualität Frontend** | 7/10         | React-18-Race-Bugs (gefixt), DB-Query-Mix, Bundle-Analyzer fehlt                        |
| **Funktionalität (B2B / Admin)**         | 9/10         | Saisonplaner, Mahnwesen, nuLiga, Voting — alle tief                                     |
| **Funktionalität (B2C / Member)**        | 5/10         | Open Matches basic, kein Live-Scoring, kein Ranking, kein Feed                          |
| **UX**                                   | 7/10         | shadcn-Konsistenz, Wizard clever, aber kein Install-Banner, kein Live-Anker             |
| **UI / Design**                          | 7/10         | Professionell, konsistent, kein sichtbarer Dark-Mode-Toggle                             |
| **Tennis-Produkt-Differenzierung**       | 8/10         | KI-Saisonplaner + nuLiga + SEPA sind USP, fehlt B2C-Tiefe                               |
| **Performance & Skalierbarkeit**         | 7/10         | Benchmarks für Clustering gut, restliche Cold-Spots                                     |
| **Sicherheit**                           | 7/10         | RBAC top, Service-Client-Audit fehlt, Rate-Limiting fehlt                               |
| **Monetarisierung & Strategie**          | 7/10         | Pricing steht, DACH-Position stark, B2C-Engagement-Lücke gefährdet Renewal              |
| **Zukunftsfähigkeit**                    | 8/10         | KI-Pipeline, Multi-Sport-Vorbereitung, Decisions-Modul — gute Hebel                     |
| **GESAMT**                               | **7,8 / 10** | Markt-fähig, mit klarem USP und zwei strategischen Lücken (B2C-Engagement, DB-Schulden) |

---

> **Empfehlung:** Vor Q1-Start sollten zwei **harte** Tickets priorisiert werden:
>
> 1. DB-Layer-Unify + Service-Client-Audit (Sicherheit + Wartbarkeit)
> 2. Live-Match-Tracking + Spieler-ELO-Skelett (B2C-Anker)
>
> Alles andere ist taktisch. Diese zwei definieren ob SwingZ in 12 Monaten ein Verwaltungs-Tool bleibt oder eine Plattform wird.
