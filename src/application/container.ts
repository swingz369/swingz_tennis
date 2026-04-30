import { container } from 'tsyringe';

/**
 * Dependency Injection Container
 *
 * NOTE: Full DI implementation requires decorating all Use Cases with @injectable()
 * and using @inject() on constructor parameters for repository interfaces.
 *
 * Current state: Container exists as placeholder. API routes manually instantiate
 * repositories until Use Cases are properly decorated.
 *
 * When ready to enable DI:
 * 1. Add @injectable() to all Use Case classes
 * 2. Add @inject(REPOSITORY_TOKENS.Booking) to constructor parameters
 * 3. Register all repository implementations below
 * 4. Change API routes to: container.resolve(CreateBookingUseCase)
 */
export { container };
