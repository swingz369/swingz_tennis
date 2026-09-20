'use client';

import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface CenteredModalProps {
  /** Whether the modal is open. When false, the modal unmounts entirely. */
  open: boolean;
  /** Called when the user dismisses the modal (Escape key, overlay click, or explicit close). */
  onClose: () => void;
  /**
   * Modal content. The wrapper applies `max-h-[90vh] overflow-y-auto sm:max-h-[85vh]`
   * by default so long forms scroll inside the dialog instead of clipping the page.
   * Pass `scrollInside={false}` to disable this and let the content grow naturally
   * (capped only by `min-h-dvh` on the overlay).
   */
  children: ReactNode;
  /** Extra classes for the inner content panel (the card-like surface). */
  className?: string;
  /** Disable scroll lock + Escape key handling (e.g. for confirmation dialogs with their own buttons). */
  disableEscape?: boolean;
  /** Disable click-outside-to-close. Default false (clicking the overlay closes). */
  disableOverlayClose?: boolean;
  /** When true, the inner content won't enforce max-h + overflow (use for short dialogs). */
  scrollInside?: boolean;
  /** Backdrop opacity class. Default `bg-black/40`. */
  overlayClassName?: string;
  /** Optional aria-label for the modal (announced to screen readers). */
  ariaLabel?: string;
}

/**
 * CenteredModal — Dialog mit der bisherigen Props-Schnittstelle.
 *
 * Läuft auf Radix (wie shadcn `Dialog`): Fokusfalle, Escape, Scroll-Sperre und
 * Rückgabe des Fokus kommen von dort, nicht mehr aus Eigenbau. Neue Stellen nehmen
 * direkt `Dialog` aus `@/components/ui/dialog`; diese Hülle bleibt für den Bestand.
 */
export function CenteredModal({
  open,
  onClose,
  children,
  className,
  disableEscape = false,
  disableOverlayClose = false,
  scrollInside = true,
  overlayClassName,
  ariaLabel,
}: CenteredModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            overlayClassName ?? 'bg-black/40 backdrop-blur-sm'
          )}
        />
        <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center p-4 pointer-events-none">
          <DialogPrimitive.Content
            aria-label={ariaLabel}
            aria-describedby={undefined}
            onEscapeKeyDown={(e) => disableEscape && e.preventDefault()}
            onPointerDownOutside={(e) => disableOverlayClose && e.preventDefault()}
            onInteractOutside={(e) => disableOverlayClose && e.preventDefault()}
            className={cn(
              'pointer-events-auto w-full max-w-md rounded-xl bg-background p-6 shadow-lg dark:bg-card',
              scrollInside && 'max-h-[90vh] overflow-y-auto sm:max-h-[85vh]',
              className
            )}
          >
            {/* Radix verlangt einen Titel; die Inhalte bringen eigene Überschriften mit. */}
            <DialogPrimitive.Title className="sr-only">
              {ariaLabel ?? 'Dialog'}
            </DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

CenteredModal.displayName = 'CenteredModal';
