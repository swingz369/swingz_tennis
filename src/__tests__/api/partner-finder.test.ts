/**
 * Verhaltens-Tests für GET /api/partner-finder — Auth-/Rollen-/Club-Scoping
 * und die grobe Antwortform (Komplexität 46, tokensave test_risk:
 * ungetestet, 16.09.2026). Das reine Scoring-Helper `availabilitySlots` hat
 * bereits eigene Tests in partner-finder-availability.test.ts — hier geht es
 * nur um den GET-Handler selbst.
 *
 * Die Route ruft auf `auth.supabase` u. a. `.contains('member_ids', […])`
 * auf (Gruppen-Query) — eine Filtermethode, die der generische Chain-Builder
 * in ../helpers/api-route.ts nicht kennt (nur eq/neq/in/gte/lte). Deshalb
 * hier ein eigener, kleiner Proxy-Chain, der JEDE Supabase-Filtermethode
 * generisch chaint, statt sie einzeln nachzubauen. `installSupabaseMock()`
 * bleibt im Einsatz für Rollen-/Club-Auflösung (resolveActiveClub-Mock);
 * das `@supabase/ssr`-Mock wird danach bewusst mit der eigenen, generischen
 * Variante überschrieben (letzter `vi.doMock`-Aufruf gewinnt).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installSupabaseMock, makeApiRequest } from '../helpers/api-route';

const supa = installSupabaseMock();

type Handler = (state: { filters: Record<string, unknown> }) => { data: unknown; error: unknown };

let localRole: 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member' = 'admin';
let localClubId: string | null = 'club-1';
let tableHandlers: Record<string, Handler> = {};

function setRole(role: typeof localRole, clubId: string | null) {
  supa.setRole(role, clubId);
  localRole = role;
  localClubId = clubId;
}

/**
 * Generischer Chain-Proxy: jede Filtermethode (eq, in, contains, gte, …)
 * chaint weiter UND trägt ihr erstes Argument als Filter ein — so kann ein
 * Table-Handler unten grob unterscheiden, welche Query gerade läuft (z. B.
 * `.eq('id', x)` vs. `.in('id', [x, y])`), ohne dass jede Methode einzeln
 * nachgebaut werden muss.
 */
function genericChain(
  state: { filters: Record<string, unknown> },
  resolve: () => Promise<{ data: unknown; error: unknown }>
) {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') return (onF: any, onR: any) => resolve().then(onF, onR);
        if (prop === 'single' || prop === 'maybeSingle') return () => resolve();
        return (col?: unknown, val?: unknown) => {
          if (typeof col === 'string') state.filters[col] = val;
          return chain;
        };
      },
    }
  );
  return chain;
}

function tableChain(table: string) {
  const state = { filters: {} as Record<string, unknown> };
  const handler = tableHandlers[table] ?? (() => ({ data: null, error: null }));
  return genericChain(state, () => Promise.resolve(handler(state)));
}

vi.doMock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'user_club_memberships') {
        return genericChain({ filters: {} }, () =>
          Promise.resolve({ data: [{ club_id: localClubId, role: localRole }], error: null })
        );
      }
      return tableChain(table);
    }),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}));

vi.doMock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => tableChain(table) }),
}));

const { GET } = await import('@/app/api/partner-finder/route');

function request() {
  return makeApiRequest('http://localhost/api/partner-finder');
}

describe('GET /api/partner-finder', () => {
  beforeEach(() => {
    supa.reset();
    tableHandlers = {};
    setRole('admin', 'club-1');
  });

  it('lehnt Plattform-Staff ohne eigene Spieler-Mitgliedschaft ab (Owner sucht nicht selbst)', async () => {
    setRole('owner', null);
    const res = await GET(request());
    expect(res.status).toBe(403);
  });

  it('liefert 404 ohne aktive Vereinsmitgliedschaft', async () => {
    setRole('member', null);
    const res = await GET(request());
    expect(res.status).toBe(404);
  });

  it('liefert Matches nur aus dem eigenen Club, mit dem eigenen Skill-Level als Grundlage', async () => {
    setRole('member', 'club-1');

    tableHandlers.users = (state) => {
      // Kandidaten-Query filtert per .in('id', [...]) — dort ist der Filterwert ein Array.
      if (Array.isArray(state.filters.id)) {
        return {
          data: [{ id: 'user-2', full_name: 'Partner Kandidat', skill_level: 'beginner' }],
          error: null,
        };
      }
      // Eigenes Profil: .eq('id', userId).single()
      return { data: { skill_level: 'beginner' }, error: null };
    };
    tableHandlers.groups = () => ({ data: [], error: null });
    tableHandlers.bookings = () => ({ data: [], error: null });
    tableHandlers.user_training_preferences = () => ({ data: [], error: null });
    tableHandlers.user_club_memberships = () => ({ data: [{ user_id: 'user-2' }], error: null });

    const res = await GET(request());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.myLevel).toBe('beginner');
    expect(json.totalMembers).toBe(1);
    expect(json.matches).toHaveLength(1);
    expect(json.matches[0]).toMatchObject({ userId: 'user-2', name: 'Partner Kandidat' });
  });

  it('liefert eine leere Matches-Liste, wenn der Club keine weiteren Mitglieder hat', async () => {
    setRole('member', 'club-1');
    tableHandlers.user_club_memberships = () => ({ data: [], error: null });

    const res = await GET(request());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matches).toEqual([]);
  });
});
