# Supabase-Setup — Clients, RLS, Auth, Disciplines

> Drei Supabase-Clients — die richtige Wahl ist kritisch. Verbindlich: [`docs/BUSINESS_RULES.md`](../../BUSINESS_RULES.md) für Auth- und Member-Regeln.

## 🧩 Drei Clients, drei Zwecke

| Client             | Import                                               | RLS aktiv | Verwendung                                               |
| ------------------ | ---------------------------------------------------- | :-------: | -------------------------------------------------------- |
| **Server-Client**  | `createClient()` aus `@/lib/supabase/server`         |    ✅     | Server Components, API Routes (mit User-Kontext)         |
| **Service-Client** | `createServiceClient()` aus `@/lib/supabase/service` | ❌ bypass | Background-Jobs, Cross-Tenant-Aggregation, Notifications |
| **Browser-Client** | `createClient()` aus `@/lib/supabase/client`         |    ✅     | Client Components                                        |

### Entscheidungs-Baum

```
Brauche ich Daten die der CURRENT USER sehen darf?
├── Ja   → Supabase-Server-Client (RLS an)
├── Nein, ich brauche service-level Zugriff (Cron, Notification)
│        → Service-Client (RLS aus!)
└── Bin im Browser (React Event Handler)
         → Browser-Client (Singleton, RLS an)
```

⚠️ **Falle**: `createServiceClient()` in einer Client-Component = RLS komplett umgangen (P0-Finding 5).
**TODOs:** `import 'server-only'` als erste Zeile in `lib/supabase/service.ts` einfügen, damit es Build-Failure wirft wenn falsch importiert.

## 🔐 Auth-Flow

### Registrierung

```
1. /api/auth/signup?email=&password=
   → Supabase Auth.signUp() erstellt User in auth.users
   → Trigger (DB-Migration) erstellt user_club_memberships-Rows bei Bedarf

2. E-Mail-Bestätigung via Supabase SMTP (Resend-Provider)
   → User klickt Link → Supabase erstellt Session

3. Membership-Eintragung erfolgt durch Einladung:
   POST /api/members/invite
   → Auth-Invite (magic link) oder direkter Eintrag mit existierendem auth-User
```

### Login

```
1. Client → supabase.auth.signInWithPassword({ email, password })
   → Supabase setzt SSR-Cookie (sb-…)
   → Redirect (z. B. zu /dashboard)
```

### Logout

```
Client → supabase.auth.signOut()
→ Cookies gelöscht
→ ADMIN_CLUB_COOKIE wird NICHT automatisch gelöscht!
   → Manuell: document.cookie = ADMIN_CLUB_COOKIE + '=; Max-Age=0; path=/'
```

### Session-Refresh

Supabase SSR-Client handled das automatisch über den Cookie-Pfad. Wichtig: `supabase.auth.getSession()` ist deprecated für Authentifizierung (nur Refresh). Für Auth-Checks: `getUser()` benutzen.

## 🛡️ RLS — Row-Level-Security

### Was wird geschützt?

Migrationen:

- `001_rls_policies.sql`, `004_enhanced_rls_policies.sql` — initiale Policies
- `20260506190000_rls_helper_functions.sql` — Helper wie `is_club_admin()`, `is_club_member()`
- `20260513_phase25_rls_policies.sql`, `20260607_add_dunning_rls_policies.sql` — neue Tabellen
- `20260624_fix_rls_auth_users_policies.sql`, `20260625_fix_rls_club_members_references.sql` — Fixes
- `20260724_fix_rls_missing_tables.sql`, `20260727_fix_trainer_availabilities_rls.sql` — Audit-Fixes

### Standard-Patterns

```sql
-- 1. User darf nur eigene Row sehen
CREATE POLICY "member sees own bookings" ON bookings
  FOR SELECT USING (auth.uid() = member_id);

-- 2. User darf nur in eigenem Verein sehen
CREATE POLICY "admin sees own club bookings" ON bookings
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM user_club_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 3. Owner sieht ALLES
CREATE POLICY "owner sees all bookings" ON bookings
  FOR SELECT USING (is_owner());
```

Helper-Funktionen in `supabase/migrations/20260506190000_rls_helper_functions.sql`:

- `is_owner()` — true für User mit Rolle `owner`
- `is_club_admin(club_id uuid)` — true für Admins+ in diesem Club
- `is_club_member(club_id uuid)` — true für Members+ in diesem Club

## 🧪 Tests für RLS

**Pflicht:** Tests, die verifizieren dass RLS greift.

Aktuell: **Multi-Tenant-Tests rot** (P0-Finding 15). Vor Marktreife MÜSSEN folgende Tests grün sein:

```ts
// src/__tests__/api/clubs-features.test.ts
test('trainer from club A cannot read club B sessions', async () => {
  const auth = await mockAuth({ userId: 'trainer-a', role: 'trainer', clubId: 'club-a' });
  const res = await GET('/api/sessions?clubId=club-b', auth);
  expect(res.status).toBe(403); // NICHT 200 mit leerer Liste!
});
```

## 🔧 Wichtige Konfigurationen

### Auth-Provider

provider: `email` (magic link + password). `google` OAuth aktuell NICHT aktiv.

### E-Mail-SMTP

Supabase SMTP-Provider: **Resend**. Konfiguration in Supabase Dashboard:

- Sender: `noreply@swingz.cloud`
- Reply-To: `info@swingz.cloud`

### Session-TTL

Standard: 1 Stunde. Refresh-Token: 30 Tage.

## ⚠️ Bekannte Probleme (mit Trackern)

| Problem                                                        | Severity | Finding |
| -------------------------------------------------------------- | -------- | ------- |
| `lib/supabase/service.ts` ohne `import 'server-only'`          | 🔴 P0    | P0-5    |
| RLS-Bypass via Drizzle-Direct-Routes (postgres-Rolle)          | 🔴 P0    | P0-2    |
| Service-Client in `decisions/page.tsx` ohne RLS                | 🔴 P0    | P0-3    |
| `CRON_SECRET` als optional                                     | 🔴 P0    | P0-4    |
| DSGVO-Wipe unvollständig (4 statt ~12 Felder)                  | 🔴 P0    | P0-6    |
| Multi-Tenant-Tests rot                                         | 🔴 P0    | P0-15   |
| Race-Condition in `lib/jobs/runner.ts` (`upsert` ohne Locking) | 🔴 P0    | P0-13   |
| Sentry ohne User-Context                                       | 🟡 P1    | –       |

## 🌐 Public-Access

Für Marketing-Pages und Probetraining (`/trial-training`, `/`) wird KEIN Auth-Client benötigt. Direkter Page-Render mit `dynamic = 'force-static'`.

## 📚 Verwandte Kapitel

- [`auth-rbac.md`](./auth-rbac.md) — wie Auth in Code umgesetzt wird
- [`drizzle-orm.md`](./drizzle-orm.md) — Drizzle vs. Supabase
- [`notifications.md`](./notifications.md) — Service-Client-Pattern
- [`feature-flags.md`](./feature-flags.md) — `clubs.features` JSONB
- [`background-jobs.md`](./background-jobs.md) — Cron-Routes
