export interface TrainerAvailability {
  id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'unavailable' | 'booked' | 'blocked';
  notes?: string;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityConflict {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string;
  startTime: string;
  endTime: string;
  conflictType: 'overlap' | 'double_booking' | 'unavailable';
  conflictingWith: string[];
}

export interface CreateTrainerAvailabilityInput {
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: 'available' | 'unavailable' | 'blocked';
  notes?: string;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  };
}

export interface UpdateTrainerAvailabilityInput {
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: 'available' | 'unavailable' | 'booked' | 'blocked';
  notes?: string;
}

export interface AvailabilityQuery {
  trainerId?: string;
  startDate?: string;
  endDate?: string;
  status?: TrainerAvailability['status'];
}
