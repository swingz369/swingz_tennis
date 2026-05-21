/**
 * Trainer Availability Service Adapter
 *
 * Drizzle-based trainer availability operations.
 */

import type {
  TrainerAvailability,
  AvailabilityConflict,
  CreateTrainerAvailabilityInput,
  UpdateTrainerAvailabilityInput,
  AvailabilityQuery,
} from '@/domain/entities/trainer-availability.entity';
import { TrainerAvailabilityService } from './trainer-availability.service';
import { DrizzleTrainerAvailabilityRepository } from '@/infrastructure/persistence/repositories/trainer-availability.repository';


class TrainerAvailabilityServiceAdapter {
  private repo = new DrizzleTrainerAvailabilityRepository();

  async createTrainerAvailability(
    input: CreateTrainerAvailabilityInput
  ): Promise<TrainerAvailability> {
    return this.repo.create(input);
  }

  async getTrainerAvailabilityById(id: string): Promise<TrainerAvailability | null> {
    return this.repo.findById(id);
  }

  async getTrainerAvailabilitiesByTrainerId(trainerId: string): Promise<TrainerAvailability[]> {
    return this.repo.findByTrainerId(trainerId);
  }

  async getAllTrainerAvailabilities(): Promise<TrainerAvailability[]> {
    return this.repo.findAll();
  }

  async queryTrainerAvailabilities(query: AvailabilityQuery): Promise<TrainerAvailability[]> {
    return this.repo.findByQuery(query);
  }

  async updateTrainerAvailability(
    id: string,
    input: UpdateTrainerAvailabilityInput
  ): Promise<TrainerAvailability | null> {
    return this.repo.update(id, input);
  }

  async markTrainerAvailabilityAsBooked(id: string): Promise<TrainerAvailability | null> {
    // markAsBooked only exists in the repository implementation
    return this.repo.markAsBooked(id);
  }

  async deleteTrainerAvailability(id: string): Promise<boolean> {
    await this.repo.delete(id);
    return true;
  }

  async checkForConflicts(
    trainerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<AvailabilityConflict[]> {
    return this.repo.checkForConflicts(trainerId, date, startTime, endTime, excludeId);
  }

  async getAvailabilityConflicts(
    startDate: string,
    endDate: string
  ): Promise<AvailabilityConflict[]> {
    // Delegates to in-memory service which has this method
    return TrainerAvailabilityService.getAvailabilityConflicts(startDate, endDate);
  }

  async getAvailableSlots(trainerId: string, date: string): Promise<TrainerAvailability[]> {
    // getAvailableSlots only exists in the repository implementation
    return this.repo.getAvailableSlots(trainerId, date);
  }


}

export const trainerAvailabilityService = new TrainerAvailabilityServiceAdapter();
