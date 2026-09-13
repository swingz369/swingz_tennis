/**
 * Mitglieder-Teildomäne "Mitgliederliste je Verein" für ADR-005 (Domäne 3,
 * Teil 2, nach Gruppen). Ein Repository, keine Zeremonie — Muster in
 * docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6. RLS
 * (memberships_select/memberships_manage_admin auf user_club_memberships,
 * "Members can view club members" auf users) war hier bereits korrekt
 * gescoped, keine Policy-Korrektur nötig.
 *
 * Nur findByClub() migriert — findById/findByEmail/save/exists/
 * getMemberEmailAndName hatten keinen einzigen Aufrufer im Code.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { ClubId } from '@/domain/value-objects';
import { MemberId } from '@/domain/value-objects';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:member.repository');

export interface Member {
  id: MemberId;
  email: string;
  name: string;
  clubIds: ClubId[];
  joinDate: Date;
  isActive: boolean;
}

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class MemberRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findByClub(clubId: ClubId): Promise<Member[]> {
    const { data: memberships, error: membershipError } = await this.db
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId.getValue())
      .eq('is_active', true);
    assertNoError(membershipError, 'Lesen der Mitgliedschaften fehlgeschlagen');

    const userIds = (memberships ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return [];

    const { data: users, error: usersError } = await this.db
      .from('users')
      .select('id, email, full_name, created_at')
      .in('id', userIds);
    assertNoError(usersError, 'Lesen der Mitglieder fehlgeschlagen');

    return (users ?? []).map((user) => ({
      id: MemberId.fromString(user.id),
      email: user.email,
      name: user.full_name ?? '',
      clubIds: [clubId],
      joinDate: new Date(user.created_at),
      isActive: true,
    }));
  }
}
