import { GroupId } from '../value-objects/ids';
import type { ClubId, MemberId } from '../value-objects/ids';

export type GroupLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type GroupAgeGroup = 'junior' | 'senior';

export interface Group {
  // Properties
  readonly id: GroupId;
  readonly clubId: ClubId;
  readonly name: string;
  readonly description?: string;
  readonly level: GroupLevel;
  readonly ageGroup: GroupAgeGroup;
  readonly isActive: boolean;
  readonly memberIds: MemberId[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Getters (optional direct access works too, but we provide methods for consistency)
  getId(): GroupId;
  getClubId(): ClubId;
  getName(): string;
  getDescription(): string | undefined;
  getLevel(): GroupLevel;
  getAgeGroup(): GroupAgeGroup;
  getIsActive(): boolean;
  getMemberIds(): MemberId[];
  getMemberCount(): number;
  getCreatedAt(): Date;
  getUpdatedAt(): Date;

  // Mutators
  setName(name: string): void;
  setDescription(description?: string): void;
  activate(): void;
  deactivate(): void;
  addMember(memberId: MemberId): void;
  removeMember(memberId: MemberId): void;
}

export class GroupEntity implements Group {
  public id: GroupId;
  public clubId: ClubId;
  public name: string;
  public description?: string;
  public level: GroupLevel;
  public ageGroup: GroupAgeGroup;
  public isActive: boolean;
  public memberIds: MemberId[];
  public createdAt: Date;
  public updatedAt: Date;

  private constructor(
    id: GroupId,
    clubId: ClubId,
    name: string,
    level: GroupEntity['level'],
    ageGroup: GroupEntity['ageGroup'],
    description?: string
  ) {
    this.id = id;
    this.clubId = clubId;
    this.name = name;
    this.description = description;
    this.level = level;
    this.ageGroup = ageGroup;
    this.isActive = true;
    this.memberIds = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public static create(
    clubId: ClubId,
    name: string,
    level: GroupEntity['level'],
    ageGroup: GroupEntity['ageGroup'],
    description?: string
  ): GroupEntity {
    return new GroupEntity(GroupId.create(), clubId, name, level, ageGroup, description);
  }

  public static reconstitute(
    id: GroupId,
    clubId: ClubId,
    name: string,
    level: GroupEntity['level'],
    ageGroup: GroupEntity['ageGroup'],
    description?: string,
    isActive: boolean = true,
    memberIds: MemberId[] = [],
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ): GroupEntity {
    const group = new GroupEntity(id, clubId, name, level, ageGroup, description);
    group.isActive = isActive;
    group.memberIds = memberIds;
    group.createdAt = createdAt;
    group.updatedAt = updatedAt;
    return group;
  }

  public getName(): string {
    return this.name;
  }

  public setName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Group name cannot be empty');
    }
    this.name = name.trim();
    this.updatedAt = new Date();
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public setDescription(description?: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  public getLevel(): GroupLevel {
    return this.level;
  }

  public getAgeGroup(): GroupAgeGroup {
    return this.ageGroup;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  public getMemberIds(): MemberId[] {
    return [...this.memberIds];
  }

  public addMember(memberId: MemberId): void {
    if (!this.memberIds.find((id) => id.equals(memberId))) {
      this.memberIds.push(memberId);
      this.updatedAt = new Date();
    }
  }

  public removeMember(memberId: MemberId): void {
    this.memberIds = this.memberIds.filter((id) => !id.equals(memberId));
    this.updatedAt = new Date();
  }

  public getMemberCount(): number {
    return this.memberIds.length;
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  public getUpdatedAt(): Date {
    return new Date(this.updatedAt);
  }

  public getId(): GroupId {
    return this.id;
  }

  public getClubId(): ClubId {
    return this.clubId;
  }
}
