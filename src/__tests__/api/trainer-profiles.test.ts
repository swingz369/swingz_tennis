/**
 * Verhaltens-Tests für GET /api/trainer-profiles — Trainer-Profile des
 * aktiven Vereins abrufen, inkl. Auto-Anlage fehlender Profile für
 * Mitgliedschaften ohne trainer_profiles-Eintrag. Bisher ungetestet trotz
 * Komplexität 42 (tokensave test_risk, Fund 16.09.2026).
 *
 * Nutzt den Harness aus ../helpers/api-route: der ECHTE withApiAuth/
 * verifyRole-Code läuft, nur die Supabase-Antworten sind kontrolliert.
 *
 * '@/lib/supabase/service' wird gemockt (makeFakeSupabaseClient, geteilte
 * Tabellen-Antworten mit dem Haupt-Mock, siehe JSDoc in api-route.ts) — die
 * Route nutzt createServiceClient() direkt (Mitgliedschaften/Users lesen,
 * RLS-Umgehung nötig), UND TrainerProfileService.createTrainerProfile geht
 * für die 'trainers'-Bootstrapzeile über systemDb() denselben Weg.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSupabaseMock, makeApiRequest, makeFakeSupabaseClient } from '../helpers/api-route';

const supa = installSupabaseMock();

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => makeFakeSupabaseClient(),
}));

const { GET } = await import('@/app/api/trainer-profiles/route');

function profilesRequest(query = '') {
  return makeApiRequest(`http://localhost/api/trainer-profiles${query}`, { method: 'GET' });
}

const availability = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

function profileRow(userId: string, fullName: string) {
  return {
    id: `profile-${userId}`,
    user_id: userId,
    first_name: fullName.split(' ')[0],
    last_name: fullName.split(' ').slice(1).join(' '),
    email: `${userId}@test.de`,
    phone: '0176123456',
    date_of_birth: '1990-01-01',
    bio: null,
    profile_image_url: null,
    qualifications: [],
    specializations: [],
    experience: { years: 0, previousClubs: [], achievements: [] },
    status: 'active',
    hourly_rate: null,
    contracted_hourly_rate: null,
    extra_hours_rate: null,
    availability,
    preferred_time_slots: [],
    languages: ['Deutsch'],
    emergency_contact: { name: '', phone: '', relationship: '' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('GET /api/trainer-profiles', () => {
  beforeEach(() => {
    supa.reset();
    process.env.DISABLE_RATE_LIMITING = 'true';
  });

  it('lehnt Mitglieder ab (verifyRole)', async () => {
    supa.setRole('member', 'club-1');
    const res = await GET(profilesRequest());
    expect(res.status).toBe(403);
  });

  it('lehnt Zugriff auf einen fremden Verein per clubId-Query ab', async () => {
    supa.setRole('admin', 'club-1');
    const res = await GET(profilesRequest('?clubId=club-OTHER'));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain('Zugriff');
  });

  it('liefert eine leere Liste, wenn kein Verein zugeordnet ist (Superadmin ohne Auswahl)', async () => {
    supa.setRole('superadmin', null);
    const res = await GET(profilesRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toEqual([]);
  });

  it('liefert bestehende Profile, wenn alle Trainer bereits ein Profil haben', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('trainer_profiles', () => ({
      data: [profileRow('trainer-1', 'Bob Bauer')],
      error: null,
    }));
    supa.table('user_club_memberships', () => ({
      data: [{ user_id: 'trainer-1', created_at: '2026-01-01', is_active: true }],
      error: null,
    }));
    const res = await GET(profilesRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toHaveLength(1);
    expect(json.profiles[0].userId).toBe('trainer-1');
    expect(json.profiles[0].status).toBe('active');
  });

  it('legt automatisch ein Profil für einen Trainer ohne trainer_profiles-Eintrag an', async () => {
    supa.setRole('admin', 'club-1');
    supa.table('trainer_profiles', (state) => {
      if (state.op === 'insert') {
        return { data: profileRow('trainer-2', 'Anna Neu'), error: null };
      }
      return { data: [], error: null }; // keine bestehenden Profile
    });
    supa.table('user_club_memberships', () => ({
      data: [{ user_id: 'trainer-2', created_at: '2026-01-01', is_active: true }],
      error: null,
    }));
    supa.table('users', () => ({
      data: [
        { id: 'trainer-2', full_name: 'Anna Neu', email: 'anna@test.de', phone: '0176123456' },
      ],
      error: null,
    }));
    const res = await GET(profilesRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profiles).toHaveLength(1);
    expect(json.profiles[0].userId).toBe('trainer-2');
    expect(json.profiles[0].firstName).toBe('Anna');
  });
});
