/**
 * Hero Video Slot — Editorial Sports (Phase 2 + Phase 6 unification)
 *
 * Pure render. Scroll-progress and video-layer expansion are decoupled
 * from this component: the CSS layer (`.hero-video-layer`) reads
 * `var(--hero-progress, 0)` directly and interpolates `inset`
 * continuously. Progress is owned by `HeroScrollProgress` (Phase 4),
 * so Headline accent and Video layer breathe in lockstep from the
 * same scroll-driven variable.
 *
 * Scaffolding contract (per `docs/hero-video-briefing.md`):
 *  - `enabled === false` (default): renders ONLY `children`. Hero stays
 *    typography-only until asset is delivered. Zero-DOM impact.
 *  - `enabled === true`: renders a multi-format `<video>` (AV1 → VP9 → mp4)
 *    behind the children. Upload all four files to `/public/media/hero/`
 *    BEFORE flipping enabled (poster is the reduced-motion fallback).
 *
 * Honors `prefers-reduced-motion: reduce` purely via globals.css:
 *  - `video { display: none }` hides the playback element.
 *  - `* transition-duration: 0.01ms !important` kills transitions.
 *  - The poster image set as inline background-image on the layer
 *    remains visible statically.
 *
 * No JS effect runs in this component — scroll-progress and reduced-motion
 * are handled by `hero-scroll-progress.tsx` and global CSS respectively.
 */

import type { ReactNode } from 'react';

interface HeroVideoProps {
  enabled?: boolean;
  sources?: Array<{ src: string; type: string }>;
  poster?: string;
  children: ReactNode;
}

const DEFAULT_SOURCES: NonNullable<HeroVideoProps['sources']> = [
  { src: '/media/hero/hero.av1.webm', type: 'video/webm; codecs=av01.0.05M.08' },
  { src: '/media/hero/hero.vp9.webm', type: 'video/webm; codecs=vp9' },
  { src: '/media/hero/hero.mp4', type: 'video/mp4' },
];

// Upload contract: the consumer MUST upload all four files
// (`hero.av1.webm`, `hero.vp9.webm`, `hero.mp4`, `hero-poster.jpg`) under
// `/public/media/hero/` BEFORE flipping `enabled={true}` on this component.
// The poster is also set as an inline CSS background-image on the layer,
// so reduced-motion users rely on it — partial uploads produce a broken
// poster icon for that audience. Single source of truth for the path.
const DEFAULT_POSTER = '/media/hero/hero-poster.jpg';

export function HeroVideoSlot({
  enabled = false,
  sources = DEFAULT_SOURCES,
  poster = DEFAULT_POSTER,
  children,
}: HeroVideoProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className="hero-video-layer"
        aria-hidden="true"
        style={{
          backgroundImage: `url(${poster})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <video autoPlay muted loop playsInline preload="metadata" poster={poster}>
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      </div>
      {children}
    </>
  );
}
