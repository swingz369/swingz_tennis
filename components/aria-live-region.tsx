'use client';

import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface AriaLiveContextValue {
  /** Polite announcement (queues behind other speech, appropriate for most updates). */
  announce: (message: string) => void;
  /** Assertive announcement (interrupts current speech, for critical alerts only). */
  alert: (message: string) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const AriaLiveContext = createContext<AriaLiveContextValue | null>(null);

/**
 * Hook to announce messages to screen readers.
 *
 * @example
 *   const { announce } = useAriaLive();
 *   announce('Buchung erfolgreich erstellt');
 *
 * Falls back gracefully when used outside an `<AriaLiveProvider>`.
 */
export function useAriaLive(): AriaLiveContextValue {
  const ctx = useContext(AriaLiveContext);
  return ctx ?? { announce: () => {}, alert: () => {} };
}

// ── Provider ────────────────────────────────────────────────────────────────

/**
 * Provides persistent `role="status"` (polite) and `role="alert"` (assertive)
 * live regions for screen reader announcements.
 *
 * Place this once in the root layout, wrapping the entire application.
 * Sonner toasts are automatically mirrored into the polite region.
 */
export function AriaLiveProvider({ children }: { children: ReactNode }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Announce via clear-then-set pattern to force re-announcement of
  // identical messages (e.g. "Gespeichert" twice in a row).
  // Screen readers track textContent mutations — briefly clearing
  // the node and re-setting on next animation frame triggers a new
  // announcement even for duplicate strings.
  // Note: requestAnimationFrame won't fire in background tabs; the
  // announcement is deferred until the tab regains focus, which is
  // acceptable since the user isn't interacting with a background tab.
  const announceToRegion = useCallback((el: HTMLDivElement | null, message: string) => {
    if (!el) return;
    el.textContent = '';
    // Force DOM flush so screen readers register the mutation
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, []);

  const announce = useCallback(
    (message: string) => announceToRegion(politeRef.current, message),
    [announceToRegion]
  );

  const alert = useCallback(
    (message: string) => announceToRegion(alertRef.current, message),
    [announceToRegion]
  );

  return (
    <AriaLiveContext.Provider value={{ announce, alert }}>
      {children}
      {/* Polite region — status updates, toasts, form feedback */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      {/* Assertive region — critical errors, time-sensitive alerts */}
      <div
        ref={alertRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AriaLiveContext.Provider>
  );
}
