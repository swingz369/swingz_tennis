import type { Club } from '../entities/club';
import type { ClubId, MemberId } from '../value-objects';

export interface ClubRepository {
  findById(id: ClubId): Promise<Club | null>;
  findByName(name: string): Promise<Club | null>;
  save(club: Club): Promise<void>;
  delete(id: ClubId): Promise<void>;
  findAll(): Promise<Club[]>;
  findByMemberId(memberId: MemberId): Promise<Club[]>;
  exists(id: ClubId): Promise<boolean>;

  // Analytics
  getMemberStats(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<{ total: number; new: number; active: number }>;

  // Member growth over time (monthly active counts)
  getMemberGrowthHistory(
    clubId: ClubId,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ month: string; count: number }>>;
}
