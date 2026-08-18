/**
 * IconBox Component
 *
 * Reusable icon container for the repeated pattern:
 * <div className="flex h-X w-X items-center justify-center rounded-xl bg-Y">
 *   <Icon className="h-Z w-Z text-Color" />
 * </div>
 *
 * Used ~30+ times across the codebase — now unified into one component.
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconBoxSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconBoxVariant =
  | 'primary'
  | 'light'
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'red'
  | 'orange'
  | 'teal'
  | 'rose'
  | 'indigo'
  | 'gray'
  | 'gradient-primary'
  | 'gradient-accent';

export interface IconBoxProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Predefined size. Default: 'md' (h-10 w-10) */
  size?: IconBoxSize;
  /** Color variant. Default: 'light' */
  variant?: IconBoxVariant;
  /** Additional classes for the container div */
  className?: string;
  /** Additional classes for the icon element */
  iconClassName?: string;
}

// Der Container hat keine eigene Grösse mehr — er umschliesst das Icon.
// Vorher spannte er eine getönte Kachel auf (h-10 w-10 um ein 20-px-Icon);
// ohne Fläche wäre eine feste Kachelgrösse nur noch ein Loch im Layout.
const sizeClasses: Record<IconBoxSize, { container: string; icon: string }> = {
  xs: { container: '', icon: 'h-3.5 w-3.5' },
  sm: { container: '', icon: 'h-4 w-4' },
  md: { container: '', icon: 'h-5 w-5' },
  lg: { container: '', icon: 'h-6 w-6' },
};

/**
 * ── Farbdisziplin (18.08.2026) ──
 *
 * Vorher trug jede Variante eine eigene getönte Kachel: `Buchen` blau,
 * `Trainer` türkis, `Rechnungen` violett, `Turniere` bernstein — zwölf
 * Pastellflächen nebeneinander, deren Farbe nichts bedeutete. Genau das ist
 * das Muster, an dem man generierte Oberflächen erkennt: Farbe als Dekoration
 * statt als Aussage.
 *
 * Jetzt gilt: **Farbe nur, wo sie etwas sagt.** Die dekorativen Varianten
 * (blue/purple/teal/indigo/light/gray) laufen alle auf denselben ruhigen Ton
 * zusammen, die semantischen (green/amber/red/rose/orange) behalten ihre
 * Signalfarbe. Die Kachel selbst ist weg — ein Icon braucht keinen eigenen
 * Hintergrund, um als Icon gelesen zu werden; es steht jetzt direkt neben
 * seinem Text wie in jeder handgebauten Oberfläche.
 *
 * Die Varianten-Namen bleiben (28 Aufrufstellen), damit das eine Datei-Änderung
 * bleibt statt einer Migration.
 */
const NEUTRAL = 'text-muted-foreground';

const variantClasses: Record<IconBoxVariant, string> = {
  primary: 'text-primary',
  light: NEUTRAL,
  blue: NEUTRAL,
  purple: NEUTRAL,
  teal: NEUTRAL,
  indigo: NEUTRAL,
  gray: NEUTRAL,
  green: 'text-success-600',
  amber: 'text-warning-600',
  red: 'text-error-600',
  rose: 'text-error-600',
  orange: 'text-brand-accent-2',
  // Die beiden Verlaufs-Varianten waren die einzigen gefüllten Flächen. Gefüllt
  // bleiben sie — aber einfarbig: ein Farbverlauf auf 24 px Kantenlänge ist
  // nichts als Rauschen.
  'gradient-primary': 'bg-primary text-primary-foreground rounded-md p-2',
  'gradient-accent': 'bg-primary text-primary-foreground rounded-md p-2',
};

export function IconBox({
  icon: Icon,
  size = 'md',
  variant = 'light',
  className,
  iconClassName,
}: IconBoxProps) {
  const sizes = sizeClasses[size];
  const variantClass = variantClasses[variant];

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        sizes.container,
        variantClass,
        className
      )}
    >
      <Icon className={cn(sizes.icon, iconClassName)} aria-hidden="true" />
    </div>
  );
}
