import { AnimatedCounter } from '@/components/animations';
import { cn } from '@/lib/utils';

/** Time-of-day greeting based on the current hour in Germany (Europe/Berlin),
 *  independent of the server's own timezone (e.g. UTC on Vercel). */
function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('de-DE', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }).format(new Date())
  );
  if (hour < 11) return 'Guten Morgen';
  if (hour < 17) return 'Guten Tag';
  return 'Guten Abend';
}

interface PremiumAdminHeroProps {
  firstName: string;
  clubName: string;
  isSuperadmin: boolean;
  todaySessionCount: number;
}

/**
 * PremiumAdminHero — flat page topbar.
 *
 * Plain heading + one-line muted subtitle on the page background — no card
 * wrapper, no gradient, no decorative graphic. Matches the flat topbar
 * pattern used elsewhere (see `components/ui/page-header.tsx`).
 * Server Component — uses AnimatedCounter (client) for the count-up.
 */
export function PremiumAdminHero({
  firstName,
  clubName,
  isSuperadmin,
  todaySessionCount,
}: PremiumAdminHeroProps) {
  const todayLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  });
  const greeting = getGreeting();

  return (
    <div className="min-w-0">
      {/* Date + Role pill */}
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {todayLabel}
        </p>
        <span
          className={cn(
            'text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
            isSuperadmin
              ? 'bg-info-50 text-info-700 dark:bg-info-900/20 dark:text-info-300'
              : 'bg-[hsl(var(--brand-accent-dashboard)/0.1)] text-[hsl(var(--brand-accent-dashboard))]'
          )}
        >
          {isSuperadmin ? 'Superadmin' : 'Admin'}
        </span>
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-bold font-display text-foreground dark:text-white tracking-tight">
        {greeting}, {firstName}.
      </h1>

      {/* Subline with club context */}
      <p className="text-sm text-muted-foreground mt-0.5">
        <strong className="text-foreground dark:text-white font-semibold">{clubName}</strong> läuft
        — heute stehen{' '}
        <strong className="text-foreground dark:text-white font-semibold">
          <AnimatedCounter value={todaySessionCount} />
        </strong>{' '}
        {todaySessionCount === 1 ? 'Session' : 'Sessions'} auf dem Plan.
      </p>
    </div>
  );
}
