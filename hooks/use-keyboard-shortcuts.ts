/**
 * Keyboard Shortcuts Hook
 *
 * Provides global keyboard shortcuts for the application
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category?: 'navigation' | 'actions' | 'search' | 'general';
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow some shortcuts in inputs (like Cmd+K for search)
        if (!(event.metaKey || event.ctrlKey)) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.metaKey ? event.metaKey || event.ctrlKey : true;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const keyMatch = event.key === shortcut.key;

        if (keyMatch && metaMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export function useGlobalKeyboardShortcuts() {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    {
      key: 'd',
      metaKey: true,
      action: () => {
        router.push('/dashboard');
        toast.success('Navigation: Dashboard');
      },
      description: 'Dashboard öffnen',
      category: 'navigation',
    },
    {
      key: 'b',
      metaKey: true,
      action: () => {
        router.push('/bookings');
        toast.success('Navigation: Buchungen');
      },
      description: 'Buchungen öffnen',
      category: 'navigation',
    },
    {
      key: 'm',
      metaKey: true,
      action: () => {
        router.push('/admin/members');
        toast.success('Navigation: Mitglieder');
      },
      description: 'Mitglieder öffnen',
      category: 'navigation',
    },
    {
      key: 's',
      metaKey: true,
      action: () => {
        router.push('/admin/settings');
        toast.success('Navigation: Einstellungen');
      },
      description: 'Einstellungen öffnen',
      category: 'navigation',
    },
    // Note: Cmd/Ctrl+K is intentionally NOT bound here — the command palette
    // (components/command-palette.tsx) owns that shortcut globally so it
    // opens the palette instead of navigating away from it.
    // Help
    {
      key: '?',
      shiftKey: true,
      action: () => {
        // Will be handled by KeyboardShortcutsDialog
      },
      description: 'Shortcuts anzeigen',
      category: 'general',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}
