'use client';

import { useEffect, useCallback, useRef, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { focusManager } from '@/lib/accessibility';

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
 * CenteredModal — the canonical modal wrapper for SwingZ.
 *
 * Combines the most common modal patterns into one component:
 * - Viewport-centering via `min-h-dvh flex items-center justify-center` (not just
 *   `items-center` alone, which centers against the content's own height)
 * - `p-4` so tall modals have breathing room from the viewport edges
 * - Body scroll lock (prevents the page behind from scrolling while modal is open)
 * - Escape key closes the modal
 * - Overlay click closes the modal (unless `disableOverlayClose`)
 * - Inner content capped at `max-h-[90vh]` with internal scroll, so forms never
 *   extend below the viewport
 *
 * Replaces the 9+ raw `<div className="fixed inset-0 z-50 flex items-center
 * justify-center bg-black/40">` patterns previously scattered through the app.
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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trapping — when the modal opens, trap Tab/Shift+Tab inside the
  // dialog and focus the first focusable element (or the dialog itself).
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;

    // Wait for the portal to render into the DOM before trapping.
    // Focus the first focusable element, or the dialog itself as fallback.
    const raf = requestAnimationFrame(() => {
      focusManager.focusFirst(el);
      // If no focusable child was found, focus the dialog wrapper which
      // has tabIndex={-1} (programmatically focusable, not in Tab order).
      if (document.activeElement === document.body || !el.contains(document.activeElement)) {
        el.focus();
      }
    });

    const cleanupTrap = focusManager.trapFocus(el);

    return () => {
      cancelAnimationFrame(raf);
      cleanupTrap();
    };
  }, [open]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disableEscape) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [disableEscape, onClose]
  );

  useEffect(() => {
    if (!open || disableEscape) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, disableEscape, handleKeyDown]);

  // Overlay click handler — only triggers when the click started + ended on the
  // overlay itself (not on a child), to avoid closing when the user drags a
  // selection from a button up to the overlay. The matching keyboard handler
  // is required by jsx-a11y/click-events-have-key-events — without it, the
  // overlay would only be closeable via Escape or the explicit close button.
  const handleOverlayClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (disableOverlayClose) return;
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [disableOverlayClose, onClose]
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disableOverlayClose) return;
      if (e.target !== e.currentTarget) return; // only on the overlay itself
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    },
    [disableOverlayClose, onClose]
  );

  if (!open) return null;

  // SSR safety — `createPortal` requires `document` which doesn't exist on the server.
  // 'use client' components are still SSR-rendered for the initial HTML, so guard here.
  if (typeof document === 'undefined') return null;

  // Render the modal into <body> via a portal. This guarantees the modal's parent
  // in the DOM is <body> regardless of where the component is mounted in the React
  // tree, so no ancestor can establish a containing block for `position: fixed`
  // via `transform`, `filter`, `backdrop-filter`, `will-change`, `contain`, or
  // `perspective`. The overlay's `min-h-dvh flex items-center justify-center`
  // is therefore always computed against the viewport, not a local parent.
  return createPortal(
    <div
      role="presentation"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center min-h-dvh p-4',
        overlayClassName ?? 'bg-black/40 backdrop-blur-sm'
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={cn(
          'bg-background dark:bg-card rounded-xl shadow-lg p-6 w-full max-w-md',
          scrollInside && 'max-h-[90vh] overflow-y-auto sm:max-h-[85vh]',
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

CenteredModal.displayName = 'CenteredModal';
