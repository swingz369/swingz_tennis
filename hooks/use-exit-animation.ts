'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface UseExitAnimationOptions {
  /** Duration of the exit CSS animation in milliseconds. */
  duration?: number;
  /** CSS class to add for the exit animation. */
  exitClass?: string;
  /** CSS class to remove when starting exit (e.g. the entry class). */
  entryClass?: string;
}

/**
 * Intercepts internal link clicks within a container element,
 * plays a CSS exit animation, then navigates programmatically.
 *
 * @param containerRef - Ref to the DOM element whose `<a>` descendants should be intercepted.
 * @param options - Animation duration and CSS class names.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * useExitAnimation(containerRef, { duration: 200, exitClass: 'page-transition-exit' });
 * return <div ref={containerRef}>{children}</div>;
 * ```
 */
export function useExitAnimation(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseExitAnimationOptions = {}
) {
  const {
    duration = 200,
    exitClass = 'page-transition-exit',
    entryClass = 'page-transition-enter',
  } = options;

  const pathname = usePathname();
  const router = useRouter();
  const isExitingRef = useRef(false);

  // Reset exit flag when navigation completes (pathname changes)
  useEffect(() => {
    isExitingRef.current = false;
  }, [pathname]);

  // Intercept internal link clicks
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      if (isExitingRef.current) return;
      // Respect modifier keys (open in new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      // Find closest <a> element
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        href === pathname
      )
        return;

      // Internal link — play exit animation then navigate
      e.preventDefault();
      isExitingRef.current = true;

      const wrapper = containerRef.current;
      if (wrapper) {
        wrapper.classList.remove(entryClass);
        wrapper.classList.add(exitClass);
      }

      setTimeout(() => {
        router.push(href);
      }, duration);
    };

    el.addEventListener('click', handleClick, { capture: true });
    return () => el.removeEventListener('click', handleClick, { capture: true });
  }, [pathname, router, containerRef, duration, exitClass, entryClass]);

  return { isExitingRef };
}
