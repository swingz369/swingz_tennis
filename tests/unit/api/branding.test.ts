/**
 * Regression-guard for the Sprint-4 ALLOWED_BRANDING_KEYS allowlist fix
 * (commit 50efd0b, file: app/api/branding/route.ts).
 *
 * BEFORE the fix the allowlist only contained:
 *   [name, logo_url, logo_dark_url, favicon_url, custom_domain, updated_at]
 * - 4 actual columns MISSING: primary_color, secondary_color, accent_color, logo_light_url
 * - 1 column listed that DOES NOT exist in schema: logo_url
 *
 * AFTER the fix the allowlist contains exactly the 8 columns the PUT
 * handler writes: primary_color, secondary_color, accent_color,
 *                  logo_light_url, logo_dark_url, favicon_url,
 *                  custom_domain, updated_at.
 *
 * This test asserts the PUT handler:
 *   (a) Returns 200 OK on the full payload that previously 400'd
 *   (b) Maps the Zod-validated keys to the 4 column-names that were
 *       MISSING from the pre-fix allowlist
 *   (c) Still rejects genuinely unknown keys as defense-in-depth
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ───────────────────────────────────────────────────────────────────────
// Mock auth wrapper. The PUT handler reads `auth.supabase` from this
// closure (NOT a freshly-imported server-supabase client). We pass a
// controlled `{ from: fromMock }` so the handler's DB calls are observable.
// ───────────────────────────────────────────────────────────────────────
interface AdminCtx {
  user: { id: string; role: string; club_id: string };
  supabase: { from: ReturnType<typeof vi.fn> };
  role: string;
  clubId: string;
}

const adminCtx: AdminCtx = {
  user: { id: 'admin-uuid', role: 'admin', club_id: 'club-uuid-1' },
  // the route reads auth.supabase — wire-via-ctx, not via module-import
  supabase: { from: vi.fn() },
  role: 'admin',
  clubId: 'club-uuid-1',
};

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};

vi.mock('@/lib/api-auth', () => ({
  withApiAuth: async (_req: Request, handler: (auth: AdminCtx) => Promise<Response>) =>
    handler(adminCtx),
  withAuth: async (_req: Request, handler: (auth: AdminCtx) => Promise<Response>) =>
    handler(adminCtx),
  verifyRole: async (auth: AdminCtx, requiredRole: string) =>
    (ROLE_HIERARCHY[auth.role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0),
}));

// ───────────────────────────────────────────────────────────────────────
// Resolve fromMock AFTER mocks are set (adminCtx.supabase.from is the
// spy the route actually invokes).
// ───────────────────────────────────────────────────────────────────────

const FULL_PAYLOAD = {
  brand: {
    primaryColor: '#ff5500',
    secondaryColor: '#0055ff',
    accentColor: '#00ff55',
  },
  logos: {
    light: 'https://example.com/logo-light.png',
    dark: 'https://example.com/logo-dark.png',
    favicon: 'https://example.com/favicon.ico',
  },
  customDomain: 'https://club.example.com',
};

const makePutRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-club-id': adminCtx.clubId },
    body: JSON.stringify(body),
  });

describe('PUT /api/branding — Sprint-4 allowlist regression guard', () => {
  let eqMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let fromMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
    updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    fromMock = adminCtx.supabase.from;
    fromMock.mockReturnValue({ update: updateMock });
    fromMock.mockClear();
    updateMock.mockClear();
  });

  it('accepts the full payload (brand+logos+customDomain) and returns 200 OK', async () => {
    // BEFORE the Sprint-4 fix this flow 400'd on
    // "Unknown branding field: primary_color" (etc.)
    const mod = await import('@/app/api/branding/route');
    const res = await mod.PUT(makePutRequest(FULL_PAYLOAD));
    expect(res.status).toBe(200);

    // Verify Supabase wire-up: update() called with the mapped update-object
    expect(fromMock).toHaveBeenCalledWith('clubs');
    expect(updateMock).toHaveBeenCalledTimes(1);
    const updateArg = updateMock.mock.calls[0][0] as Record<string, unknown>;

    // 4 columns that were MISSING from the pre-fix allowlist must now be in the update payload
    expect(updateArg).toMatchObject({
      primary_color: '#ff5500',
      secondary_color: '#0055ff',
      accent_color: '#00ff55',
      logo_light_url: 'https://example.com/logo-light.png',
      logo_dark_url: 'https://example.com/logo-dark.png',
      favicon_url: 'https://example.com/favicon.ico',
      custom_domain: 'https://club.example.com',
    });

    // Explicit presence-checks for the 4 bug-class keys (defensive against typos)
    expect('primary_color' in updateArg).toBe(true);
    expect('secondary_color' in updateArg).toBe(true);
    expect('accent_color' in updateArg).toBe(true);
    expect('logo_light_url' in updateArg).toBe(true);

    // Defense-in-depth: phantom `logo_url` from the pre-fix allowlist is NOT present
    expect('logo_url' in updateArg).toBe(false);
    expect('name' in updateArg).toBe(false);
  });

  it('rejects unknown keys with 400 (allowlist defense still active post-fix)', async () => {
    const mod = await import('@/app/api/branding/route');
    const res = await mod.PUT(makePutRequest({ ...FULL_PAYLOAD, name: 'hacker-injected-name' }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled(); // must short-circuit BEFORE the DB call
  });

  it('accepts partial payload (only brand, no logos) — empty slots are skipped', async () => {
    const mod = await import('@/app/api/branding/route');
    const res = await mod.PUT(makePutRequest({ brand: FULL_PAYLOAD.brand }));
    expect(res.status).toBe(200);
    const updateArg = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty('primary_color', '#ff5500');
    expect(updateArg).toHaveProperty('secondary_color', '#0055ff');
    expect(updateArg).toHaveProperty('accent_color', '#00ff55');
    // Logo URLs should NOT be in the update when logos were not sent
    expect('logo_light_url' in updateArg).toBe(false);
    expect('logo_dark_url' in updateArg).toBe(false);
    expect('favicon_url' in updateArg).toBe(false);
  });

  it('rejects invalid color format (Zod validation guard before allowlist)', async () => {
    const mod = await import('@/app/api/branding/route');
    const res = await mod.PUT(makePutRequest({ brand: { primaryColor: 'not-a-hex' } }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
