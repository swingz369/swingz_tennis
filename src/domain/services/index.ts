/**
 * Domain Services Interfaces
 *
 * These interfaces define the contracts for external services
 * that the domain layer depends on. Implementations live in the
 * infrastructure layer.
 */

export * from './email.service.interface';
export * from './audit.service.interface';
export * from './cache.service.interface';
