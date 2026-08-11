# Phase 3 (Fläche verengen) + Phase 4 (Kern polieren) — Umsetzungsbericht

> Stand: 27. Juli 2026
> Bezug: [`2026-07-26-produktaudit-verkaufsreife.md`](2026-07-26-produktaudit-verkaufsreife.md) (Original-Audit, unverändert), [`2026-07-26-produktaudit-phase1-umsetzung.md`](2026-07-26-produktaudit-phase1-umsetzung.md), [`2026-07-26-produktaudit-phase3-umsetzung.md`](2026-07-26-produktaudit-phase3-umsetzung.md) (dort: P3/Abo-Gate — trotz Dateiname eigentlich Phase 2 des Original-Audits)
> Kategorie: Archiv-Snapshot (nach `AGENTS.md` §1) — dokumentiert, was in dieser Session tatsächlich umgesetzt wurde.

---

## Was erledigt ist

### F-9 — Debug-Route + naked fetch()

- `app/api/debug/auth/route.ts` gelöscht (toter Debug-Code, Prod-Guard war vorhanden aber irrelevant).
- 6 Client-Komponenten von `fetch()` auf `apiFetch()` umgestellt: `gamification-dashboard.tsx`, `reports-dashboard.tsx`, `customizable-dashboard.tsx`, `app/register/page.tsx`, `app/join/[clubId]/page.tsx`, `app/(protected)/shop/success/page.tsx`. Nebenbei manuelle `Content-Type`-Header entfernt, wo `apiFetch` sie automatisch setzt.

### F-3 — console.\* → createLogger, ESLint no-console

- 163 `console.*`-Aufrufe in 68 Produktivdateien (ohne `lib/logger.ts` selbst, das legitim `console` als Sink nutzt) per Codemod auf `createLogger('<modul>').*` umgestellt — reine Namensersetzung, da `log.info/warn/error/debug` dieselbe `(message, data?)`-Signatur wie `console.*` akzeptiert.
- 2 multi-arg `log.warn(...)`-Aufrufe (Rounding-Drift-Log in `season-billing.service.ts`), die der Codemod nicht sauber auflösen konnte, manuell auf ein `data`-Objekt umgestellt.
- 2 bare `.catch(console.error)`-Referenzen (`booking.use-cases.ts`) manuell auf `log.error(...)` umgestellt — der Codemod erkennt nur Aufrufe (`console.error(`), keine Funktionsreferenzen.
- **Nicht umgesetzt:** `no-console: 'error'` in `eslint.config.mjs`. Ein `config-protection`-Hook blockiert jede Änderung an dieser Datei kategorisch ("Fix the source code... not allowed"), auch verschärfende. Der Code-Teil ist vollständig fertig; nur die Lint-Regel selbst fehlt. Zum Aktivieren: Hook temporär deaktivieren oder die Regel manuell setzen.

### P4 — Nebenfunktionen per Feature-Flag einfrieren

- `lib/features.ts`: 5 neue optionale Feature-Keys ergänzt (Default aus, wie alle optionalen Features): `gamification`, `wallet_passes`, `family_accounts`, `zapier_integration`, `decisions`.
- Server-seitige Gates (Muster: `getClubFeatures()` + `featureDisabledResponse()`, identisch zum bestehenden `ai_analysis`-Gate) ergänzt in: `GET /api/gamification`, `GET+POST /api/decisions`, `GET+POST+PUT /api/family-accounts`, `GET+POST /api/admin/family-accounts`, `GET /api/wallet/pass`, `GET /api/wallet/google-pass`.
- Sidebar/Navigation: `/gamification` und `/decisions` in `lib/navigation.ts` hinter `hidden.has(...)` versteckt (vorher unbedingt sichtbar); `FamilySwitcher` in `components/layout/sidebar.tsx` zusätzlich hinter `family_accounts`-Flag.
- `/design-preview` und `/api-docs` (Swagger-UI): `notFound()` in Produktion, analog zum bereits gelobten Debug-Route-Muster. Die eigentliche Swagger-Spec (`/api/docs`) war serverseitig bereits korrekt auf `admin`/`superadmin` beschränkt.
- **Bewusst nicht angefasst:** `zapier`-Webhook (`app/api/webhooks/zapier/route.ts`) — Inbound-Webhook ohne Club-User-Session, Signaturprüfung bereits vorhanden; Feature-Gate würde Payload-Parsing zur Club-Auflösung brauchen, aus Zeitgründen zurückgestellt. Command-Palette (`paletteNavItems()` in `lib/navigation.ts`) zeigt `/gamification` weiterhin ungefiltert — Sidebar ist laut `nav-module-gating-audit-2026-07-21` der eigentliche Nav-Surface, Palette ist Nice-to-have. Bereits bestehende Flags `shop`/`ai_matchmaking` haben weiterhin keine durchgängige Server-Gate-Abdeckung (z. B. Produktliste) — vorbestehende Lücke, nicht Teil dieses Audits.

### F-6 — Statische Seiten statisch rendern

**Ursache gefunden statt 115 Einzelfixes:** `app/layout.tsx` (Root-Layout) rief `cookies()` ausschließlich auf, um `<html lang>` aus einem `NEXT_LOCALE`-Cookie zu setzen. Da praktisch jede Next.js-Seite durch das Root-Layout gerendert wird, zwingt ein einziger `cookies()`-Aufruf dort den **gesamten** Seitenbaum in dynamisches Rendering — das erklärt den Befund "alle 115 Seiten sind ƒ" vollständig. Die clientseitige `next-intl`-Locale-Auflösung in `app/providers.tsx:22` liest denselben Cookie bereits per `document.cookie` — der serverseitige Read war rein redundant (nur für das `lang`-Attribut).

**Fix:** `cookies()`-Aufruf entfernt, `lang="de"` hartkodiert (konsistent mit `CLAUDE.md`: i18n vorhanden aber inaktiv, UI ist Deutsch-only). Nach dem Fix: `next build` zeigt 16 statische Seiten statt vorher 1 (`/sitemap.xml`), darunter alle im Audit genannten (`/landing`, `/impressum`, `/datenschutz`, `/terms`, `/about`) plus weitere (`/login`, `/register`, `/contact`, `/design-preview`, `/demo`, `/support`, `/avv`, `/sepa-mandate`, `/offline`, `/forgot-password`, `/reset-password`). Alle authentifizierten `(protected)`-Seiten bleiben korrekt dynamisch (`requireAuth()` liest Session-Cookies — das ist legitim dynamisch).

### F-2 — Zod-Validierung auf Kern-Routes (Teilumsetzung)

Zwei Kern-Routes hatten bereits passende Zod-Schemas in `lib/validation-schemas.ts`, die aber **nie verwendet wurden** (`CreateBookingSchema`, `CreateHoursLogSchema`) — und waren zudem veraltet (Feldnamen stimmten nicht mit dem tatsächlichen Request-Body überein). Beide Schemas korrigiert und verdrahtet:

- `POST /api/bookings` — manuelle `if (!sessionId || !clubId)`-Prüfung durch `validateRequestBody(CreateBookingSchema, body)` ersetzt. Schema korrigiert: `clubId` ergänzt (fehlte komplett), `memberId` optional statt required, `notes`-Feld entfernt (wurde nie gelesen).
- `POST /api/hours-logs` — Schema komplett neu an den tatsächlichen Body angepasst (`date/startTime/endTime/type/sessionId/notes` statt der alten, nie genutzten `trainerId/hours/activityType`-Felder) und verdrahtet.

**Nicht umgesetzt, bewusst zurückgestellt:** `PATCH /api/members/[id]` — 20+ lose typisierte Felder (u. a. verschachteltes `address` im bestehenden `CreateMemberSchema` vs. flaches `address`/`city`/`postalCode` im tatsächlichen Body, fehlende Enum-Werte für `role`/`membershipStatus`). Ein blindes Wiring hätte hier ein reales Regressionsrisiko gehabt statt eines sauberen Gewinns — sauber lösen braucht Recherche der gültigen Enum-Werte, die in dieser Session nicht mehr passte. Die übrigen ~37 der ~40 Kern-Routes sind unverändert unvalidiert. Audit-Empfehlung bleibt gültig: bei jeder Berührung nachziehen, kein Großprojekt.

### F-7 — Kalender-Komponente aufteilen

**Nicht begonnen.** `components/unified-court-calendar.tsx` (2.784 Zeilen) — vom Audit selbst auf 2–3 Tage geschätzt; in dieser bereits sehr langen Session nicht mehr seriös zu leisten, ohne ein hohes Regressionsrisiko in der meistgenutzten Mitglieder-Komponente einzugehen. Eigene Session empfohlen.

---

## Verifiziert

- `npx tsc --noEmit` → 0 Fehler
- `npx vitest run` → 481/481 Test-Suiten grün, 1453/1453 Tests grün (2 Regressionen durch diese Session verursacht und gefixt: `phase2-5-routes.test.ts` fehlte ein `clubs`-Feature-Mock für das neue Gamification-Gate; `season-billing-rpc.test.ts` spionierte auf `console.warn`, aber `createLogger()` routet unter dem global konfigurierten `jsdom`-Testenvironment über `console.log`, nicht `console.warn` — Spy-Ziel korrigiert)
- `npx next build` → Exit 0, 16 statische Seiten statt 1

---

## Was noch offen ist (unverändert aus dem Original-Audit oder aus Phase 1/2)

- P1.1 (`FORCE ROW LEVEL SECURITY` + eigene DB-Rolle), P2 (TLS auf Supavisor) — brauchen VPS-Zugriff, siehe Phase-1-Bericht.
- P3.2 (Pflicht-Abo für Neukonten) — braucht fachliche Entscheidungen, siehe `docs/tickets/roadmap/TICKET-mandatory-subscription-onboarding.md`.
- P5 (RLS-Policy-Konsolidierung) — braucht Live-`pg_policies`-Abfrage.
- F-2 Rest (~37 Kern-Routes), F-7 (Kalender-Split), F-3-Lint-Regel (durch Config-Protection-Hook blockiert).
