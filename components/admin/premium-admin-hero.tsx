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
  role: 'owner' | 'superadmin' | 'admin';
  todaySessionCount: number;
  /** Offene + überfällige Rechnungen. 0 blendet den Satzteil aus. */
  openInvoiceCount: number;
  /** Davon überfällig — entscheidet, ob die Zeile „fällig" oder „überfällig" sagt. */
  overdueInvoiceCount: number;
  /** Nächste Fälligkeit über alle offenen Rechnungen (ISO). */
  nextInvoiceDue?: string;
}

const ROLE_BADGE_LABEL: Record<PremiumAdminHeroProps['role'], string> = {
  owner: 'Owner',
  superadmin: 'Superadmin',
  admin: 'Admin',
};

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
  role,
  todaySessionCount,
  openInvoiceCount,
  overdueInvoiceCount,
  nextInvoiceDue,
}: PremiumAdminHeroProps) {
  const isPlatformStaff = role === 'owner' || role === 'superadmin';
  const todayLabel = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
  const greeting = getGreeting();
  const dueLabel = nextInvoiceDue
    ? new Date(nextInvoiceDue).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Berlin',
      })
    : null;

  return (
    <div className="min-w-0">
      {/* Date + Role pill — Datum in Mono, damit es als Datenzeile liest und
          nicht als zweite Überschrift mit der Begrüßung konkurriert. */}
      <div className="flex items-center gap-2 mb-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
          {todayLabel}
        </p>
        <span
          className={cn(
            'text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
            isPlatformStaff
              ? 'bg-info-50 text-info-700 dark:bg-info-900/20 dark:text-info-300'
              : 'bg-brand-light/10 text-brand-light dark:bg-brand-light/20 dark:text-success-300'
          )}
        >
          {ROLE_BADGE_LABEL[role]}
        </span>
      </div>

      {/* Greeting — grösser und enger gesetzt: die Begrüssung ist das Einzige
          auf der Seite, das keine Zahl ist, und darf deshalb Platz nehmen. */}
      <h1 className="text-3xl sm:text-[34px] font-bold font-display text-foreground leading-[1.05] tracking-[-0.038em]">
        {greeting}, {firstName}.
      </h1>

      {/* Lagebericht in einem Satz: was heute läuft, was Geld kostet, und ob
          sonst etwas offen ist. Der Vereinsname steht nicht mehr drin — er
          steht im Vereins-Umschalter der Sidebar, direkt links daneben, und
          war hier nur eine zweite Kopie ohne neue Information. */}
      <p className="text-sm text-muted-foreground mt-1.5">
        Heute{' '}
        <strong className="text-foreground dark:text-white font-semibold">
          <AnimatedCounter value={todaySessionCount} />
        </strong>{' '}
        {todaySessionCount === 1 ? 'Session' : 'Sessions'}
        {openInvoiceCount > 0 && (
          <>
            ,{' '}
            <strong className="text-foreground dark:text-white font-semibold">
              {openInvoiceCount} {openInvoiceCount === 1 ? 'Rechnung' : 'Rechnungen'}
            </strong>{' '}
            {overdueInvoiceCount > 0 ? 'überfällig' : 'fällig'}
            {dueLabel ? ` ${overdueInvoiceCount > 0 ? 'seit' : 'zum'} ${dueLabel}` : ''}
          </>
        )}
        {overdueInvoiceCount > 0 ? '.' : ' — sonst läuft alles.'}
      </p>
    </div>
  );
}
