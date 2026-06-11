export interface TrainerQualification {
  id: string;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  certificateUrl?: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface TrainerSpecialization {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
}

export interface TrainerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  bio?: string;
  profileImageUrl?: string;
  qualifications: TrainerQualification[];
  specializations: TrainerSpecialization[];
  experience: {
    years: number;
    previousClubs: string[];
    achievements: string[];
  };
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hourlyRate?: number;
  /** EUR/h — contractually agreed rate. Admin-only write, read-only for the trainer. */
  contractedHourlyRate?: number | null;
  /** EUR/h — rate the trainer can set for extra hours beyond the contract. Trainer + Admin editable. */
  extraHoursRate?: number | null;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  preferredTimeSlots: {
    start: string;
    end: string;
  }[];
  languages: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainerProfileInput {
  userId: string;
  clubId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  bio?: string;
  qualifications?: Omit<TrainerQualification, 'id' | 'verified' | 'verifiedAt' | 'verifiedBy'>[];
  specializations?: Omit<TrainerSpecialization, 'id'>[];
  experience?: {
    years: number;
    previousClubs: string[];
    achievements: string[];
  };
  preferredTimeSlots?: {
    start: string;
    end: string;
  }[];
  languages?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface UpdateTrainerProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  profileImageUrl?: string;
  qualifications?: TrainerQualification[];
  specializations?: TrainerSpecialization[];
  experience?: {
    years: number;
    previousClubs: string[];
    achievements: string[];
  };
  status?: TrainerProfile['status'];
  hourlyRate?: number;
  contractedHourlyRate?: number | null;
  extraHoursRate?: number | null;
  availability?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  preferredTimeSlots?: {
    start: string;
    end: string;
  }[];
  languages?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}
