/**
 * TennisBallSvg — Reusable tennis ball with brand gradient + dynamic lines.
 *
 * Inspired by the landing-page hero ball. Used by `PremiumAdminHero` as a
 * floating, partially clipped identity element. Pure SVG, no JS animation —
 * motion comes from the wrapper's `animate-float` utility.
 *
 * NOTE: The SVG `<defs>` ids are static. The component is intended to be
 * rendered once per page (in the admin hero). If you ever need multiple
 * instances on the same page, switch the component to `'use client'` and
 * derive the ids from React's `useId()` to avoid id-collision in the DOM.
 */

interface TennisBallSvgProps {
  width?: number;
  height?: number;
  /** Override class for styling (e.g. opacity, blur). */
  className?: string;
}

export function TennisBallSvg({ width = 320, height = 320, className }: TennisBallSvgProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="adminBallGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(150 38% 63%)" />
          <stop offset="40%" stopColor="hsl(var(--brand-primary-light))" />
          <stop offset="70%" stopColor="hsl(var(--brand-primary))" />
          <stop offset="100%" stopColor="hsl(150 50% 12%)" />
        </radialGradient>
        <filter id="adminBallShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="25"
            stdDeviation="25"
            floodColor="hsl(var(--brand-primary) / 0.4)"
          />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="85" fill="url(#adminBallGrad)" filter="url(#adminBallShadow)" />
      <path
        d="M100 15 A 70 70 0 0 1 100 185"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="6"
        fill="none"
      />
      <path
        d="M100 30 A 60 60 0 0 1 100 170"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M100 45 A 50 50 0 0 1 100 155"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="3"
        fill="none"
      />
      <ellipse
        cx="55"
        cy="55"
        rx="35"
        ry="22"
        fill="white"
        opacity="0.13"
        transform="rotate(-50 55 55)"
      />
    </svg>
  );
}
