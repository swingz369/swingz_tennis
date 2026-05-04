import { container } from 'tsyringe';
import type { IEmailService, IAuditService } from '@/domain/services';

/**
 * Dependency Injection Container
 *
 * Registers all service implementations for the application.
 * Use Cases and API routes can resolve dependencies from this container.
 */

// Service tokens for DI
export const TOKENS = {
  EmailService: Symbol.for('IEmailService'),
  AuditService: Symbol.for('IAuditService'),
} as const;

/**
 * Register service implementations
 * These are registered lazily to avoid circular dependencies
 */
export function registerServices(): void {
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
}

// Auto-register services on import
registerServices();

export { container };
