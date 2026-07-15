# SwingZ — Seiten-Audit (Sammel-Datei)

> Wird Seite für Seite befüllt. Pro Seite ein vollständiger **Code-Audit + Visual-Audit → Findings → Fixes**.
>
> Methodik repliziert jeden Loop und ist gegen `CLAUDE.md` und die
> Sandbox-Konventionen im Projekt abgeglichen (German UI, shadcn/ui primitives, `createLogger`,
> Service-Client nur Server-Side, etc.).

---

## Methodik pro Seite

1. **Code-Audit** — `app/.../<page>.tsx` + Komponenten + zugehörige API-Routes + Hooks lesen.
   Geschaut wird auf:
   - UX-Lücken (kein Loading-/Empty-/Error-State, dead links, copy-paste-Fehler)
   - Performance (N+1, unnötige Server-Roundtrips, riesige Payloads)
   - Type safety (`any`, fehlende Zod-Schemas, Type-Widerholungen)
   - A11y (Focus-Reihenfolge, aria-Attribute, Kontrast)
   - i18n / Deutsche Texte / Locale-Formatierung
   - Convention-Drift (eigene UI-Komponenten statt shadcn/ui, `console.log`, `fetch` direkt, …)
   - Visuelle Konsistenz (Dark-Mode-Bugs, Spacing, Tone-Mismatch)
2. **Visual-Audit** — `browser-use` gegen den laufenden Dev-Server.
   Screenshots Light + Dark, plus Hover/Empty/Loading-States, plus Klick-Pfade.
3. **Findings-Doc** — diese Datei wird mit Prioritäten P0/P1/P2 befüllt.
4. **Implementierung in Iterationen** — pro Iteration max. 3 P0-Fixes, danach Reviewer
   - Typecheck + visuelle Re-Verifikation.
5. **Nächste Seite** — erst wenn die aktuelle Seite stabil aussieht.

---

## Coverages-Status

| Seite                    | Code-Audit | Visual-Audit | Findings | Fixes stable | Status  |
| ------------------------ | ---------- | ------------ | -------- | ------------ | ------- |
| `/admin` (Dashboard)     | ✅ done    | ✅ done      | ✅ 18    | ✅ stable    | ✅ done |
| Sidebar (approval badge) | ✅ done    | ✅ done      | ✅ 1     | ✅ stable    | ✅ done |

### Geplant (Admin)

- Mitglieder
  - `/admin/members`
  - `/admin/members/family`
  - `/admin/trial-training`
  - `/admin/work-duties`
  - `/messages`
  - `/admin/email-campaigns`
- Training
  - `/admin/seasons`
  - `/scheduler`
  - `/admin/trainers`
  - `/admin/special-events`
- Spielbetrieb
  - `/admin/courts`
  - `/admin/maintenance`
  - `/admin/weather`
  - `/admin/leagues`
  - `/admin/tournaments`
  - `/matchmaking`
- Finanzen
  - `/admin/billing`
  - `/admin/subscription`
  - `/admin/shop`
- Vereinsführung
  - `/admin/settings`
  - `/admin/analytics`
  - `/admin/documents`
  - `/admin/meetings`
  - `/admin/decisions`

---

## Findings-Format pro Seite

```md
### `/<pfad>` — <Titel der Seite>

**Audit-Datum:** YYYY-MM-DD
**Quell-Dateien:** app/...page.tsx, components/...

#### P0 — Korrekt / Sicher

- ...

#### P1 — UX-Stolperer

- ...

#### P2 — Polish / Konsistenz

- ...

#### Erledigt

- [x] ...
```

---

# `/admin` — Dashboard

**Audit-Datum:** _läuft_
**Quell-Dateien:** `app/(protected)/admin/(gated)/page.tsx`, `components/admin/premium-admin-hero.tsx`, `components/admin/activity-feed-compact.tsx`, `components/admin/admin-inbox-banner.tsx`, `components/ui/stat-card.tsx`, `lib/utils/admin-date.ts`

#### P0 — Korrekt / Sicher

- **P0-A · Fake-Wachstum in KPI-Subs.** `"+4% zum Vormonat"` (Mitglieder) und `"+12% zum Vormonat"` (Umsatz) sind **hartcodiert**, nicht aus echten Vormonats-Datenpunkten berechnet. Die `buildTrend()`-Funktion füttert mit diesem Wert einen "Ramp", dessen Sparkline so wirkt, als stamme er aus realen historischen Daten. → **Kann den Admin in falsche Sicherheit wiegen** („Mitgliederzahl wächst"), obwohl die Zahl nur der aktuelle Wert ist.
- **P0-B · Type-Safety-Lücken (`any`-Casts).** Drei Stellen in `page.tsx`:
  - `(supabase as any).from('registration_requests')` — untergräbt RLS-Schutz-Compile-Zeit
  - `(club as any).setup_completed_at` — vermeidet jede TS-Hilfe für Felder
  - `(supabase as any)`-Cast moralisch problematisch (siehe CLAUDE.md: `cast as "any"` vermeiden)
- **P0-C · Pluralisierungs-Bug in Smart-Actions.** `${activeSessions} Sessions überprüfen` zeigt bei `activeSessions === 1` den Text `"1 Sessions"`. (In `kpiItems` und `attentionActions` korrekt gelöst — nur diese eine Stelle hat's vergessen.)
- **P0-D · Smart-Action-Karten unterhalb des Fold (visual bestätigt).** `browser-use` Pass 2 hat die Y-Position der „Schnellaktionen"-Section im DOM gemessen: bei 1440×900-Viewport startet sie bei **Y=979,5** — also **~80 px unter dem Fold**. Auf Mobile (390×844) startet sie bei Y=1474, also **~630 px unter dem Fold**. Mobile-User müssen scrollen, um zur Kern-Aktion zu kommen; Desktop-User sehen „Mitglied einladen“ zwei Mal (Hero-CTA + Smart-Action-Karte), aber die zweite Kopie ist leicht versteckt.

#### P1 — UX-Stolperer

- **P1-A · Buchungen-Empty-State ohne CTA.** `<p>Noch keine Buchungen vorhanden.</p>` ohne Aktions-Button oder Link ins `/admin/billing` oder `/admin/courts` zur Erstanlage.
- **P1-B · Status-Mappings inline.** `bookingStatusLabel` + `bookingStatusTone` sind mit ausführlichem Doc-Kommentar in `page.tsx` definiert. Kommentar sagt "Single Source of Truth" — gleichzeitig liegt sie nicht in `lib/types`. → Pflege-Drift-Risiko mit `components/bookings/session-bookings.tsx#getBookingStatusLabel`.
- **P1-C · Loading-States nur auf Page-Ebene.** `dashboard/loading.tsx` deckt das Initial-Render ab; sobald die Daten da sind, gibt es keinen Skeleton für Tabellen-Updates (z.B. via Refresh-Aktion). Activity + Buchungen sind reine Conditional-Renders.
- **P1-D · ScrollReveal-Delays wirken willkürlich.** `0 / 50 / 100 / 200 / 300 ms`. Wenn eine Sektion eingefügt wird, müssen alle Folgeschritte verschoben werden. → Magic-Number-Korrekturvorschlag: `delays.map(i => 80 * i)` oder eigene Konstante.
- **P1-E · Footer-Link `/bookings?tab=manage` nicht in der Nav sichtbar.** Custom-Param `?tab=manage` muss auf der Buchungen-Seite existieren — cross-checken.
- **P1-F · `activityFooterHref` deckt `seasons` nicht ab.** Logik ist `leer → seasons, booking → billing, sonst members`. Eine `seasons`-Aktivität würde `members` als Link liefern. Aktuell harmlos, weil `recentActivity` nur `join` und `booking` erzeugt — aber sobald ein dritter `variant` dazukommt, bricht das hart.
- **P1-G · Redundanter „Mitglied einladen"-CTA.** Premium-Hero-Block oben hat diesen Button UND die Smart-Actions-Karte hat denselben Text/Label/Icon → wirken auf dem Screenshot wie ein Echo.

#### P2 — Polish / Konsistenz

- **P2-A · Datums-Locale-Duplikation.** `premium-admin-hero.tsx` rekonstruiert `todayLabel` inline (`weekday: 'long', day: 'numeric', month: 'long'`), obwohl `lib/utils/admin-date.ts#formatAdminDateLong` exakt das gleiche Format liefert (nur + Jahr). → Helper einsetzen.
- **P2-B · Magic `30` als Onboarding-Schwelle.** `(Date.now() - new Date(setup_completed_at)) / 86400000 < 30` — keine zentrale Konfig. Wert sollte in `lib/config.ts` oder `clubs.features` stehen (z.B. `onboarding_checklist_days`).
- **P2-C · `safe()`-Wrapper fragwürdig.** Jede der 9 Supabase-Queries wird durch `safe(q).catch(() => null-safe-result)` geleitet. Supabase-js wirft im Normalfall nicht — die `catch` fängt nur Netzwerkfehler ab. Falls Fehler verschluckt werden sollen, besser zentral in einem Logger als pro-Query-Helper. Aktuell: redundanter Boilerplate.
- **P2-D · `Record<string, unknown>`-Mapping für Activity.** Daten kommen ohne Typdefinition aus `page.tsx` rein. Implizites Shape → Drift-Risiko. → DTO-Type einführen.
- **P2-E · Sparkline-Layout-Shift.** Wert `0` → `points.length < 2` → kein SVG → kleinere Karte. Sobald ein Wert von 0 auf >0 springt, springen die Karten-Höhen. → Stat-Card-Höhe explizit reservieren.
- **P2-F · Brutale Klassen-Kaskaden in `admin-inbox-banner.tsx`.** `bg-gradient-to-br from-orange-50 via-warning-50 to-background dark:from-orange-900/20 dark:via-warning-900/10 dark:to-card` → in eigene Variablen-Konstanten oder CSS-Vars heben, damit der Dark-Mode-Stack nicht zur copy-paste-Falle wird.
- **P2-G · Kommentare in `page.tsx` extrem lang.** Mehrere 10-Zeilen-Kommentarblöcke (Booking-Status, Activity-Mapping, KPI-Featured). Doc-Signal wäre besser in `lib/admin-dashboard-tokens.ts` aufgehoben.
- **P2-H · Inbox-Banner sehr schmaler „Alles erledigt"-Zustand.** Nur Text + Icon, kein Pill/CTA. Wenn nach „urgent" → „erledigt" gewechselt wird, hat der Block keinen follow-up CTA („Was kann ich noch tun?"), keine Orientierung.

#### Browser-Visual-Audit (Stand: Pass 2 abgeschlossen)

**Pass 1 (struktur-only):** `browser-use` gegen `http://localhost:3000/admin`, gespeichert unter `/tmp/swingz-audit/admin-dashboard/`. Bestätigt: Seite erreichbar (Page-Title `SWINGZ – Premium Tennis Club Management`), Theme-Toggle funktioniert, keine Konsolen-/Navigations-Fehler in dieser ersten Runde. 8 PNG-Screenshots zwischen 73 KB (Mobile) und 173 KB (Desktop, Dark) angelegt.

**Pass 2 (`fullPage`, gezielte Y-Checks):** gespeichert unter `/tmp/swingz-audit/admin-dashboard/pass2/`.

**Bestätigt:**

- **VA-A jetzt als realer P0-Bug bestätigt.** SmartAction-Sektion startet bei Y=979,5 (Desktop 1440×900, Viewport 900 px) → ~80 px unter dem Fold. Mobile (390×844): Y=1474 → ~630 px unter dem Fold. Quellen-Sektionen (Hero + Inbox + KPIs + Buchungen/Aktivität) füllen den Desktop-View bereits vollständig.
- Theme-Toggle setzt korrekt die `dark`-Klasse auf `<html>`.
- Mobile-Scroll-Höhe: 1822 px (mit SmartAction-Sektion bei Y=1474).

**Neu beobachtet — VS-A · Inbox-Banner im aktuellen Test-Verein = `inbox-zero`.** Der `urgent`-Zustand (mit pending Approvals / Bills) wurde nicht gesehen — Verein, mit dem `browser-use` arbeitet, hat aktuell keine offenen Items. → Für vollständigen A/B-Vergleich müsste ein Test-Verein mit `registration_requests.status='pending'` gewählt werden.

**Neu beobachtet — VS-B · Console-Warning von PWA-Install-Prompt.**

```
Banner not shown: beforeinstallpromptevent.preventDefault() called.
The page must call beforeinstallpromptevent.prompt() to show the banner.
```

Vermutlich in `components/pwa-install-prompt.tsx` — `beforeinstallpromptevent` wird mit `preventDefault()` abgefangen, aber `prompt()` wird nie aufgerufen → Install-Banner erscheint nie. Aktuell nur Console-Warning, kein Nutzer-Block — aber **P2**, weil kaputter Bestätigungs-Pfad.

**Noch nicht abschließend geklärt (brauchen erneuten Pass oder User-Auge):**

- Pixel-Kontrast in Buttons/Badges (Orange-Gradienten auf Card-Background) — ohne OCR / Vision-Modell hier nicht beurteilbar.
- Sparkline-Höhen zwischen Light/Dark (Layout-Shift-Hypothese aus P2-E) — visuell im Bild, aber nicht metrisch.
- Doppelte „Mitglied einladen"-CTAs im Hero-Block + in der Smart-Action-Karte — Code-belegt (P1-G), jetzt zusätzlich visuell bestätigt (P0-D).
- Mobile-Paddings / Touch-Target-Größen (CTA-Buttons mind. 44×44 px?).
- Hover-State der Smart-Action-Karte (`08-hover-smartaction.png` existiert, aber kein Diff gegen Idle-State).

**Neue Beobachtungen Pass 3 (urgent-State seeded und capturen):**

- **VS-C · SmartActions-Fold-Bug verschärft sich mit urgent-Inhalt.** Mit 3 urgent-Cards im Inbox-Banner liegt die „Schnellaktionen"-Sektion bei **y=1468 px** (Pass 2, inbox-zero: y=979,5 px → **Delta +488 px**). Bei Viewport-Höhe 900 px sind die Schnellaktionen jetzt **~568 px unter dem Fold**. Konsolen-Fehler im urgent-State: keine (PWA-Warning aus Pass 2 nicht reproduziert — sehr wahrscheinlich einmaliger Lifecycle-Event auf erstem Reload).
- **Korollar (für P0-D-Impact-Analyse):** die Y-Position skaliert ~163 px pro zusätzlicher urgent-Card. Selbst mit nur **einer einzigen** pending-Card bleibt SmartActions ~242 px unter dem Fold — der Bug ist **kein Daten-Edge-Case**, sondern ein Layout-Cross-Cut.

**Nächste Schritte für vollständigen Visual-Audit:**

1. **VS-Folge-2:** PWA-Install-Prompt-Flow manuell durchspielen, prompt() Aufruf verifizieren.
2. **VS-Folge-3:** User-in-the-loop: `pass2/` + `pass3/`-Screenshots in einem Bildbetrachter durchscrollen, Augenmaß auf Kontrast / Mobile-Paddings / Hover-States legen.

**Browser-Visual-Audit Pass 3 (urgent-Inbox-State, läuft gerade):** gespeichert unter `/tmp/swingz-audit/admin-dashboard/pass3/`. Test-State ist geseedet (siehe Erledigt-Block unten). Ziel: Bestätigung, dass der urgent-Banner visuell sauber rendert + Fold-Position jetzt sogar noch tiefer liegt (mehr Cards im Inbox-Bereich).

#### Erledigt

- [x] Code-Audit Pass 1 (`/admin` Dashboard): 4× P0 — A Fake-Wachstum, B any-Casts, C Plural-Bug, D SmartActions-Fold — 7× P1, 8× P2.
- [x] Visual-Audit Pass 1 (struktur-only) + Pass 2 (`fullPage`, Fold-Check, Theme-Toggle): VA-A real bestätigt, VS-A `inbox-zero` beobachtet, **VS-B PWA-Console-Bug** neu dokumentiert.
- [x] Test-State für urgent-Inbox vorbereitet: `scripts/seed-pending-approvals.ts` angelegt, 3 pending registration_requests in TC-Rheinland-DB eingefügt, State per `--check` und raw-Query verifiziert.
- [x] Code-Reviewer für Dev-Helper: 4 Polish-Hinweise (Slug-Lookup, `??`, `wants_trial_training: null`, `upsert`-Refactor) — für späteren Sprint eingeplant.

**Aktueller Stand:** alle 4 P0 + P1-G + `safe<T>`-Generic + nested-`Promise.all`-Split implementiert, Typecheck grün, Browser visual Pass 4 bestätigt (P0-D + P1-G, P0-A rechnerisch korrekt). Pass 5 (Badge-Auto-Refresh) bestätigt.

---

# Sidebar — Anfragen-Badge (Cross-Component-Bug, gefunden nach /admin-Fixes)

**Audit-Datum:** 2026-07-04
**Trigger:** User-Reports „rote Punkt in der Navbar aktualisiert sich nicht".
**Quell-Dateien:** `components/layout/sidebar.tsx`, `app/api/admin/approvals/count/route.ts`, `scripts/seed-pending-approvals.ts`

#### Befund

- **SB-A · Stale-Client-Cache im Approvals-Badge.** Sidebar-Componente holt den Count einmal on-mount und rendert ihn statisch. War die Seite offen, während 3 Pendings auf 2 reduziert wurden, blieb der rote Punkt weiter auf „3" bestehen — bis der nächste Full-Reload passierte. Dashboard-KPI ist SSR, daher immer aktuell → der Konflikt fiel erst auf, als jemand die Diskrepanz im Browser sah.

**Root-Cause (DB-verifiziert):**

| Abfrage                                         | Wert |
| ----------------------------------------------- | ---- |
| Total pending, alle Clubs                       | 2    |
| TC-Rheinland pending (mit `club_id`-Filter)     | 2    |
| Pending mit `club_id IS NULL`                   | 0    |
| Audit-Hilfs-Pendings (`audit.*@example.de`)     | 2    |
| Audit-Hilfs-Pendings gefiltert auf TC-Rheinland | 2    |

→ DB-State korrekt, **Script** setzt `club_id` richtig, **API-Route** filtert richtig. Der einzige Bug war der fehlende Refresh-Mechanismus im Sidebar-Cliente.

**Fix (in `components/layout/sidebar.tsx`):**

1. **45-Sekunden-Polling** auf den Count (`setInterval` mit sauberem Cleanup)
2. **`visibilitychange`-Refetch** wenn der Tab wieder sichtbar wird (z. B. User wechselt zurück aus einem anderen Tab oder über das Handy nach Hause)
3. **Pathname-Dependency** → jeder Routenwechsel triggert einen Refetch (User flow: `/admin/members?tab=approvals` Approve-Klick → Back to `/admin` → Badge zeigt aktuellen Stand)
4. **Request-Generation-Guard `{ current: 0 }`** im Closure: back-to-back-Fetches (Interval feuert während vorheriger Fetch noch pendet) dürfen nicht in verkehrter Reihenfolge den State überschreiben. Nur die jüngste Antwort darf `setApprovalCount` aufrufen.
5. **Type-Guard** im Setstate: `typeof data?.count === 'number' && Number.isFinite(data.count)` — Malformed Responses (z. B. `{ error: 403 }`) clearen den Badge nicht versehentlich auf 0.

#### Lessons Learned (Cross-Component-Audit-Generalisierung)

| Symptom                                | Typischer Root-Cause-Ort                        | Audit-Hinweis                            |
| -------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| „Page zeigt X, Navbar/Sidebar zeigt Y" | Client-Cache vs. SSR — Re-Check on demand fehlt | Suche `useEffect` mit Single-Fetch fehlt |
| Badge bleibt nach Mutation hängen      | Kein Polling, keine Realtime, kein Focus-Event  | Sidebar/Header/Notification-Subs prüfen  |
| „Stale UI"-Bugs generell               | Re-Fetch-Trigger-Definition pro Komponente      | Mapping „wann darf das stale sein“       |

#### Erledigt

- [x] `components/layout/sidebar.tsx`: Polling + Visibility-Refetch + Pathname-Dependency + Generation-Guard + Type-Guard implementiert
- [x] Typecheck: 0 Errors projektweit
- [x] Code-Reviewer: OK TO MERGE (folgt mit optionalem `data.count >= 0`-Tightening für paranoidere Server-Bugs)
- [x] Browser-Audit Pass 5: Initial=2 ✓, Reload=2 ✓, Route-Roundtrip=2 ✓, **Approve-Click → 1 ✓** (Badge reduziert sich auf 1 nach Approve → Back to Dashboard, ohne Full-Reload)
- [x] DB-State für Reproduzierbarkeit: `scripts/seed-pending-approvals.ts` setzt `club_id` korrekt; Audit-Helper ergänzt im Erledigt-Block oben.
