# Offene Punkte & nächste Schritte

> Zuletzt verifiziert: 11. Oktober 2026 (Abrechnungs-Tabs mobil in Produktion abgenommen, Sentry `JAVASCRIPT-NEXTJS-Z` geschlossen); 6. Oktober 2026 (DB-Passwort rotiert); 5. Oktober 2026 (Trainer in mehreren Vereinen: Vereinsprüfung gegen alle Mitgliedschaften; Missbrauchsprüfung Rechteausweitung in Produktion ohne Befund; Hydration-Fehler `/login` als Fremdprojekt erkannt; Service-Client aus allen API-Routen; Rechteausweitung über eigene Mitgliedschaft gefunden); 4. Oktober 2026 (Stripe-Retry-Idempotenz geschlossen; Drizzle aus der App entfernt; Pooler-TLS; Stripe-Webhook-Abnahme); 3. Oktober 2026 (P1: Architektur-Gate und Integrationstests in CI; Stripe Connect nachgetragen); davor 2. Oktober 2026 (alle Punkte gegen Code, CI/GitHub, `/api/health` in
> Produktion und lokale DB geprüft; Erledigtes gestrichen — die gestrichenen Punkte stehen in der
> Git-Historie dieser Datei). Produktions-DB nicht direkt abgefragt; wo ein Befund nur lokal
> belegt ist, steht das dabei.
>
> Lebendes Dokument. Bündelt **alle dokumentierten, aber noch nicht umgesetzten** Altlasten und
> ToDos. Wer einen Punkt umsetzt, streicht ihn hier; wer einen neuen offenen Punkt findet, trägt
> ihn ein. Kein Parallel-Dokument danebenlegen (siehe `AGENTS.md`).

## So ist dieses Dokument zu lesen

- **P0** — blockiert Betrieb, Verkauf oder Sicherheit. Zuerst anpacken.
- **P1** — wichtig (Korrektheit, Datenschutz, Datenhygiene).
- **P2** — Politur, Ehrlichkeit der Oberfläche, Struktur.
- **P3** — Kleinigkeiten.
- **Produkt-Roadmap** — zurückgestellte Features/Tickets, niedrige Priorität.

Quellen: Archiv-Snapshots (`docs/ARCHIV/`), `docs/DATABASE.md`, `docs/EMAIL_SETUP.md` sowie das
**eingefrorene** Ticket-System `docs/tickets/` (Stand Juni 2026, wird nicht mehr gepflegt).

---

## Vor dem Launch — zwingend zurückdrehen

### nuLiga: Widget statt Abruf — Rechtsklärung offen

Der Scraper ist seit 20.09.2026 entfernt (AGB von tennis.de). Ersatz: das zum Einbetten
freigegebene Mannschaftswidget (`components/tennisde-widget.tsx`) und der manuelle CSV-Import.
Offen: beim tennis.de Service-Center klären, ob das Widget in einer SaaS (statt auf der
Vereinshomepage) erlaubt ist und wie es mit dem PREMIUM-Werbebanner steht.
`league_players` wird nicht mehr befüllt (lokal 0 Zeilen, Stand 02.10.), wird aber noch von
`leagues/[id]/roster`, `member/leagues` (+ `claim`) und dem Mitglieder-Dashboard gelesen.
**Entschieden 02.10.2026: Kader werden manuell gepflegt** → Pflegeoberfläche für Admins fehlt
noch (siehe P2).

### Testdaten sind freigegeben (01.10.2026)

Alle Daten gelten als Testdaten; Agenten dürfen sie bei Bedarf bearbeiten, auch in der
`user`-Lane (`AGENTS.md` § Testdaten 0). **Vor dem Launch:** Freigabe streichen, die
`user`-Lane wieder auf „nur lesen" setzen und Produktionsdaten von Testdaten trennen.

### Automatische Auslieferung und Auto-Migration

`deploy.yml` deployt jeden grünen Push auf `main` nach Produktion; `AUTO_MIGRATE=true` ist als
Repo-Variable gesetzt (seit 19.09.2026), die Migrationen laufen also ohne Rückfrage. Für die
Entwicklungsphase gewollt. **Vor dem Launch:** `gh variable delete AUTO_MIGRATE` (Migrationen
wieder von Hand nach Sichtung mit `pnpm db:status:prod`) und entscheiden, ob Pull Requests mit
Freigabe wieder Pflicht werden.

### Pflicht-Abo für Neukonten

Neukonten starten im Freemium-Default. **Entschieden 02.10.2026:** erst zum Launch umsetzen,
zusammen mit dem Scharfschalten der Bezahlschranke.
→ Quelle: `docs/tickets/roadmap/TICKET-mandatory-subscription-onboarding.md`.

### Stripe Connect: Ende-zu-Ende-Abnahme offen (Stand 03.10.2026)

**Erledigt:** Code (ADR-008), Kontoanlage über Accounts v2 (Stripe lehnt v1 für neue Plattformen
ab), Connect im Sandbox-Konto aktiv, Connect-Webhook `we_1UMN3sCyfxebfhruEE1aJzSL` und
`STRIPE_CONNECT_WEBHOOK_SECRET` in Vercel Production. Lokal belegt: Admin Claude Sandbox Alpha →
Abrechnung → Online-Zahlung → Stripe-Konto `acct_1UMOPHCyfxdYrXvR` angelegt, in
`club_stripe_accounts` gespeichert (lokale DB), Weiterleitung zur Stripe-Einrichtung.

**Offen:**

1. **Stripe-Einrichtung für `acct_1UMOPHCyfxdYrXvR` abschließen** — nur durch den Menschen: Stripe
   verlangt dort ein neues Stripe-Login mit Passwort (Konto hat volles Dashboard), das legt kein
   Agent an. Testwerte: Code `000000`, IBAN `DE89370400440532013000`. Frischen Link holt
   „Einrichtung fortsetzen“ im Tab (Stripe-Links gelten nur einmal).
2. Danach lokal mit `stripe listen` (Befehl in `docs/STRIPE_SETUP.md`) prüfen: `account.updated`
   setzt `charges_enabled`, Tab zeigt „Aktiv“; als Alpha-Mitglied eine Rechnung mit Karte
   `4242 4242 4242 4242` und einmal per SEPA bezahlen; Rechnung wird bezahlt markiert;
   Plattformgebühr 0,5 % erscheint im Sandbox-Dashboard unter „Erhobene Gebühren“.
3. **Erster Klick auf „Online-Zahlung einrichten“ / „Einrichtung fortsetzen“ blieb zweimal ohne
   Wirkung**, erst der zweite löste den POST aus (lokal, Dev-Modus). Prüfen, ob das nur die
   Erst-Kompilierung war oder auch in Produktion auftritt.
4. Beim Wechsel auf Live-Schlüssel den Connect-Webhook im Live-Modus neu anlegen und dessen
   Secret in Vercel setzen.
5. Transaktionsgebühr (0,5 %) in AGB/Preisliste aufnehmen.

### Bezahlschranke ist abgeschaltet

`SUBSCRIPTION_ENFORCEMENT=off` ist gesetzt (lokal und in Vercel Production).
Solange das gilt, gibt `getSubscriptionState()` für **jeden** Nutzer `ok` zurück:
jeder Verein hat vollen Zugriff ohne Abo, der Mahnfall greift nicht, und die
API-Sperre in `lib/api-auth.ts` läuft leer.

**Warum:** Die Testvereine sollen bis zum offiziellen Launch benutzbar sein,
ohne dass für sie echtes Geld bewegt wird. Ohne die Abschaltung zeigt jede
Seite unter `app/(protected)/admin/(gated)/` nur die Bezahlschranke.

**Zurückdrehen — zwei Schritte, sonst nichts:**

```bash
# 1. lokal
sed -i '/^SUBSCRIPTION_ENFORCEMENT=/d' .env.local

# 2. Produktion
vercel env rm SUBSCRIPTION_ENFORCEMENT production
vercel --prod            # Git-Deploys sind abgeschaltet (vercel.json)
```

Danach prüfen: ein Konto ohne Abo (`users.subscription_tier = 'free'`) muss auf
`/admin/members` die Bezahlschranke sehen.

**Warum das nicht vergessen werden kann:**

| Sicherung                | Wirkung                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Vorgabe ist **scharf**   | Nur exakt `off` schaltet ab. Variable weg = Schranke da. Vergessen führt nicht zu verschenktem Umsatz.     |
| Warnung im Log           | `[subscription-gate] SUBSCRIPTION_ENFORCEMENT=off …`, einmal je Prozess                                    |
| Leiste in der Oberfläche | `SubscriptionDisabledBanner` steht auf **jeder** Admin- und Superadmin-Seite, solange der Schalter aus ist |
| Test                     | `subscription-gate.test.ts` prüft, dass die Vorgabe scharf ist und kein anderer Wert abschaltet            |

Code: `lib/subscription-gate.ts` (`isSubscriptionEnforced`), `lib/env.ts`,
`components/billing/subscription-disabled-banner.tsx`.

---

## P0 — Blocker

### Rechteausweitung per PostgREST — geschlossen und geprüft 05.10.2026

Vier Lücken (eigene Mitgliedschaft/Abo-Spalten, Shop-Bestellungen, Turnier-/Event-Anmeldungen und
Check-ins, Vereinszeile/Superadmin-Bypass — Details `docs/DATABASE.md`), Migrationen
`20261005100000`–`20261005140000` am 05.10.2026 in Produktion angewendet (Deploy-Lauf `37325387689`).
Missbrauchsprüfung in Produktion (`scripts/prod-read.sh`, 05.10.2026): kein Hinweis. Alle 14
privilegierten Mitgliedschaften sind Seed-Konten (letzte am 31.08.), keine Mitgliedschaft seit
14 Tagen, kein Admin in mehreren Vereinen; Abo-Tarife ≠ `free` nur bei den drei Seed-Admins der
Agent-Lane; `shop_orders`, Turnier-/Event-Anmeldungen und Check-ins leer; keine Vereinszeile
gelöscht, letzte Änderungen am 27.09. (drei Sandboxen in einer Anweisung, TC Rheinland nach Login
des eigenen Admins von der Entwickler-IP laut `audit_logs`).

### Service-Client in API-Routen — erledigt 05.10.2026

Keine Route unter `app/api/` importiert mehr `createServiceClient`. Wo RLS reicht, läuft der
Zugriff über `auth.supabase`/`getUserDb`; bewusste Umgehungen (Cron, Webhook, öffentliche
Formulare, Owner, Benachrichtigungen, Mitglieder-Sicht auf Trainer/Mitglieder, Storage,
`auth.admin`) über `systemDb(reason)` mit expliziter Vereinsprüfung. Dabei geschlossen
(vereinsübergreifend, lokal mit Alpha-Admin gegen Gamma belegt bzw. am Code nachvollzogen):
Beschlüsse ändern/absagen, Trainer-Notizen lesen, Trainingswünsche lesen/schreiben,
Fehlzeiten-Benachrichtigung, Probetraining umwandeln, Familienkonto austragen,
Monatsübersicht Abrechnung, Platzsperre/Ad-hoc-Einheit anlegen, Buchung reaktivieren,
offenes Match anlegen/beitreten; Superadmin-Bypass in Saisonplanung (Mitgliederliste,
Stundenplan kopieren), Session-Absage, Kündigung, Stripe-Sync; `/api/backup` nur Owner;
`/api/admin/billing/subscriptions` (Admin konnte sich selbst ein Abo geben) gelöscht.
Architektur-Baseline 113 → 26 Einträge. `test:tenant`: keine Fremdzeile in GET-Routen.

Offen dazu:

- 15 Server-Seiten (Owner-Seiten, `admin/(gated)/members|courts|work-duties`, Abo-Seiten,
  `(protected)/layout.tsx`, `status`) nutzen den Service-Client direkt — Liste in
  `.dependency-cruiser-known-violations.json`.
- ADR-005-Schichtung (Route → Service → Repository) fehlt in den umgestellten Routen weiterhin;
  die Umstellung hat die RLS-Lücke geschlossen, nicht die Struktur vereinheitlicht.
- `test:tenant` ist lokal rot ohne Wallet-Konfiguration (`/api/wallet/*` → 503 zählt als
  „nicht erreichbar"). Der Fremdzeilen-Check selbst ist grün.
- „Eigene Zeile"-Schreib-Policies erledigt 05.10.2026 (`shop_orders`, `qr_checkins`,
  `special_event_registrations`, `tournament_registrations`; in Produktion angewendet).
  Globales `is_superadmin()` ebenso erledigt (`background_jobs`, `job_execution_log`, `players`,
  `school_holidays`; `clubs_insert` bleibt gewollt), dabei `clubs_access` gefunden und geschlossen.

### Pooler: Klartext abweisen (optional, strenger)

Passwort am 06.10.2026 rotiert (`docs/DATABASE.md`). Supavisor nimmt auf Port 6543 weiterhin
Klartext an; wer das ausschließen will, öffnet 6543 nur noch per SSH-Tunnel.

### Stripe: Webhook abgenommen (Testmodus, 04.10.2026), Live-Umstellung offen

Abgenommen in Produktion mit selbst signierten Ereignissen (Webhook-Secret aus
`.env.prod.local`) gegen eine Rechnung in Claude Sandbox Alpha: ungültige Signatur → 400, Handler-
Fehler → 500 mit freigegebener Reservierung und erneuter Verarbeitung, doppelte Zustellung →
`deduplicated`, zweites Ereignis zur selben Zahlung bucht nichts, genau eine Zahlung, Rechnung
`paid`, verspätetes `payment_failed` ändert nichts. `EXECUTE` auf `check_and_record_stripe_event`
und `process_shop_order_payment` live nur `service_role`. Ein Fehler _nach_ dem ersten
Schreibschritt ist nur per Unit-Test belegt (in Produktion nicht gezielt auslösbar).
Offen: Lokal und in `.env.prod.local` stehen Test-Keys; beim Wechsel auf Live-Keys die
Webhook-Endpunkte (Plattform und Connect) im Live-Modus anlegen und einmal echt abnehmen.

### Sentry: offen nur die gewollte Bezahlschranken-Warnung (03.10.2026)

Alle Issues der letzten 7 Tage behoben oder als erledigt geschlossen, Ursachen in den Commits vom
03.10.2026. Offen bleibt bewusst `JAVASCRIPT-NEXTJS-3` (Bezahlschranke abgeschaltet) — verschwindet
mit dem Scharfschalten vor dem Launch. Basiszinssatz: nächster Satz zum 01.01.2027 über
`/api/cron/refresh-base-rates` eintragen (Aufruf mit `CRON_SECRET` aus `.env.prod.local`; am
03.10.2026 neu gesetzt, weil der Vercel-Wert als vertraulich nicht auslesbar war).

### Abnahmen ausgelieferter Änderungen (Stand 05.10.2026)

Erledigt am 04./05.10.2026 in Produktion:

- **Abrechnungs-Tabs mobil (11.10.2026):** `/admin/billing` bei 390 px Inhaltsbreite — Tab-Leiste
  (6 Tabs) und Rechnungstabelle (`min-w-[900px]`) scrollen je in eigenem `overflow-x-auto`-Container
  mit sichtbarer Leiste, die Seite selbst scrollt nicht seitlich.

- **Sentry:** Server-Fehler kommen an (Gebühren-500er, Gruppenroute), Alarmregel `627221`
  („high priority issues“, E-Mail an Issue-Owner/aktive Mitglieder) hat am 04.10. 18:19 UTC
  ausgelöst. Client-Erfassung ist konfiguriert (`NEXT_PUBLIC_SENTRY_DSN` in Vercel), aber noch
  durch kein Browser-Ereignis belegt — der am 04.10. dafür gezählte Hydration-Fehler `/login`
  (`JAVASCRIPT-NEXTJS-0U-3`) stammt aus dem Sentry-Projekt `javascript-nextjs-0u` (tsowx
  Rechnungsportal, localhost:3005), nicht aus SwingZ.
- **E-Mail:** App-Versand aus Vercel belegt (drei Mails mit Resend-IDs im Log, Empfänger
  `delivered@resend.dev`); Supabase-Auth über SMTP vom VPS belegt (Passwort-Reset Status 200).
- **UX:** Landing-CTAs heißen überall „Zugang anfragen“ (Footer und fünf Rechtsseiten
  nachgezogen); Anfrageformular zeigt bei Netzwerkfehler die deutsche Meldung als `role="alert"`
  und gibt den Button wieder frei.

Offen:

- Vier weitere direkte `resend.emails.send`-Aufrufe in Webhook/Rechnungsversand prüfen das
  Ergebnis inzwischen selbst; neue Aufrufe nur noch über `src/infrastructure/email/email.service.ts`.

---

## P1 — Wichtig

Derzeit nichts offen. Verwaiste Session-Einheiten am 05.10.2026 in Produktion geprüft: keine
Geister (einziger Treffer `walk_in` mit Buchung, TC Rheinland).

---

## P2 — Politur & Ehrlichkeit der Oberfläche

- **Matchday-Redesign:** technisch abgeschlossen (30.09.2026,
  [Abschlussbericht](ARCHIV/2026-09-30-matchday-redesign-abschluss.md)). Offen: vollständiger
  Seiten-/Rechtetestlauf (wegen lokaler Serverneustarts abgebrochen), Screenreader-Abnahme und
  Kernaufgaben mit echten Vereinsnutzern als Teil der Verkaufsreifeprüfung.
- **UI-Einheitlichkeit, Restbestand:** die 28 `CenteredModal`-Stellen werden nur beim Anfassen auf
  `Dialog` gezogen (Ratsche sinkt); Owner-Dashboard ohne `QuickActions`. Regel: `docs/DESIGN.md` § 6a.
- **Dependency-Audit:** 3 moderate unter der Gate-Schwelle (`csv-parse` bräuchte Major 6→7,
  eigener Vorgang); node-forge-Advisory ohne Patch bewusst ausgenommen (Commit `084a3066`) —
  bei verfügbarem Patch Ausnahme entfernen.
- **Mannschaftskader manuell pflegen** (Entscheidung 02.10.2026): Admin-Oberfläche zum Anlegen,
  Bearbeiten und CSV-Import von `league_players` je Mannschaft. Bis dahin bleiben Kader und
  „Meine Mannschaften" leer.

---

## P3 — Kleinigkeiten

- `tests/e2e/all-pages-render.spec.ts` prüft `/member/preferences` nur gegen einen
  Überschriften-Regex — belegt keine Funktion.

---

## Produkt-Roadmap (zurückgestellt, niedrige Priorität)

Eingefrorenes Ticket-System `docs/tickets/` (Stand Juni 2026) — offene Feature-/Strategie-Tickets,
die bewusst nicht im Kernweg liegen:

- DATEV-CSV-Export (F1), Übungsleiterpauschale (F2), Turnier-Auslosung (F5), SMS/WhatsApp (F8),
  Wallet-Pass (F10), echte Job-Queue/BullMQ (F11), Churn-Prediction (F12).
- DSGVO-Read-Audit-Trail (A4/B8), Pen-Test vor Q2-Auslieferung (B9), Decisions/Voting
  Sichtbarkeits-Boost (B7).
- Pay-per-Active-Member-Pricing (3.6.1–3.6.3), Smart-Court-Premium-Pricing (3.1.4).
- Spikes: React-19-Migration, Tailwind-4-Migration (`docs/tickets/SPIKE-*.md`).

---

## Bewusst offen gelassen (Entscheidungen, kein Bug)

- Trainer/Mitglieder wechseln den Verein nicht — immer genau ein Vereinskontext (in
  `docs/BUSINESS_RULES.md` festgehalten).
- `background_jobs`, `base_interest_rates`, `school_holidays` bleiben unscoped
  (plattformweite Konzepte ohne Vereinsbezug).
- Kein automatisches „Undo" einer Abmeldung — überbuchungsfrei nur als eigener Vorgang denkbar.
- Mitglieder lesen alle Buchungen ihres Vereins (`Users can view their own bookings`, u. a.
  RSVP-Teilnehmerliste) — so gewollt, entschieden 02.10.2026.
- `ops_heartbeats` hat RLS (FORCE) ohne Policy: Zugriff ausschließlich per Service-Client
  (VPS-Skripte schreiben, `/api/health` liest) — gewollt.
