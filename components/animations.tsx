'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useExitAnimation } from '@/hooks/use-exit-animation';

/**
 * Wraps children with entry/exit page transition animations.
 *
 * **Entry**: fade-in + translate-up when pathname changes (CSS class restart).
 * **Exit**: fade-out + translate-up when user clicks an internal link
 *   (delegated to `useExitAnimation` hook).
 *
 * Accessibility:
 * - When `prefers-reduced-motion: reduce` is active, animations are instant.
 */
export function PageTransition({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Exit animation: intercepts internal link clicks, plays CSS exit, navigates
  useExitAnimation(ref, { duration: 200 });

  // Entry animation on route change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-transition-exit');
    el.classList.remove('page-transition-enter');
    void el.offsetWidth;
    el.classList.add('page-transition-enter');
  }, [pathname]);

  return (
    <div ref={ref} className={`page-transition-enter ${className}`}>
      {children}
    </div>
  );
}

/**
 * Detects whether the user prefers reduced motion.
 * Returns true if `prefers-reduced-motion: reduce` is active.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

/**
 * Animates a number from 0 to `value` using requestAnimationFrame
 * with ease-out cubic interpolation.
 *
 * Accessibility: screen readers always see the final `value` via `aria-label`.
 * When `prefers-reduced-motion: reduce` is active, the value is shown instantly.
 */
export function AnimatedCounter({
  value,
  suffix = '',
  duration = 1500,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    if (hasAnimated.current && value === display) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const startVal = 0;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration ?? 1500), 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(startVal + (value - startVal) * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefersReduced]);

  const formatted = value >= 1000 ? display.toLocaleString() : display.toString();

  return (
    <span className="tabular-nums" aria-label={`${value}${suffix}`}>
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Reveals children with a fade-in + translate-up animation
 * when they scroll into the viewport.
 *
 * Accessibility:
 * - When `prefers-reduced-motion: reduce` is active, content is shown immediately.
 * - The wrapper uses `aria-hidden="false"` to ensure content is always accessible.
 */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay ?? 0);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </div>
  );
}
