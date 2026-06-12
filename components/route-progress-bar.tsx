'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin animated progress bar at the top of the viewport that appears during route transitions.
 *
 * How it works:
 * 1. Patches `history.pushState` / `replaceState` to detect navigation start
 * 2. Listens for `popstate` events (back/forward)
 * 3. Shows a smooth progress bar that advances automatically
 * 4. Completes and fades out when `usePathname()` changes (navigation finished)
 *
 * Accessibility:
 * - Uses `role="progressbar"` with `aria-label`
 * - Hidden when not active (not just opacity: 0)
 * - Respects `prefers-reduced-motion: reduce`
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isActiveRef = useRef(false);

  const startProgress = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setVisible(true);
    setProgress(0);

    // Simulate progress: fast initial burst, then slower
    const steps = [
      { delay: 0, value: 10 },
      { delay: 100, value: 30 },
      { delay: 300, value: 50 },
      { delay: 600, value: 70 },
      { delay: 1000, value: 80 },
      { delay: 2000, value: 90 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach(({ delay, value }) => {
      const t = setTimeout(() => {
        if (isActiveRef.current) {
          setProgress(value);
        }
      }, delay);
      timers.push(t);
    });
    timerRef.current = timers;
  }, []);

  const completeProgress = useCallback(() => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    setProgress(100);
    // Fade out after reaching 100%
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
    timerRef.current.push(t);
  }, []);

  // Patch history API to detect navigation start
  useEffect(() => {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args: Parameters<typeof originalPushState>) {
      const result = originalPushState(...args);
      startProgress();
      return result;
    };

    history.replaceState = function (...args: Parameters<typeof originalReplaceState>) {
      const result = originalReplaceState(...args);
      startProgress();
      return result;
    };

    const onPopState = () => startProgress();
    window.addEventListener('popstate', onPopState);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', onPopState);
    };
  }, [startProgress]);

  // Complete progress when pathname changes (navigation finished)
  useEffect(() => {
    completeProgress();
  }, [pathname, completeProgress]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timerRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Seite wird geladen"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="route-progress-bar"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="route-progress-bar-inner"
        style={{
          width: `${progress}%`,
          transition:
            progress === 100
              ? 'width 200ms ease-out, opacity 200ms ease-out'
              : 'width 400ms ease-out',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
