import 'reflect-metadata';
import { container } from 'tsyringe';
import type { IEmailService, IAuditService } from '@/domain/services';
import type { BookingRepository } from '@/domain/repositories/booking-repository.interface';
import type { MemberRepository } from '@/domain/repositories/member-repository.interface';
import type { ClubRepository } from '@/domain/repositories/club-repository.interface';
import type { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import type { TrainerRepository } from '@/domain/repositories/trainer-repository.interface';
import type { CourtRepository } from '@/domain/repositories/court-repository.interface';
import type { GroupRepository } from '@/domain/repositories/group-repository.interface';
import type { PricingRuleRepository } from '@/domain/repositories/pricing-rule-repository.interface';

/**
 * Dependency Injection Container
 *
 * Registers all service implementations and repositories for the application.
 * Use Cases and API routes can resolve dependencies from this container.
 */

// Service tokens for DI
export const TOKENS = {
  // Services
  EmailService: Symbol.for('IEmailService'),
  AuditService: Symbol.for('IAuditService'),
  // Repositories
  BookingRepository: Symbol.for('BookingRepository'),
  MemberRepository: Symbol.for('MemberRepository'),
  ClubRepository: Symbol.for('ClubRepository'),
  ScheduleRepository: Symbol.for('ScheduleRepository'),
  TrainerRepository: Symbol.for('TrainerRepository'),
  CourtRepository: Symbol.for('CourtRepository'),
  GroupRepository: Symbol.for('GroupRepository'),
  PricingRuleRepository: Symbol.for('PricingRuleRepository'),
} as const;

let isRegistered = false;

/**
 * Register all services and repositories
 * Uses lazy loading to avoid circular dependencies
 */
export function registerServices(): void {
  if (isRegistered) return;
  isRegistered = true;

  // Register EmailService
  container.register<IEmailService>(TOKENS.EmailService, {
    useFactory: () => {
      const { EmailService } = require('@/infrastructure/email/email.service');
      return new EmailService();
    },
  });

  // Register AuditService
  container.register<IAuditService>(TOKENS.AuditService, {
    useFactory: () => {
      const { AuditServiceImpl } = require('@/infrastructure/audit/audit.service');
      return new AuditServiceImpl();
    },
  });

  // Register Repositories
  container.register<BookingRepository>(TOKENS.BookingRepository, {
    useFactory: () => {
      const {
        DrizzleBookingRepository,
      } = require('@/infrastructure/persistence/repositories/booking.repository');
      return new DrizzleBookingRepository();
    },
  });

  container.register<MemberRepository>(TOKENS.MemberRepository, {
    useFactory: () => {
      const {
        DrizzleMemberRepository,
      } = require('@/infrastructure/persistence/repositories/member.repository');
      return new DrizzleMemberRepository();
    },
  });

  container.register<ClubRepository>(TOKENS.ClubRepository, {
    useFactory: () => {
      const {
        DrizzleClubRepository,
      } = require('@/infrastructure/persistence/repositories/club.repository');
      return new DrizzleClubRepository();
    },
  });

  container.register<ScheduleRepository>(TOKENS.ScheduleRepository, {
    useFactory: () => {
      const {
        DrizzleScheduleRepository,
      } = require('@/infrastructure/persistence/repositories/schedule.repository');
      return new DrizzleScheduleRepository();
    },
  });

  container.register<TrainerRepository>(TOKENS.TrainerRepository, {
    useFactory: () => {
      const {
        DrizzleTrainerRepository,
      } = require('@/infrastructure/persistence/repositories/trainer.repository');
      return new DrizzleTrainerRepository();
    },
  });

  container.register<CourtRepository>(TOKENS.CourtRepository, {
    useFactory: () => {
      const {
        DrizzleCourtRepository,
      } = require('@/infrastructure/persistence/repositories/court.repository');
      return new DrizzleCourtRepository();
    },
  });

  container.register<GroupRepository>(TOKENS.GroupRepository, {
    useFactory: () => {
      const {
        DrizzleGroupRepository,
      } = require('@/infrastructure/persistence/repositories/group.repository');
      return new DrizzleGroupRepository();
    },
  });

  container.register<PricingRuleRepository>(TOKENS.PricingRuleRepository, {
    useFactory: () => {
      const {
        DrizzlePricingRuleRepository,
      } = require('@/infrastructure/persistence/repositories/pricing-rule.repository');
      return new DrizzlePricingRuleRepository();
    },
  });
}

// Auto-register services on import
registerServices();

export { container };
