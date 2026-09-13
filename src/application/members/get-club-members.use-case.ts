import type { MemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import { ClubId } from '@/domain/value-objects';

export interface ClubMember {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  status: 'active' | 'inactive';
}

export class GetClubMembersUseCase {
  constructor(
    private memberRepository: MemberRepository,
    private clubRepository: ClubRepository
  ) {}

  async execute(clubId: string): Promise<ClubMember[]> {
    const club = await this.clubRepository.findById(ClubId.fromString(clubId));
    if (!club) {
      throw new Error('Club not found');
    }

    const members = await this.memberRepository.findByClub(ClubId.fromString(clubId));

    return members.map((m) => ({
      id: m.id.getValue(),
      name: m.name,
      email: m.email,
      joinDate: m.joinDate.toISOString().split('T')[0],
      status: m.isActive ? 'active' : 'inactive',
    }));
  }
}

export function getClubMembersUseCase(
  memberRepository: MemberRepository,
  clubRepository: ClubRepository
) {
  return new GetClubMembersUseCase(memberRepository, clubRepository);
}
