'use client';

/**
 * Hero Scroll-Progress — Editorial Sports (Phase 4)
 *
 * Single owner of the `--hero-progress` CSS custom property on the
 * hero stage. Writes a 0..1 value as the user scrolls the hero past
 * the viewport, so that BOTH:
 *
 *   1. the headline's italic Court-Clay accent (`.hero-headline-accent`)
 *   2. the video layer's expansion (`.hero-video-layer`)
 *
 * animate in lockstep. Both elements read `var(--hero-progress, 0)`
 * — that's the unification; no second writer exists.
 *
 * Why a passive scroll listener + rAF throttle (not IntersectionObserver):
 *   IO only fires at threshold crossings (coarse resolution). For a
 *   continuous, 1:1 scroll-linked animation we need per-frame values.
 *   rAF + passive scroll listener is the canonical pattern for this.
 *
 * The component renders a single 1px absolute `<span>` whose
 * `offsetParent` resolves to the nearest `position: relative` ancestor —
 * which is the `<section>` rendered by `SectionReveal`. That section is
 * the `--hero-progress` writer target.
 *
 * Honors `prefers-reduced-motion: reduce`: skips rAF entirely, sets
 * `--hero-progress` to `0` once. (CSS-only transitions on transforms
 * are already disabled globally; the JS just freezes the variable so
 * the layer stays contained and the accent stays at rest.)
 */

import { useEffect, useRef } from 'react';

export function HeroScrollProgress() {
  const sentinelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // `offsetParent` resolves to the nearest position-relative ancestor.
    // The SectionReveal `<section>` has `relative` in its className, so
    // the sentinel (rendered inside it) targets exactly that section.
    const stage = sentinel.offsetParent instanceof HTMLElement ? sentinel.offsetParent : null;
    if (!stage) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      stage.style.setProperty('--hero-progress', '0');
      return;
    }

    let raf: number | null = null;

    const update = () => {
      raf = null;
      const rect = stage.getBoundingClientRect();
      // progress = 0 when fully in viewport (top >= 0), 1 when stage is
      // fully above viewport (-rect.top >= rect.height).
      const progress = Math.max(0, Math.min(1, -rect.top / rect.height));
      stage.style.setProperty('--hero-progress', String(progress));
    };

    const schedule = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update(); // initial paint

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return <span ref={sentinelRef} aria-hidden="true" className="hero-progress-sentinel" />;
}
