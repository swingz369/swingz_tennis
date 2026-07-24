'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  /** Additional classes for the toggle button */
  className?: string;
  /** Icon size in px. Default 18 */
  iconSize?: number;
  /** Show a text label next to the icon */
  showLabel?: boolean;
}

export function ThemeToggle({ className, iconSize = 18, showLabel = false }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render a <button> to avoid SSR/client element mismatch (hydration).
  // Before mounting, the button is non-interactive and shows no icons.
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell';

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={mounted ? () => setTheme(nextTheme) : undefined}
      disabled={!mounted}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-background/10 transition-colors',
        showLabel && 'w-auto px-3',
        !mounted && 'pointer-events-none',
        className
      )}
      aria-label={
        !mounted
          ? undefined
          : theme === 'system'
            ? 'Zum hellen Design wechseln'
            : theme === 'light'
              ? 'Zum dunklen Design wechseln'
              : 'Zum System-Design wechseln'
      }
    >
      <div className="relative" style={{ width: iconSize, height: iconSize }}>
        {/* System (monitor) icon */}
        <Monitor
          suppressHydrationWarning
          className={cn(
            'absolute inset-0 transition-all duration-500',
            !mounted || theme === 'system' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* Light (sun) icon */}
        <Sun
          suppressHydrationWarning
          className={cn(
            'absolute inset-0 transition-all duration-500',
            mounted && theme === 'light' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* Dark (moon) icon */}
        <Moon
          suppressHydrationWarning
          className={cn(
            'absolute inset-0 transition-all duration-500',
            mounted && theme === 'dark' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* System-mode indicator dot */}
        <span
          suppressHydrationWarning
          className={cn(
            'absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-info-500 ring-2 ring-background transition-all duration-500',
            mounted && theme === 'system' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          )}
          aria-hidden="true"
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium flex items-center gap-1.5">
          {label}
          {theme === 'system' && (
            <span className="text-2xs leading-none px-1.5 py-0.5 rounded-full font-medium bg-info-100 dark:bg-info-900/40 text-info-600 dark:text-info-300 border border-info-200 dark:border-info-800 transition-all duration-300">
              Auto
            </span>
          )}
        </span>
      )}
      <span className="sr-only">Theme wechseln</span>
    </button>
  );
}
