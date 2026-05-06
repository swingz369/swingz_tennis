/**
 * Trainer Availability Service Adapter
 *
 * Switches between in-memory and repository pattern based on USE_TRAINER_REPOSITORY flag.
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
import { FeatureFlags } from '@/lib/features/feature-flags';

class TrainerAvailabilityServiceAdapter {
  private repo = new DrizzleTrainerAvailabilityRepository();

  async createTrainerAvailability(
    input: CreateTrainerAvailabilityInput
  ): Promise<TrainerAvailability> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.create(input);
    }
    return TrainerAvailabilityService.createTrainerAvailability(input);
  }

  async getTrainerAvailabilityById(id: string): Promise<TrainerAvailability | null> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.findById(id);
    }
    return TrainerAvailabilityService.getTrainerAvailabilityById(id);
  }

  async getTrainerAvailabilitiesByTrainerId(trainerId: string): Promise<TrainerAvailability[]> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.findByTrainerId(trainerId);
    }
    return TrainerAvailabilityService.getTrainerAvailabilitiesByTrainerId(trainerId);
  }

  async getAllTrainerAvailabilities(): Promise<TrainerAvailability[]> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.findAll();
    }
    return TrainerAvailabilityService.getAllTrainerAvailabilities();
  }

  async queryTrainerAvailabilities(query: AvailabilityQuery): Promise<TrainerAvailability[]> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.findByQuery(query);
    }
    return TrainerAvailabilityService.queryTrainerAvailabilities(query);
  }

  async updateTrainerAvailability(
    id: string,
    input: UpdateTrainerAvailabilityInput
  ): Promise<TrainerAvailability | null> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.update(id, input);
    }
    return TrainerAvailabilityService.updateTrainerAvailability(id, input);
  }

  async markTrainerAvailabilityAsBooked(id: string): Promise<TrainerAvailability | null> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.markAsBooked(id);
    }
    return TrainerAvailabilityService.markTrainerAvailabilityAsBooked(id);
  }

  async deleteTrainerAvailability(id: string): Promise<boolean> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      await this.repo.delete(id);
      return true;
    }
    return TrainerAvailabilityService.deleteTrainerAvailability(id);
  }

  async checkForConflicts(
    trainerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<AvailabilityConflict[]> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.checkForConflicts(trainerId, date, startTime, endTime, excludeId);
    }
    return TrainerAvailabilityService.checkForConflicts(
      trainerId,
      date,
      startTime,
      endTime,
      excludeId
    );
  }

  async getAvailableSlots(trainerId: string, date: string): Promise<TrainerAvailability[]> {
    if (FeatureFlags.USE_TRAINER_REPOSITORY) {
      return this.repo.getAvailableSlots(trainerId, date);
    }
    return TrainerAvailabilityService.getAvailableSlots(trainerId, date);
  }

  isUsingRepository(): boolean {
    return FeatureFlags.USE_TRAINER_REPOSITORY;
  }
}

export const trainerAvailabilityService = new TrainerAvailabilityServiceAdapter();
