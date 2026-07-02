# Auth & RBAC — Rollen, Guards, Hierarchie, Cookie-Mechanik

> **Source of Truth (Code):**
>
> - [`lib/auth-common.ts`](../../../lib/auth-common.ts) — `UserRole`, `ROLE_HIERARCHY`, `hasRole(...)`, `getHighestRole(...)`
> - [`lib/auth.ts`](../../../lib/auth.ts) — Server-Component-Auth-Guard `requireAuth()`
> - [`lib/api-auth.ts`](../../../lib/api-auth.ts) — API-Route-Helper `withApiAuth(...)`, `verifyRole(...)`
> - [`lib/admin-context.ts`](../../../lib/admin-context.ts) — Admin-Club-Auflösung `requireAdminClub()`
> - [`src/infrastructure/persistence/schema.ts`](../../../src/infrastructure/persistence/schema.ts) — `userClubMemberships`-Tabelle
>
> **Verbindlich:** [`docs/BUSINESS_RULES.md`](../../BUSINESS_RULES.md) für Hierarchie und Rechte-Konzept.

---

## Hierarchie-Modell

Werte aus `lib/auth-common.ts:14-20` (verbatim):

```ts
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};
```

Vergleich per Zahl — niemals per String-Compare (`sort`-Drift-vermeidung).

`UserRole`-Typ (lib/auth-common.ts:11):

```ts
export type UserRole = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';
```

`hasRole(userRole, requiredRole)` (lib/auth-common.ts:30-32):

```ts
return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
```

---

## Rollen-Charakter (verbatim aus `lib/auth-common.ts:4-11`)

```
owner      →  Plattformbetreiber (Swingz GmbH), club_id = NULL, sieht alles
superadmin →  Tennisschule-Chef, verwaltet Gruppe von Vereinen, club_id = NULL
admin      →  Vereinsadmin, genau 1 Verein (club_id gesetzt)
trainer    →  club_id = specific club
member     →  club_id = specific club
```

### ⚠️ Wichtige Präzisierung ggü. Handbuch-Draft v1

**`user_club_memberships.role`-Enum (schema.ts, userClubMemberships):**

```ts
role: varchar('role', { length: 20 }).notNull().default('member'),
// 'member' | 'trainer' | 'admin' | 'superadmin'   ← verbatim schema.ts-Kommentar
```

**`owner` ist NICHT in diesem Enum.** Owner lebt anderswo (vermutlich `users.role` oder `auth.users.app_metadata.role='owner'`). Der exakte Detection-Mechanismus ist in `lib/api-auth.ts` umgesetzt — beim Onboarding genau dort nachlesen.

Konsequenz:

- `user_club_memberships` Row mit `role='owner'` darf es **nicht** geben (Schema verbietet's via ENUM-Kommentar).
- Owner hat **keine** club_id-Bindung — der Verein-Wechsel ist irrelevant.

---

## Capability-Matrix

Aus User-Perspektive (zusammengefasst aus BUSINESS_RULES.md + Lib-Code-Konventionen):

| Aktion               |      owner      |       superadmin        |       admin       | trainer |     member      |
| -------------------- | :-------------: | :---------------------: | :---------------: | :-----: | :-------------: |
| Alle Clubs sehen     |       ✅        |    ✅ (Tennisschule)    |      eigener      | eigener |     eigener     |
| Admin einladen       | ✅ (per E-Mail) |           ❌            |        ❌         |   ❌    |       ❌        |
| Verein erstellen     |       ✅        |           ✅            |        ❌         |   ❌    |       ❌        |
| Module togglen       |     global      |        pro Club         |    pro Verein     |   ❌    |       ❌        |
| Mitglieder verwalten |    ✅ global    | ✅ Tennisschule-Cluster | ✅ eigener Verein |   ❌    | nur sich selbst |
| Sessions anlegen     |       ✅        |           ✅            |        ✅         |   ✅    |       ❌        |
| RSVP / Buchen        |       ✅        |           ✅            |        ✅         |   ✅    |       ✅        |
| Abo-Wechsel (Stripe) |       ✅        |           ✅            |        ✅         |   ❌    |       ❌        |
| Audit-Logs lesen     |    ✅ global    | ✅ Tennisschule-Cluster | ✅ eigener Verein |   ❌    |   nur eigenes   |

---

## Auth-Guards — drei Kontexte

### 1. Server Component (Page/Layout) — `lib/auth.ts`

Export: `requireAuth()` (lib/auth.ts:143-154)

```ts
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  // ...
  if (!user) redirect('/login');
  return { supabase, user };
}
```

**Verhalten:**

- Cookie-Quelle: `cookies()` (Next.js 16 async cookies)
- Auth-Failure → `redirect('/login')`
- Returns: `{ supabase, user }` — Supabase-Client **mit aktiver RLS**

⚠️ **`lib/auth.ts` enthält `requireAuth` + `getAuthenticatedUser`** (siehe JSDoc-Header lib/auth.ts:1-30), aber **KEINE** Role-/Club-Resolution. Das muss die Page selbst machen.

### 2. API Route — `lib/api-auth.ts`

Export: `withApiAuth(request, handler)`, `verifyRole(auth, role)`, etc.

```ts
return withApiAuth(request, async (auth) => {
  if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
  return NextResponse.json({ ok: true });
});
```

**AuthContext-Felder** (welche `lib/api-auth.ts` liefert — exakte Felder beim Onboarding in `lib/api-auth.ts` verifizieren):

| Feld             | Typ                 | Bedeutung                                       |
| ---------------- | ------------------- | ----------------------------------------------- |
| `user`           | `User` (Supabase)   | Authentifizierter User                          |
| `supabase`       | `SupabaseClient`    | RLS aktiv — sieht nur erlaubte Rows             |
| `clubId`         | `string \| null`    | Effektiver Club (mit Cookie-Resolution)         |
| `selectedClubId` | `string?`           | Nur Owner/Superadmin: Cookie-Wert               |
| `role`           | `UserRole`          | Rolle im effektiven Club (NICHT global höchste) |
| `roles`          | `string[]`          | Alle Rollen aus allen Memberships               |
| `memberships`    | `{club_id, role}[]` | Roh-Daten aus `user_club_memberships`           |

### 3. Admin-Page mit Club-Wechsel — `lib/admin-context.ts`

Export: `requireAdminClub()` (lib/admin-context.ts).

```ts
const { supabase, user, clubId, isSuperadmin, role } = await requireAdminClub();
```

Redirect-Verhalten (lib/admin-context.ts JSDoc):

- Nicht eingeloggt → `/login`
- Eingeloggt, aber keine Admin-Rolle → `/dashboard`
- Superadmin ohne Club-Selection → `/select-admin-club`

---

## Cookie-Mechanik

### Supabase-Session-Cookie

Gesetzt von `@supabase/ssr` (lib/auth.ts:67-78):

- `httpOnly: true` (default)
- `secure: NODE_ENV === 'production'`
- `sameSite: 'lax'`

### Multi-Club-Cookie

`ADMIN_CLUB_COOKIE` (genauer Name in `lib/cookies.ts`):

- Multi-Club-Switching für Owner/Superadmin UND Admin mit mehreren verwalteten Vereinen
- Setzung in `withApiAuth`-Handler bzw. Club-Switcher-UI
- `httpOnly + secure + sameSite=lax + path=/`

---

## Multi-Membership-Handling

**`user_club_memberships`-Tabelle** (schema.ts:382-410):

| Spalte                    | Typ          | Constraint                                                               | Bedeutung                     |
| ------------------------- | ------------ | ------------------------------------------------------------------------ | ----------------------------- |
| `id`                      | uuid         | PK                                                                       | Row-ID                        |
| `user_id`                 | uuid         | FK → users.id                                                            | User-Bezug                    |
| `club_id`                 | uuid         | FK → clubs.id, ON DELETE CASCADE                                         | Club-Bezug                    |
| `role`                    | varchar(20)  | NOT NULL, default `member`, values: `member\|trainer\|admin\|superadmin` | Rolle (kein `owner`!)         |
| `office_flags`            | jsonb        | default `{}`, Type `OfficeFlagMap`                                       | Vereinsämter-Host-Flag-System |
| `is_active`               | boolean      | default `true`                                                           | Aktiv-Flag für Soft-Delete    |
| `include_in_planning`     | boolean      | default `true`                                                           | Saison-Planning-Einbezug      |
| `tenant_id`               | varchar(100) | nullable                                                                 | Multi-Tenant-Isolation        |
| `joined_at`, `created_at` | timestamp    | default `now()`                                                          | Audit                         |

**UNIQUE-Constraint:** `(user_id, club_id)` — ein User kann pro Club nur EINE Membership haben.

Mehrere Clubs → mehrere Rows.

### Welche Rolle gilt pro Request?

`getHighestRole(roles)` (lib/auth-common.ts:36-45): liefert die höchste Rolle.
Aber: **`role` im AuthContext kommt aus der Membership im effektiven `clubId`**, NICHT aus der global höchsten (defensive Verhinderung von Cross-Club-Leaks).

Beispiel: User U ist `admin` in Club A und `member` in Club B:

- Ohne Cookie: `role = admin`, `clubId = A`.
- Mit `ADMIN_CLUB_COOKIE=B`: `role = member`, `clubId = B`.

> ⚠️ Code-pfad in `lib/api-auth.ts` → `buildAuthContext()` beim Onboarding genau verifizieren — die genaue Logik ist nicht im Audit gelesen.

---

## RLS-Policies

Datenbank-Seite. Server-Client (`supabase`) respektiert sie. Service-Client (`@/lib/supabase/service`) umgeht sie.

### Wichtige Policies (aus den Migrations ableitbar)

- `user_club_memberships`: SELECT nur eigene Rows (`auth.uid() = user_id`)
- `clubs`: SELECT nur Clubs, in denen User aktive Membership hat
- `invoices`: SELECT für Admins/Mitglieder pro Verein
- `audit_logs`: SELECT für Owner (global) + Admin (eigener Verein) + Superadmin (Tennisschule-Cluster)

### Service-Client vs. RLS

| Anwendungsfall                    | Client                                |
| --------------------------------- | ------------------------------------- |
| Seiten-Render                     | `createServerClient()` (RLS an)       |
| API-Route-Handler                 | `auth.supabase` (RLS an)              |
| Background-Job (Cross-Tenant)     | `createServiceClient()` (RLS **aus**) |
| Notifications senden (Cross-User) | `createServiceClient()` (RLS **aus**) |
| Public Stats / aggregate          | `createServiceClient()` (RLS **aus**) |

> ⚠️ **TODO beim Onboarding verifizieren:** `lib/supabase/service.ts` hat (vermutlich) kein `import 'server-only'`-Guard — wäre sinnvoll als Verteidigung gegen Client-Import-Bug.

---

## Rate-Limit (DDoS-Schutz)

- Cookie-basiertes Rate-Limit in [`proxy.ts`](../../../proxy.ts) (raw fetch)
- SDK-basiertes Rate-Limit in `lib/rate-limit.ts`

> Genauer Mechanismus beim Onboarding in beiden Files nachlesen.

---

## Checklist für neue Routen

```
☐ requireApiAuth/withApiAuth (oder requireAuth in SC)?
☐ verifyRole korrekt (mindestens 'admin' oder höher)?
☐ Falls Club-scoped: verifyClubAccess(auth, requestedClubId)?
☐ Falls Office-Flag-spezifisch: verifyOffice(auth, 'kassenwart')?
☐ unauthorizedResponse() / forbiddenResponse() für 401/403?
☐ RLS-Client benutzt, NICHT Service-Client (außer Cross-Tenant gewollt)?
☐ Bei mehreren Vereinen: ADMIN_CLUB_COOKIE berücksichtigt?
☐ E2E-Test, der mitgliedsfremden Zugriff ablehnt?
```

Wenn alle 8 ✅ → safe.

---

## 📚 Verwandte Kapitel

- [`../user/owner.md`](../user/owner.md) — Owner-Sicht
- [`../user/superadmin.md`](../user/superadmin.md) — Superadmin-Sicht
- [`../user/admin.md`](../user/admin.md) — Vereinsadmin-Sicht
- [`data-model.md`](./data-model.md) — `user_club_memberships`-Schema
- [`api-conventions.md`](./api-conventions.md) — generelle API-Patterns
