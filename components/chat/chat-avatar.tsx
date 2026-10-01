import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Getönte Flächen mit Vordergrundschrift — Kontrast hält in beiden Themes.
const TINTS = [
  'bg-primary/10',
  'bg-highlight/50',
  'bg-chart-2/15',
  'bg-chart-3/20',
  'bg-chart-4/15',
  'bg-event/20',
];

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function tint(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

/** Rundes Kürzel-Avatar, Farbe stabil je ID. Gruppen zeigen ein Personen-Symbol. */
export function ChatAvatar({
  id,
  name,
  group = false,
  size = 'md',
  className,
}: {
  id: string;
  name: string;
  group?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-foreground',
        group ? 'bg-primary text-primary-foreground' : tint(id),
        SIZES[size],
        className
      )}
    >
      {group ? <Users className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : initials(name)}
    </span>
  );
}
