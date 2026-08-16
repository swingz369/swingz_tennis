'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Zeigt einen Befehl (oder eine Verbindungs-Zeichenkette) in Mono-Schrift und
 * kopiert ihn per Klick in die Zwischenablage. Wird nur auf der lokalen
 * Dev-Schnellzugriff-Seite verwendet.
 */
export function CopyCommand({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard kann blockiert sein (z. B. privater Modus) — bewusst still.
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Kopiert' : 'In die Zwischenablage kopieren'}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
