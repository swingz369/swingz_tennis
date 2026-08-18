'use client';

import { AlertCircle, Inbox } from 'lucide-react';

/**
 * Der Zustand einer Liste, bevor sie Zeilen hat (PRODUKTIONSREIFE.md 4.4/4.5).
 *
 * Drei Zustände, die vorher alle gleich aussahen — nämlich wie „nichts da":
 *
 *   lädt    → noch keine Aussage möglich
 *   Fehler  → wir wissen es nicht, und der Nutzer erfährt warum
 *   leer    → es ist wirklich nichts da, plus was man dagegen tun kann
 *
 * Eine Null, die in Wahrheit ein 403 war, sieht aus wie ein Fehler des
 * Nutzers. Deshalb bekommt der Fehlerfall eine eigene Darstellung.
 */
export function ListState({
  loading,
  error,
  empty,
  emptyTitle = 'Noch nichts vorhanden',
  emptyHint,
  children,
}: {
  loading?: boolean;
  /** Fehlermeldung, falls das Laden gescheitert ist. */
  error?: string | null;
  /** True, wenn geladen wurde und die Liste leer ist. */
  empty?: boolean;
  emptyTitle?: string;
  /** Was der Nutzer tun kann, damit hier etwas steht. */
  emptyHint?: string;
  children?: React.ReactNode;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Wird geladen …</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
        <p className="text-sm font-medium">Konnte nicht geladen werden</p>
        <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{emptyTitle}</p>
        {emptyHint && <p className="max-w-sm text-xs text-muted-foreground">{emptyHint}</p>}
      </div>
    );
  }

  return <>{children}</>;
}
