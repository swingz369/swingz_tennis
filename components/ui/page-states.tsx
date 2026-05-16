'use client';

import type { LucideIcon } from 'lucide-react';

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Wird geladen…' }: PageLoadingProps) {
  return <div className="text-center py-10 text-muted-foreground text-sm">{message}</div>;
}

interface PageErrorProps {
  message: string;
  onRetry?: () => void;
}

export function PageError({ message, onRetry }: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-brand-light hover:underline">
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

interface PageEmptyProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
}

export function PageEmpty({ icon: Icon, title, description }: PageEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {Icon && <Icon className="h-12 w-12 text-muted-foreground/40" />}
      {title && <p className="text-sm font-medium text-muted-foreground">{title}</p>}
      {description && <p className="text-xs text-muted-foreground/60">{description}</p>}
    </div>
  );
}
