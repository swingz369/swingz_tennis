import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { processGroupChange, role } = vi.hoisted(() => ({
  processGroupChange: vi.fn(),
  role: { value: 'admin' },
}));

vi.mock('@/lib/services/group-change.service', () => ({ processGroupChange }));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { role: role.value } }),
    };
    return { user: { id: 'u1' }, supabase: { from: () => chain } };
  },
}));

import { POST } from '@/app/api/billing/group-change/route';

const id = '00000000-0000-4000-8000-000000000001';
const req = () =>
  new NextRequest('http://localhost/api/billing/group-change', {
    method: 'POST',
    body: JSON.stringify({
      club_id: id,
      season_id: id,
      member_id: id,
      old_group_id: id,
      new_group_id: id,
      change_date: '2026-10-02',
    }),
  });

describe('POST /api/billing/group-change', () => {
  beforeEach(() => processGroupChange.mockReset().mockResolvedValue({ net_delta: 0 }));

  it('Trainer bekommt 403, nichts wird umgehängt', async () => {
    role.value = 'trainer';
    expect((await POST(req())).status).toBe(403);
    expect(processGroupChange).not.toHaveBeenCalled();
  });

  it('Admin führt den Wechsel aus', async () => {
    role.value = 'admin';
    expect((await POST(req())).status).toBe(200);
    expect(processGroupChange).toHaveBeenCalledOnce();
  });
});
