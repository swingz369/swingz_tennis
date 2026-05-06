/**
 * Feature Flags for Gradual Repository Migration
 * Pattern from INTEGRATION_ROADMAP.md Phase 2
 *
 * Allows gradual rollout: Dev → Staging → 10% Prod → 100% Prod
 */

export const FEATURE_FLAGS = {
  /**
   * Use Drizzle Repositories instead of in-memory services
   *
   * false: Use in-memory arrays (current)
   * true: Use Drizzle ORM with PostgreSQL
   */
  USE_DRIZZLE_REPOS: process.env.USE_DRIZZLE_REPOS === 'true',

  /**
   * Individual repository flags for granular control
   */
  USE_MEMBER_REPOSITORY: process.env.USE_MEMBER_REPOSITORY === 'true',
  USE_BOOKING_REPOSITORY: process.env.USE_BOOKING_REPOSITORY === 'true',
  USE_SESSION_REPOSITORY: process.env.USE_SESSION_REPOSITORY === 'true',
  USE_COURT_REPOSITORY: process.env.USE_COURT_REPOSITORY === 'true',
  USE_INVOICE_REPOSITORY: process.env.USE_INVOICE_REPOSITORY === 'true',

  /**
   * Rollout percentage (0-100)
   * Used for A/B testing in production
   */
  DRIZZLE_ROLLOUT_PERCENTAGE: parseInt(process.env.DRIZZLE_ROLLOUT_PERCENTAGE || '0', 10),
} as const;

/**
 * Check if user is in rollout group
 * Uses deterministic hashing for consistent experience
 */
export function isInRollout(userId: string): boolean {
  if (FEATURE_FLAGS.DRIZZLE_ROLLOUT_PERCENTAGE === 0) return false;
  if (FEATURE_FLAGS.DRIZZLE_ROLLOUT_PERCENTAGE >= 100) return true;

  // Simple hash function for deterministic bucketing
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const bucket = Math.abs(hash) % 100;
  return bucket < FEATURE_FLAGS.DRIZZLE_ROLLOUT_PERCENTAGE;
}

/**
 * Helper to determine which repository implementation to use
 */
export function shouldUseDrizzleRepo(
  repoType: 'member' | 'booking' | 'session' | 'court' | 'invoice',
  userId?: string
): boolean {
  // Global flag overrides everything
  if (FEATURE_FLAGS.USE_DRIZZLE_REPOS) return true;

  // Individual repo flags
  const repoFlags = {
    member: FEATURE_FLAGS.USE_MEMBER_REPOSITORY,
    booking: FEATURE_FLAGS.USE_BOOKING_REPOSITORY,
    session: FEATURE_FLAGS.USE_SESSION_REPOSITORY,
    court: FEATURE_FLAGS.USE_COURT_REPOSITORY,
    invoice: FEATURE_FLAGS.USE_INVOICE_REPOSITORY,
  };

  if (repoFlags[repoType]) return true;

  // Rollout percentage (if userId provided)
  if (userId && FEATURE_FLAGS.DRIZZLE_ROLLOUT_PERCENTAGE > 0) {
    return isInRollout(userId);
  }

  return false;
}

/**
 * Usage example in API route:
 *
 * ```ts
 * import { shouldUseDrizzleRepo } from '@/lib/feature-flags';
 * import { DrizzleMemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
 * import { MemberService } from '@/application/services/member.service';
 *
 * export async function GET(req: NextRequest) {
 *   const { user } = await requireAuth();
 *
 *   let members;
 *   if (shouldUseDrizzleRepo('member', user.id)) {
 *     // NEW: Use repository
 *     const repo = new DrizzleMemberRepository();
 *     members = await repo.findByClub(clubId);
 *   } else {
 *     // OLD: Use in-memory service
 *     members = await MemberService.getByClub(clubId);
 *   }
 *
 *   return NextResponse.json(members);
 * }
 * ```
 */
