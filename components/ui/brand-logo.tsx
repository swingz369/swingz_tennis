import { cn } from '@/lib/utils';

/**
 * SwingZ-Marke nach der Matchday-Vorlage (ADR-007).
 *
 * `Wordmark`: „SWINGZ /" in kursiven Versalien, der Schrägstrich in
 * `brand-accent` — auf dunklen Flächen (Sidebar, dunkle Inseln, Dark-Theme)
 * Lime, auf hellem Grund das lesbare Oliv.
 * `BrandMark`: Lime-Ball mit S-Naht auf Nachtblau — dieselbe Grafik wie
 * public/favicon.svg und die App-Icons.
 */
export function Wordmark({
  className,
  tone = 'auto',
}: {
  className?: string;
  /** `onDark`: auf Flächen, die in beiden Themes dunkel sind (Kopfbilder) */
  tone?: 'auto' | 'onDark';
}) {
  return (
    <span
      className={cn(
        'font-bold italic uppercase tracking-[-0.06em]',
        tone === 'onDark' ? 'text-white' : 'text-foreground',
        className
      )}
    >
      SwingZ
      <span
        className={tone === 'onDark' ? 'text-highlight' : 'text-brand-accent'}
        aria-hidden="true"
      >
        {' '}
        /
      </span>
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="512" height="512" rx="112" fill="#172C48" />
      <circle cx="256" cy="256" r="170" fill="#D8F449" />
      <path
        d="M326 146 C240 118 168 168 206 226 C236 272 330 250 324 318 C318 382 230 392 170 360"
        fill="none"
        stroke="#172C48"
        strokeWidth="34"
        strokeLinecap="round"
        transform="skewX(-10) translate(46 0)"
      />
    </svg>
  );
}
