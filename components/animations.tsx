'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `value` using requestAnimationFrame
 * with ease-out cubic interpolation.
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

  useEffect(() => {
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
  }, [value, duration]);

  const formatted = value >= 1000 ? display.toLocaleString() : display.toString();

  return (
    <span className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Reveals children with a fade-in + translate-up animation
 * when they scroll into the viewport.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
