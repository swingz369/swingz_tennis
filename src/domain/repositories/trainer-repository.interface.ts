import type { TrainerId, ClubId } from '../value-objects';
import type { Trainer } from '../entities/club';

export interface TrainerRepository {
  findById(id: TrainerId): Promise<Trainer | null>;
  findByEmail(email: string): Promise<Trainer | null>;
  findByClub(clubId: ClubId): Promise<Trainer[]>;
  findBySpecialty(specialty: string): Promise<Trainer[]>;
  save(trainer: Trainer): Promise<void>;
  exists(id: TrainerId): Promise<boolean>;
}
