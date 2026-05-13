import type { MemberId, ClubId } from '../value-objects';

export interface Member {
  id: MemberId;
  email: string;
  name: string;
  clubIds: ClubId[];
  joinDate: Date;
  isActive: boolean;
}

export interface MemberRepository {
  findById(id: MemberId): Promise<Member | null>;
  findByEmail(email: string): Promise<Member | null>;
  findByClub(clubId: ClubId): Promise<Member[]>;
  save(member: Member): Promise<void>;
  exists(id: MemberId): Promise<boolean>;
  getMemberEmailAndName(id: MemberId): Promise<{ email: string; name: string } | null>;
}
