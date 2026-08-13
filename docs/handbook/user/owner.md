# Owner — Plattformbetreiber

> **Wer bist du?** SwingZ-Mitarbeiter:in / Service-Partner:in. Du betreibst die Plattform selbst und verwaltest alle Vereine und Subscription-Tiers plattformweit.
>
> **Rolle in Hierarchie:** Stufe 5 (höchste) · **Club-Bindung:** **keinem Verein zugeordnet**

---

## ⚠️ Wichtige Korrektur ggü. früherer Handbuch-Version

**Owner ist NICHT in der `user_club_memberships`-Tabelle gespeichert.**

Das `role`-Feld in `userClubMemberships` (Drizzle-export) → DB-Tabelle `user_club_memberships` hat das Enum:

```ts
// src/infrastructure/persistence/schema.ts, userClubMemberships.role:
role: varchar('role', { length: 20 }).notNull().default('member'),
// 'member' | 'trainer' | 'admin' | 'superadmin'   ← schema.ts Kommentar
```

**`owner` ist in dieser Liste NICHT enthalten.** Die Owner-Identität lebt daher anderswo (vermutlich `users.role` oder `auth.users.app_metadata.role='owner'`). Die genaue Erkennung ist in [`lib/auth-common.ts`](../../dev/auth-rbac.md) und [`lib/api-auth.ts`](../../../lib/api-auth.ts) implementiert (siehe Auth-RBAC-Kapitel für die technischen Details).

> **TODO:** Den exakten Owner-Detection-Mechanismus im Code verifizieren — diese Handbuch-Version geht davon aus, dass Owner **keine `user_club_memberships`-Zeile** hat. Wenn der Mechanismus anders liegt, muss dies korrigiert werden.

---

## Was kannst du als Owner?

- **Siehst alle Vereine** der Plattform (über Service-Client in Server-Components — RLS bypass, da Owner kein per-Club-Scope hat)
- **Lädst Admins per E-Mail ein** (POST `/api/owner/invite-admin` — Supabase-Auth Magic-Link)
- **Erstellst Vereine** direkt
- **Stripe-Plan-Wechsel** (Starter/Professional) für Kunden-Setups
- **Audit-Logs global** einsehen
- **Background-Jobs** beobachten und manuell triggern
- **Sentry-Crashes** global analysieren
- **Owner sieht KEINE vereinsspezifischen Daten** über UI — er ist immer global.

---

## Dashboard (`/owner`)

> **Hinweis:** Welche KPI-Strip/Card-Komponente genau gerendert wird, lebt in `app/(protected)/owner/page.tsx`. Die genaue Sektion-Aufteilung hängt vom aktuellen Code ab.

Lies beim Onboarding den aktuellen Stand direkt in [`app/(protected)/owner/page.tsx`](<../../../app/(protected)/owner/page.tsx>).

---

## Bekannte Owner-Routen (verifiziert: `app/(protected)/owner/**`)

Die folgenden Datei-Pfade existieren in der Codebase:

- `app/(protected)/owner/page.tsx`
- `app/(protected)/owner/layout.tsx`
- (Plus weitere — beim Onboarding via `find app/(protected)/owner -name '*.tsx'` rekonstruieren)

> **TODO:** Eine vollständige Liste ist im Skript `scripts/docs-autogen.ts` als Extension-Punkt vorgesehen, aktuell noch nicht implementiert. Bis dahin: pro eigenem Onboarding den Verzeichnis-Scan neu erstellen.

---

## Häufige Aktionen

### 1. Neuen Verein anlegen

UI-Pfad: `app/(protected)/owner/clubs/new/page.tsx` (falls vorhanden — bitte beim Onboarding verifizieren).

```ts
// Vermutlich (NICHT verifiziert gegen den Code — TODO):
1. INSERT clubs { slug, name, plan, status: 'active' }
2. supabase.auth.admin.inviteUserByEmail(admin_email)
3. INSERT user_club_memberships { user_id, club_id, role: 'admin', is_active: true }
   (für den eingeladenen Admin, NICHT für den Owner)
```

**Wichtig:**

- Owner bekommt **KEINE** automatische Membership beim Anlegen (anders als Superadmin).
- Owner bleibt auf "platform-wide" — kein `club_id`.

### 2. Admin per E-Mail einladen

Endpoint: **POST `/api/owner/invite-admin`**

Details in [`app/api/owner/invite-admin/route.ts`](../../../app/api/owner/invite-admin/route.ts). Liest beim Onboarding genau dort nach.

### 3. Stripe-Webhook debuggen

Webhook-Endpoint: **POST `/api/webhooks/stripe`** (Lib: `lib/stripe/stripe-client.ts`).

```bash
vercel logs <deployment> --filter /api/webhooks/stripe
```

### 4. Backup & Restore

Vercel-Cron triggert nächtliche Backups. Manuell:

```bash
curl -X POST https://swingz.vercel.app/api/cron/backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

> **Stand:** Existenz des `/api/cron/backup`-Endpunkts ist NICHT im aktuellen Hook verifiziert. Eigene Onboarding-Suche via `find app/api/cron -type f` empfohlen.

---

## Zusammenspiel mit anderen Rollen

| Situation             | Was passiert?                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin verlässt Verein | Membership auf `is_active=false` setzen. KEIN Hard-Delete (GoBD § 147 AO 10-Jahres-Retention).                                                                                  |
| Verein wechselt Plan  | Stripe-Subscription `update()` mit neuer Quantity + Price. Tier-Feature-Sync via [`lib/services/tier-features-sync.ts`](../../../lib/services/tier-features-sync.ts) (ADR-003). |
| Cron-Job-Failure      | `background_jobs.status='failed'` → Logs in `lib/jobs/runner.ts`.                                                                                                               |
| DSGVO-Lösch-Anfrage   | Siehe [`lib/services/anonymize.service.ts`](../../../lib/services/anonymize.service.ts).                                                                                        |

---

## ⚠️ Pflichten & Risiken

1. **Migrationen orchestrieren** — niemals Breaking-Change-Migration ohne Vorwarnung.
2. **Stripe-Webhook-Replays** — niemals ohne Rücksprache mit zuständigem Admin (Doppel-Buchung-Risiko).
3. **Lösch-Vorgänge** — immer Audit-Log-Eintrag vorher prüfen (Recovery-Chance).

---

## Tests

Pfad `tests/e2e/owner-*.spec.ts`:

- Vereins-Anlage → Admin-Invite → Login → Onboarding
- Plan-Switch (Starter → Professional) → Quantity-Sync
- Audit-Log-Sichtbarkeit global

---

## 📚 Verwandte Kapitel

- [`../user/superadmin.md`](./superadmin.md) — Tennisschule-Chef (unterschied zu Owner)
- [`../user/admin.md`](./admin.md) — Vereinsadmin (dein "Kunde")
- [`../dev/auth-rbac.md`](../dev/auth-rbac.md) — Owner-Detection-Mechanismus
- [`../dev/api-reference.md`](../dev/api-reference.md) — Owner-spezifische Routes
- [`../../HANDBOOK.md`](../../HANDBOOK.md) — Rollen-Übersicht
