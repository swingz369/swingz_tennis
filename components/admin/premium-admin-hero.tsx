import { AnimatedCounter } from '@/components/animations';
import { TennisBallSvg } from './tennis-ball-svg';

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
 * PremiumAdminHero — Glass-panel hero on a dual-aurora background.
 *
 * Mirrors the landing-page hero language but in compact dashboard scale.
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
    <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-3xl mb-6 isolate">
      {/* ── Aurora background ── */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 20% 0%, hsl(var(--brand-primary-light) / 0.35) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 90% 100%, hsl(var(--brand-accent) / 0.18) 0%, transparent 55%),
            linear-gradient(135deg, hsl(150 55% 10%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 8%) 100%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Floating blur orbs */}
      <div className="absolute inset-0 overflow-hidden -z-10 opacity-60" aria-hidden="true">
        <div className="absolute top-[-10%] right-[20%] w-72 h-72 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
        <div
          className="absolute bottom-[-30%] left-[-10%] w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl animate-aurora"
          style={{ animationDelay: '7s' }}
        />
      </div>

      {/* Subtle noise for tactile depth */}
      <div className="absolute inset-0 noise opacity-[0.04] -z-10" aria-hidden="true" />

      {/* Partially clipped floating tennis ball (anchor the brand motif) */}
      <div
        className="absolute -right-20 -top-24 hidden md:block pointer-events-none -z-10"
        aria-hidden="true"
      >
        <div className="animate-float opacity-90">
          <TennisBallSvg width={320} height={320} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-10 text-white">
        <div className="flex flex-col gap-2 max-w-2xl">
          {/* Date + Role pill */}
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {todayLabel}
            </p>
            <span
              className={`text-2xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm ${
                isSuperadmin
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                  : 'bg-brand-accent/20 text-orange-200 border border-brand-accent/40'
              }`}
            >
              {isSuperadmin ? 'Superadmin' : 'Admin'}
            </span>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold tracking-tight leading-tight">
            {greeting},{' '}
            <span className="text-gradient-primary bg-clip-text text-transparent">
              {firstName}.
            </span>
          </h1>

          {/* Subline with club context */}
          <p className="text-base sm:text-lg text-white/70 max-w-xl leading-relaxed mt-1">
            <strong className="text-white font-semibold">{clubName}</strong> läuft – heute stehen{' '}
            <strong className="text-white font-semibold">
              <AnimatedCounter value={todaySessionCount} />
            </strong>{' '}
            {todaySessionCount === 1 ? 'Session' : 'Sessions'} auf dem Plan.
          </p>
        </div>
      </div>
    </div>
  );
}
