/**
 * src/__tests__/helpers/auth.ts — gemeinsamer fakeAuth()-Helper für Service-Unit-Tests
 *
 * War bis 16.09.2026 identisch dupliziert in 9 `*.service.test.ts`-Dateien
 * (per tokensave-Redundanzscan gefunden, AST-isomorph, similarity 1.0).
 */
import type { AuthContext } from '@/lib/api-auth';

export function fakeAuth(clubId: string | null = 'club-1'): AuthContext {
  return {
    user: { id: 'user-1' } as AuthContext['user'],
    session: null,
    supabase: {} as AuthContext['supabase'],
    clubId,
    role: 'admin',
    roles: ['admin'],
    memberships: [{ club_id: clubId, role: 'admin' }],
  };
}
