# Offene Punkte & nächste Schritte

> Zuletzt verifiziert: 5. Oktober 2026 (Hydration-Fehler `/login` als Fremdprojekt erkannt); 4. Oktober 2026 (Stripe-Retry-Idempotenz geschlossen; Drizzle aus der App entfernt; Pooler-TLS; Stripe-Webhook-Abnahme); 3. Oktober 2026 (P1: Architektur-Gate und Integrationstests in CI; Stripe Connect nachgetragen); davor 2. Oktober 2026 (alle Punkte gegen Code, CI/GitHub, `/api/health` in
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
vercel --prod            # Git-Deploy ist auf dem Hobby-Plan BLOCKED
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

### Service-Client-Bypass in API-Routen

`createServiceClient()` umgeht RLS. Genau dieser Pfad war laut ADR-005 Ursache der zwei
Datenlecks im Juli. Stand 04.10.2026: **Drizzle ist aus der App entfernt** (letzte 5 Routen,
3 öffentliche Seiten, `trainer-record`, Gebührenkategorien migriert; `db.ts` gelöscht).
05.10.2026: 25 Whitelist-Routen (Cron, Stripe-Webhook, Health, öffentliche Formulare, Auth vor
Login, Owner, Konto-Löschung) laufen über `systemDb(reason)`; dabei `/api/backup` von Admin auf
Owner verschärft (Backups enthalten alle Vereine). Offen: **62 Routen** unter `app/api/`
importieren noch `createServiceClient` →
**Fix:** Domäne für Domäne nach ADR-005 migrieren, Whitelist-Fälle über `systemDb(reason)`.
→ Quelle: `docs/ARCHIV/2026-09-16-adr-005-migrationsfortschritt-befund.md`.

### DB-Passwort rotieren (Folge des unverschlüsselten Pooler-Transports)

Seit 04.10.2026 spricht der Pooler TLS, alle bekannten Clients verlangen es (`docs/DATABASE.md`).
Bis dahin gingen die Superuser-Credentials monatelang im Klartext übers Internet (Migrationen vom
GitHub-Runner und von der Dev-Maschine). → Passwort von `postgres`/Tenant `swingz` wechseln —
hängt am ganzen Supabase-Stack (`POSTGRES_PASSWORD`), dazu `DATABASE_URL_PROD`, `.env.prod.local`,
Vercel `DATABASE_URL` (App nutzt sie nicht mehr; Variable dann löschen). Strenger zusätzlich:
Port 6543 nur noch per SSH-Tunnel, weil Supavisor Klartext nicht ablehnen kann.

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

- **Abrechnungs-Tabs mobil:** braucht Login als Admin im Browser (Agent darf in Produktion kein
  Passwort eingeben) — von Hand bei ~390 px Breite prüfen, ob Tabs und Rechnungstabelle scrollen.
- Sentry `JAVASCRIPT-NEXTJS-Z` (Gebühren-DELETE vor dem Fix) noch auf „resolved“ setzen.
- Vier weitere direkte `resend.emails.send`-Aufrufe in Webhook/Rechnungsversand prüfen das
  Ergebnis inzwischen selbst; neue Aufrufe nur noch über `src/infrastructure/email/email.service.ts`.

---

## P1 — Wichtig

- **Verwaiste Session-Einheiten in Produktion prüfen.** Lokal (03.10.2026) keine Geister: alle
  `plan_entry_id IS NULL`-Sessions sind `walk_in` mit Buchung. Produktion mit der Abfrage aus
  `docs/DATABASE.md` („Verwaiste Geister-Sessions") prüfen; nur `training`-Treffer sind Geister.

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
