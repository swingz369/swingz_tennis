'use client';

/**
 * Editorial Section-Reveal (Phase 4 Scroll-Storytelling)
 *
 * Pure progressive enhancement:
 * - Server renders the markup with `.reveal` (invisible, slight Y-offset)
 * - On mount, IntersectionObserver toggles `.visible` for elements entering viewport
 * - `prefers-reduced-motion` users get an instant reveal (no opacity dance)
 * - One-shot observer: once visible, the element stays visible
 * - Cleans up observer on unmount
 *
 * Usage:
 *   <SectionReveal as="section" delay={120} className="…">
 *     <h2>…</h2>
 *   </SectionReveal>
 *
 * The actual CSS transitions are defined in app/globals.css under
 * `.reveal` and `.reveal.visible`.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

type SectionRevealProps = {
  children: ReactNode;
  /** Override the rendered element (default: div) */
  as?: ElementType;
  /** Stagger delay in ms — applied as inline transition-delay */
  delay?: number;
  className?: string;
  /** Element ID for aria-labelledby / anchor links */
  id?: string;
  /** Aria labelling if no `id` is provided */
  'aria-label'?: string;
  /** Aria labelledby reference */
  'aria-labelledby'?: string;
};

export function SectionReveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  id,
  ...ariaProps
}: SectionRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced-motion: flip visible immediately, no observer needed.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      node.classList.add('visible');
      return;
    }

    // No IO support (very old browsers): flip visible after a tick so
    // content is reachable. Avoid leaving content hidden forever.
    if (typeof IntersectionObserver === 'undefined') {
      const t = window.setTimeout(() => node.classList.add('visible'), 50);
      return () => window.clearTimeout(t);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      id={id}
      className={`reveal ${className}`.trim()}
      style={style}
      {...ariaProps}
    >
      {children}
    </Tag>
  );
}
