'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Command, Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  description: string;
  category?: 'navigation' | 'actions' | 'search' | 'general';
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { key: 'D', metaKey: true, description: 'Dashboard öffnen', category: 'navigation' },
  { key: 'B', metaKey: true, description: 'Buchungen öffnen', category: 'navigation' },
  { key: 'M', metaKey: true, description: 'Mitglieder öffnen', category: 'navigation' },
  { key: 'S', metaKey: true, description: 'Einstellungen öffnen', category: 'navigation' },

  // Search
  { key: 'K', metaKey: true, description: 'Suche öffnen', category: 'search' },
  { key: '/', description: 'Suchfeld fokussieren', category: 'search' },

  // Actions
  { key: 'N', metaKey: true, shiftKey: true, description: 'Neue Buchung', category: 'actions' },
  { key: 'Enter', description: 'Formular absenden', category: 'actions' },

  // General
  { key: '?', shiftKey: true, description: 'Shortcuts anzeigen', category: 'general' },
  { key: 'Esc', description: 'Dialog schließen', category: 'general' },
];

const categoryLabels = {
  navigation: 'Navigation',
  actions: 'Aktionen',
  search: 'Suche',
  general: 'Allgemein',
};

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  const renderKey = (
    key: string,
    modifiers: { metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean }
  ) => {
    const keys: string[] = [];

    if (modifiers.metaKey) {
      keys.push(isMac ? '⌘' : 'Ctrl');
    }
    if (modifiers.ctrlKey) {
      keys.push('Ctrl');
    }
    if (modifiers.shiftKey) {
      keys.push('⇧');
    }
    if (modifiers.altKey) {
      keys.push(isMac ? '⌥' : 'Alt');
    }

    keys.push(key);

    return (
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <Badge
            key={i}
            variant="outline"
            className="min-w-[32px] justify-center font-mono text-xs py-1"
          >
            {k}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Trigger Button - Hidden, only for accessibility */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-brand-light text-white shadow-lg hover:bg-brand-light/80 transition-colors z-50"
        aria-label="Keyboard Shortcuts anzeigen"
        title="Keyboard Shortcuts (Shift + ?)"
      >
        <Keyboard className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Command className="h-5 w-5" />
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
            </div>
            <DialogDescription>
              Nutze diese Tastenkombinationen für schnellere Navigation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      {renderKey(shortcut.key, {
                        ...(shortcut.metaKey !== undefined && { metaKey: shortcut.metaKey }),
                        ...(shortcut.shiftKey !== undefined && { shiftKey: shortcut.shiftKey }),
                        ...(shortcut.ctrlKey !== undefined && { ctrlKey: shortcut.ctrlKey }),
                        ...(shortcut.altKey !== undefined && { altKey: shortcut.altKey }),
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Drücke{' '}
              <Badge variant="outline" className="mx-1">
                Shift
              </Badge>{' '}
              +{' '}
              <Badge variant="outline" className="mx-1">
                ?
              </Badge>{' '}
              um dieses Fenster zu öffnen/schließen
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
