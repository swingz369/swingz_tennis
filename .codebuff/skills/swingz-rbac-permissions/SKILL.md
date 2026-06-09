---
name: swingz-rbac-permissions
description: SwingZ-specific knowledge for the role-based access control (RBAC) system — 4 roles, 30+ permissions, club-scoping, superadmin override, and the getServerSession/auth pattern.
---

# SwingZ RBAC Permissions

## Where it lives

- **Auth helpers:** `lib/api-auth.ts` (server-side `requireRole`, `requirePermission`)
- **Session:** `lib/admin-context.ts` (current admin user + club context)
- **Permissions:** `lib/rbac/permissions.ts` (the canonical permission list)
- **Roles:** `lib/rbac/roles.ts` (the 4-role hierarchy)
- **Middleware:** `proxy.ts` (Next.js middleware for route protection)
- **Supabase Auth:** `src/infrastructure/external/supabase/` (server + client)
- **Type:** `Role = 'member' | 'trainer' | 'admin' | 'superadmin'`

## The 4-role hierarchy

```typescript
const ROLE_HIERARCHY: Record<Role, number> = {
  member: 0,
  trainer: 1,
  admin: 2, // ← club-scoped (one club)
  superadmin: 3, // ← platform-wide, bypasses all checks
};
```

**Hierarchy rules:**

- Higher role inherits all permissions of lower roles
- `admin` is **club-scoped** — can only act on their own club's data
- `superadmin` is **platform-wide** — but should still set `X-Admin-Club` cookie for UI context
- `trainer` is a **specialization** of `member` + has scheduling permissions
- `member` is the default role for any authenticated user

## The permission catalog

Permissions follow the pattern `<resource>:<action>`:

```typescript
type Permission =
  // Bookings
  | 'bookings:read_own'
  | 'bookings:read_club'
  | 'bookings:create'
  | 'bookings:cancel_own'
  | 'bookings:cancel_any'
  | 'bookings:mark_attendance'
  // Members
  | 'members:read'
  | 'members:invite'
  | 'members:update_role'
  | 'members:deactivate'
  // Sessions
  | 'sessions:read'
  | 'sessions:create'
  | 'sessions:update'
  | 'sessions:delete'
  // Billing
  | 'billing:read'
  | 'billing:create_invoice'
  | 'billing:send_reminder'
  | 'billing:configure'
  | 'billing:view_revenue'
  // Season planning
  | 'season_planning:read'
  | 'season_planning:configure'
  | 'season_planning:publish'
  // Admin / settings
  | 'settings:read'
  | 'settings:update'
  | 'clubs:configure'
  | 'feature_flags:update'
  // Superadmin-only
  | 'tenants:list'
  | 'tenants:impersonate'
  | 'audit:read_all'
  | 'system:configure';
```

**Role → Permission mapping** (`lib/rbac/role-permissions.ts`):

| Role         | Permissions                                                           |
| ------------ | --------------------------------------------------------------------- |
| `member`     | `bookings:read_own`, `bookings:create`, `bookings:cancel_own`         |
| `trainer`    | + `sessions:read`, `bookings:mark_attendance`                         |
| `admin`      | + everything except `tenants:*`, `audit:read_all`, `system:configure` |
| `superadmin` | ALL permissions                                                       |

## The `requireRole` / `requirePermission` pattern

```typescript
// In any API route
import { requirePermission } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Throws 401 if not authenticated, 403 if missing permission
  const session = await requirePermission('members:invite');
  // session.user, session.clubId, session.role are all typed
  // ...
}
```

**Two helpers:**

- `requireRole('admin')` — checks role level (uses hierarchy)
- `requirePermission('bookings:create')` — checks specific permission (more precise, prefer this)

## Club-scoping (CRITICAL)

Every authenticated request has a `clubId` in the session. **Every** data query MUST filter by it:

```typescript
// ❌ WRONG — leaks data across clubs
const allBookings = await db.select().from(bookings);

// ✅ RIGHT — scoped to caller's club
const myClubBookings = await db.select().from(bookings).where(eq(bookings.club_id, session.clubId));
```

**RLS is a safety net, not a replacement.** Even with RLS enabled, always write explicit `WHERE club_id = $1` clauses. This makes the code self-documenting and prevents accidents when RLS policies change.

## Superadmin special handling

Superadmins can act on **any** club. The pattern:

```typescript
// In admin-club-switcher.tsx
const switchToClub = async (clubId: string) => {
  await apiFetch('/api/admin/switch-club', {
    method: 'POST',
    body: JSON.stringify({ clubId }),
  });
  // Sets ADMIN_CLUB_COOKIE which the server reads on next request
};
```

The `ADMIN_CLUB_COOKIE` is set by the server, read by `getServerSession()`, and falls back to `session.clubId` for non-superadmins. **Never** trust a client-provided `clubId` — always derive it from the session.

## The proxy.ts middleware

```typescript
// proxy.ts (Next.js 16 middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/webhooks/*'];
const ADMIN_PATHS = ['/admin/*', '/api/admin/*'];
const SUPERADMIN_PATHS = ['/superadmin/*', '/api/superadmin/*'];

export function middleware(req: NextRequest) {
  if (PUBLIC_PATHS.some((p) => matchPath(req.nextUrl.pathname, p))) {
    return NextResponse.next();
  }
  // ... session check + role check
}
```

**Always** add new protected routes to `ADMIN_PATHS` or `SUPERADMIN_PATHS` — don't rely on per-page client-side checks.

## Adding a new permission

1. Add to the `Permission` union in `lib/rbac/permissions.ts`
2. Add to the role-permission map in `lib/rbac/role-permissions.ts`
3. Add to the matrix in `docs/ROLE-MANAGEMENT.md`
4. Use `requirePermission('new:permission')` in the API route
5. Add test case in `lib/rbac/__tests__/permissions.test.ts`

## Adding a new role

**Don't.** The 4-role hierarchy is intentional and tested. If you need more granular permissions, add a permission — not a role. If you need a special "billing-admin" that's admin minus user management, use a **role group** instead.

## Common tasks

### Debug "User X can't see feature Y"

1. Check `session.role` — is it what you expect?
2. Check `session.clubId` — is it set?
3. Check the feature's gating logic — does it use the right permission name?
4. Check `feature_flags` JSON in clubs table — is the feature enabled for this club?
5. Check RLS policies — is the user being filtered out at the DB level?

### Implement "Admin can impersonate Member"

1. Add `tenants:impersonate` to `superadmin` role
2. Create `POST /api/admin/impersonate` that sets an `IMPERSONATE_COOKIE`
3. In `getServerSession()`, check `IMPERSONATE_COOKIE` and return impersonated user
4. **Always** log impersonation to `audit_logs` with `action: 'impersonation.start'`
5. Add a banner in the UI when impersonating (see `components/admin/impersonation-banner.tsx`)

### Audit who has access to what

```sql
-- List all permissions for a role
SELECT permission FROM role_permissions WHERE role = 'admin' ORDER BY permission;
-- List all admins in a club
SELECT u.email, ucl.role
FROM users u
JOIN user_club_memberships ucl ON ucl.user_id = u.id
WHERE ucl.club_id = $1 AND ucl.role = 'admin';
```

## Gotchas

- **Hierarchy is checked at the role level, not permission level** — `requireRole('admin')` accepts any admin (including superadmin). For fine-grained control, use `requirePermission()`.
- **The `member` role is the floor** — never set role to `null` or `undefined`. Use `member` for new signups.
- **Club-scoping is per-request** — don't cache `clubId` across requests. Always re-derive from the session.
- **Superadmin must explicitly switch clubs** — there's no "default" club. UI should prompt if no `ADMIN_CLUB_COOKIE` is set.
- **The audit log is a compliance requirement** — every privileged action (role change, impersonation, billing config) must be logged. No exceptions.
