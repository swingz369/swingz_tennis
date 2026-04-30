export type AuditAction =
  | 'booking_created'
  | 'booking_cancelled'
  | 'booking_status_changed'
  | 'member_created'
  | 'member_activated'
  | 'member_deactivated'
  | 'member_updated'
  | 'member_invited'
  | 'role_changed'
  | 'reminder_sent'
  | 'club_created'
  | 'club_updated'
  | 'club_deleted'
  | 'trainer_created'
  | 'trainer_updated'
  | 'trainer_deleted'
  | 'session_created'
  | 'session_updated'
  | 'session_deleted'
  | 'login_success'
  | 'login_failed'
  | 'permission_denied';

export type AuditResourceType = 'booking' | 'member' | 'club' | 'trainer' | 'session' | 'user';

export interface AuditDetails {
  [key: string]: unknown;
}

import { Id } from '@/domain/value-objects/ids';

export class AuditLog {
  private readonly id: Id;
  private readonly actorId: Id;
  private readonly action: AuditAction;
  private readonly resourceType: AuditResourceType;
  private readonly resourceId: Id;
  private readonly details: AuditDetails;
  private readonly ipAddress?: string | undefined;
  private readonly userAgent?: string | undefined;
  private readonly createdAt: Date;

  private constructor(
    id: Id,
    actorId: Id,
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: Id,
    details: AuditDetails,
    ipAddress?: string,
    userAgent?: string,
    createdAt?: Date
  ) {
    this.id = id;
    this.actorId = actorId;
    this.action = action;
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.details = details;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.createdAt = createdAt ?? new Date();
  }

  public static create(
    actorId: Id,
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: Id,
    details: AuditDetails = {},
    ipAddress?: string,
    userAgent?: string
  ): AuditLog {
    return new AuditLog(
      Id.create(),
      actorId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent
    );
  }

  public static reconstitute(
    id: Id,
    actorId: Id,
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: Id,
    details: AuditDetails,
    createdAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): AuditLog {
    return new AuditLog(
      id,
      actorId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
      createdAt
    );
  }

  public getId(): Id {
    return this.id;
  }

  public getActorId(): Id {
    return this.actorId;
  }

  public getAction(): AuditAction {
    return this.action;
  }

  public getResourceType(): AuditResourceType {
    return this.resourceType;
  }

  public getResourceId(): Id {
    return this.resourceId;
  }

  public getDetails(): AuditDetails {
    return this.details;
  }

  public getIpAddress(): string | undefined {
    return this.ipAddress;
  }

  public getUserAgent(): string | undefined {
    return this.userAgent;
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }
}
