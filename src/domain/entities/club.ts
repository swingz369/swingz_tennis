import { ClubId } from '../value-objects';
import type { TrainerId, MemberId } from '../value-objects';

export interface ClubMember {
  memberId: MemberId;
  joinDate: Date;
  isActive: boolean;
}

export interface Trainer {
  trainerId: TrainerId;
  name: string;
  email: string;
  specialties: string[];
  maxHoursPerWeek: number;
  clubIds: ClubId[];
  isActive: boolean;
}

export interface Court {
  id: string;
  name: string;
  surface: 'clay' | 'grass' | 'hard' | 'carpet';
  hasIndoor: boolean;
  isActive: boolean;
}

export type ClubStatus = 'active' | 'inactive' | 'suspended';

export class Club {
  private readonly id: ClubId;
  private name: string;
  private members: Map<MemberId, ClubMember>;
  private trainers: Map<TrainerId, Trainer>;
  private courts: Court[];
  private maxMembers: number;
  private openingHours: {
    monday: { open: string; close: string; closed?: boolean };
    tuesday: { open: string; close: string; closed?: boolean };
    wednesday: { open: string; close: string; closed?: boolean };
    thursday: { open: string; close: string; closed?: boolean };
    friday: { open: string; close: string; closed?: boolean };
    saturday: { open: string; close: string; closed?: boolean };
    sunday: { open: string; close: string; closed?: boolean };
  };
  private status: ClubStatus;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(
    id: ClubId,
    name: string,
    maxMembers: number,
    openingHours: Club['openingHours']
  ) {
    this.id = id;
    this.name = name;
    this.maxMembers = maxMembers;
    this.openingHours = openingHours;
    this.members = new Map();
    this.trainers = new Map();
    this.courts = [];
    this.status = 'active';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public static create(name: string, maxMembers: number, openingHours: Club['openingHours']): Club {
    if (!name || name.trim().length === 0) {
      throw new Error('Club name is required');
    }
    if (maxMembers <= 0) {
      throw new Error('Max members must be positive');
    }
    return new Club(ClubId.create(), name.trim(), maxMembers, openingHours);
  }

  public static reconstitute(
    id: ClubId,
    name: string,
    members: ClubMember[],
    trainers: Trainer[],
    courts: Court[],
    maxMembers: number,
    openingHours: Club['openingHours'],
    status: ClubStatus,
    createdAt: Date,
    updatedAt: Date
  ): Club {
    const club = new Club(id, name, maxMembers, openingHours);
    club.status = status;
    club.createdAt = createdAt;
    club.updatedAt = updatedAt;
    club.members = new Map(members.map((m) => [m.memberId, m]));
    club.trainers = new Map(trainers.map((t) => [t.trainerId, t]));
    club.courts = courts;
    return club;
  }

  public getId(): ClubId {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public setName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Club name cannot be empty');
    }
    this.name = name.trim();
    this.updatedAt = new Date();
  }

  public getMaxMembers(): number {
    return this.maxMembers;
  }

  public setMaxMembers(maxMembers: number): void {
    if (maxMembers <= 0) {
      throw new Error('Max members must be positive');
    }
    this.maxMembers = maxMembers;
    this.updatedAt = new Date();
  }

  public getOpeningHours(): Club['openingHours'] {
    return this.openingHours;
  }

  public setOpeningHours(openingHours: Club['openingHours']): void {
    this.openingHours = openingHours;
    this.updatedAt = new Date();
  }

  public getMembers(): MemberId[] {
    return Array.from(this.members.keys());
  }

  public addMember(memberId: MemberId, joinDate: Date = new Date()): void {
    if (this.members.has(memberId)) {
      throw new Error('Member already exists in club');
    }
    if (this.members.size >= this.maxMembers) {
      throw new Error('Club has reached maximum member capacity');
    }
    this.members.set(memberId, {
      memberId,
      joinDate,
      isActive: true,
    });
    this.updatedAt = new Date();
  }

  public removeMember(memberId: MemberId): void {
    if (!this.members.has(memberId)) {
      throw new Error('Member not found in club');
    }
    this.members.delete(memberId);
    this.updatedAt = new Date();
  }

  public isMember(memberId: MemberId): boolean {
    return this.members.has(memberId) && this.members.get(memberId)!.isActive;
  }

  public getTrainers(): Trainer[] {
    return Array.from(this.trainers.values()).filter((t) => t.isActive);
  }

  public addTrainer(trainer: Trainer): void {
    if (this.trainers.has(trainer.trainerId)) {
      throw new Error('Trainer already exists in club');
    }
    this.trainers.set(trainer.trainerId, trainer);
    this.updatedAt = new Date();
  }

  public removeTrainer(trainerId: TrainerId): void {
    if (!this.trainers.has(trainerId)) {
      throw new Error('Trainer not found in club');
    }
    this.trainers.delete(trainerId);
    this.updatedAt = new Date();
  }

  public getActiveTrainerCount(): number {
    return Array.from(this.trainers.values()).filter((t) => t.isActive).length;
  }

  public getCourts(): Court[] {
    return this.courts.filter((c) => c.isActive);
  }

  public addCourt(court: Court): void {
    this.courts.push(court);
    this.updatedAt = new Date();
  }

  public getStatus(): ClubStatus {
    return this.status;
  }

  public activate(): void {
    this.status = 'active';
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.status = 'inactive';
    this.updatedAt = new Date();
  }

  public setStatus(status: ClubStatus): void {
    this.status = status;
    this.updatedAt = new Date();
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  public getUpdatedAt(): Date {
    return new Date(this.updatedAt);
  }

  public getMemberCount(): number {
    return this.members.size;
  }
}
