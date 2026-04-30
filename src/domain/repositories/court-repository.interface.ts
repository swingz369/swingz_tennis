import type { ClubId } from '../value-objects';
import type { Court } from '../entities/club';

export interface CourtRepository {
  findById(id: string): Promise<Court | null>;
  findByClub(clubId: ClubId): Promise<Court[]>;
  save(court: Court): Promise<void>;
  exists(id: string): Promise<boolean>;
}
