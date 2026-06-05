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

  if (!mounted) {
    // Render a placeholder to prevent layout shift
    return (
      <div
        className={cn('inline-flex items-center justify-center rounded-xl h-9 w-9', className)}
        aria-hidden="true"
      />
    );
  }

  // 3-way cycle: system → light → dark → system
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

  const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dunkel' : 'Hell';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-background/10 transition-colors',
        showLabel && 'w-auto px-3',
        className
      )}
      aria-label={
        theme === 'system'
          ? 'Zum hellen Design wechseln'
          : theme === 'light'
            ? 'Zum dunklen Design wechseln'
            : 'Zum System-Design wechseln'
      }
    >
      <div className="relative" style={{ width: iconSize, height: iconSize }}>
        {/* System (monitor) icon */}
        <Monitor
          className={cn(
            'absolute inset-0 transition-all duration-500',
            theme === 'system' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* Light (sun) icon */}
        <Sun
          className={cn(
            'absolute inset-0 transition-all duration-500',
            theme === 'light' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* Dark (moon) icon */}
        <Moon
          className={cn(
            'absolute inset-0 transition-all duration-500',
            theme === 'dark' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        {/* System-mode indicator dot */}
        <span
          className={cn(
            'absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background transition-all duration-500',
            theme === 'system' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          )}
          aria-hidden="true"
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium flex items-center gap-1.5">
          {label}
          {theme === 'system' && (
            <span className="text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all duration-300">
              Auto
            </span>
          )}
        </span>
      )}
      <span className="sr-only">Theme wechseln</span>
    </button>
  );
}
