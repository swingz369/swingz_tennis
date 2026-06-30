'use client';

import { useEffect, useRef } from 'react';
import { useAriaLive } from '@/components/aria-live-region';

/** Maximum number of toast indices tracked before oldest-eviction kicks in. */
const MAX_TRACKED = 200;

/**
 * Bridges Sonner toast notifications to the ARIA live region.
 *
 * Uses a MutationObserver to detect new toast elements in the DOM and
 * announces their text content via the polite region (success/info/warning)
 * or assertive region (error toasts).
 *
 * Mount once in the root layout, near the `<Toaster />` component.
 *
 * Note: Couples to Sonner's internal DOM structure — `<ol data-sonner-toaster>`
 * containing `<li data-sonner-toast>` elements. May need updates on Sonner major
 * version bumps.
 */
export function SonnerAriaBridge() {
  const { announce, alert } = useAriaLive();
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Sonner renders toasts inside a [data-sonner-toaster] container.
    // Each toast is a <li> with data-sonner-toast attribute.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Find toast <li> elements (they may be nested)
          const toasts = node.matches?.('li[data-sonner-toast]')
            ? [node]
            : node.querySelectorAll?.('li[data-sonner-toast]');

          if (!toasts || toasts.length === 0) continue;

          for (const toast of toasts) {
            const index = (toast as HTMLElement).getAttribute('data-index');
            if (!index || announcedRef.current.has(index)) continue;

            // Extract visible text (Sonner renders title + optional description)
            const text = (toast as HTMLElement).textContent?.trim();
            if (!text || text.length < 2) continue;

            // Cap the set to prevent unbounded growth
            if (announcedRef.current.size >= MAX_TRACKED) {
              const oldest = announcedRef.current.values().next().value;
              if (oldest) announcedRef.current.delete(oldest);
            }
            announcedRef.current.add(index);

            // Detect error toasts: Sonner applies [data-type="error"] via CSS on the
            // toaster container, not on individual <li>s. Check the container and fall
            // back to German/English error keywords in the text content.
            const toasterEl = (toast as HTMLElement).closest('[data-sonner-toaster]');
            const isError =
              toasterEl?.getAttribute('data-type') === 'error' ||
              /\b(?:Fehler|Error|failed|fehlgeschlagen|Ungültig|invalid)\b/i.test(text);

            if (isError) {
              alert(text);
            } else {
              announce(text);
            }
          }
        }
      }
    });

    // Observe the Sonner container
    const container = document.querySelector('[data-sonner-toaster]');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    } else {
      // If Sonner hasn't mounted yet, observe the body for it
      const bodyObserver = new MutationObserver(() => {
        const c = document.querySelector('[data-sonner-toaster]');
        if (c) {
          bodyObserver.disconnect();
          observer.observe(c, { childList: true, subtree: true });
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: false });
      return () => {
        bodyObserver.disconnect();
        observer.disconnect();
      };
    }

    return () => observer.disconnect();
  }, [announce, alert]);

  return null;
}
