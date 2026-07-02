'use client';

/**
 * Editorial Landing (Phases 2-6)
 *
 * The Magazine: Cream paper + Pally serif + Court Clay + 1px hairlines.
 * No glassmorphism, no aurora blobs, no gradient mesh — paper, not glass.
 *
 * Sections:
 *  1. Skip-link (a11y)
 *  2. Site Nav (sticky, hairline-bottom)
 *  3. Editorial Hero (Pally display headline, mono metadata, 2 CTAs)
 *     — HeroScrollProgress drives --hero-progress (Phase 4)
 *     — HeroVideoSlot layer expands from same variable (Phase 6)
 *  4. Bento Features (extracted client chunk as plain Server Component)
 *  5. How It Works (Roman numerals, 3 steps; inline)
 *  6. Pricing (Client component — billing toggle, lazy-loaded via next/dynamic
 *     so its interactive JS chunk defers hydration of the toggle state)
 *  7. CTA (single closing statement, large serif; inline)
 *  8. Editorial Footer (extracted component)
 *
 * Phase 5 lazy-loading: Why next/dynamic here? Only Client Components
 * benefit — App Router streams Server Components natively. Bento and
 * Footer are extracted into separate files but imported eagerly here.
 * PricingSection is `'use client'` with a useState billing toggle; that
 * is the only chunk worth lazy-hydrating.
 */

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/external/supabase/client';
import { analytics } from '@/lib/analytics';
import { ArrowUpRight } from 'lucide-react';

import { SectionReveal } from './_components/section-reveal';
import { HeroVideoSlot } from './_components/hero-video-slot';
import { HeroScrollProgress } from './_components/hero-scroll-progress';
import { BentoSection } from './_components/bento-section';
import { FooterSection } from './_components/footer-section';

// Phase 5: PricingSection is the only Client Component in the page tree
// with interactive state (monthly/yearly billing toggle). Lazy-hydrate
// its chunk via `next/dynamic` with `ssr: true` so the initial HTML
// still paints the monthly price tier synchronously (no FCP loss) while
// the toggle's JS downloads on a separate chunk.
const PricingSection = dynamic(
  () => import('./_components/pricing-section').then((m) => ({ default: m.PricingSection })),
  {
    ssr: true,
    loading: () => (
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8 hairline-t" aria-hidden="true">
        <div className="h-32 bg-foreground/[0.03] rounded-sm" />
      </div>
    ),
  }
);

/* ────────────────────────────────────────────────────────────────────
 *  How-It-Works data (kept inline — small, single-use)
 * ──────────────────────────────────────────────────────────────────── */

const HOW_STEPS = [
  {
    numeral: 'I.',
    title: 'Registrieren',
    body: 'Erstellt euren Club in wenigen Minuten — keine Kreditkarte, keine Verpflichtung.',
  },
  {
    numeral: 'II.',
    title: 'Konfigurieren',
    body: 'Wir richten euren Club persönlich ein und begleiten das Onboarding.',
  },
  {
    numeral: 'III.',
    title: 'Durchstarten',
    body: 'Plant Trainingseinheiten, verwaltet Buchungen, optimiert mit KI.',
  },
];

/* ────────────────────────────────────────────────────────────────────
 *  Page
 * ──────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();

  // Client-side auth fallback for /landing direct hits
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (data.session?.user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

  return (
    <div
      id="main-content"
      className="bg-background text-foreground paper-grain relative"
      suppressHydrationWarning
    >
      {/* ═══════════ SKIP LINK (A11y) ═══════════ */}
      <a
        href="#section-features"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-primary-foreground focus:rounded-sm focus:font-medium focus:shadow-lg"
      >
        Direkt zum Inhalt springen
      </a>

      {/* ═══════════ SITE NAV ═══════════ */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md hairline-b">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2 group">
              <span className="font-editorial text-xl text-foreground tracking-tight">SWINGZ</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:inline">
                est. 2026
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-7 text-sm">
              <Link
                href="#section-features"
                className="link-mask text-foreground/70 hover:text-foreground transition-colors"
              >
                Funktionen
              </Link>
              <Link
                href="#section-how"
                className="link-mask text-foreground/70 hover:text-foreground transition-colors"
              >
                Ablauf
              </Link>
              <Link
                href="#section-pricing"
                className="link-mask text-foreground/70 hover:text-foreground transition-colors"
              >
                Preise
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex font-mono text-[11px] uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors px-2"
                onClick={() => analytics.featureUsed('header_login')}
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="group inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-primary-foreground text-sm font-medium rounded-sm hover:bg-brand-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => analytics.signUp('header_cta', 'default')}
              >
                Probetraining
                <ArrowUpRight
                  className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <SectionReveal
        as="section"
        aria-labelledby="hero-heading"
        className="relative overflow-hidden pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-32"
      >
        {/* Phase 4: Scroll-progress sentinel — writes --hero-progress to
            the SectionReveal `<section>` (its offsetParent, which has
            position: relative from the className). Headline accent and
            video layer both read this single variable for unified
            in-lockstep animation. */}
        <HeroScrollProgress />
        <HeroVideoSlot enabled>
          <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
            {/* Eyebrow */}
            <p className="editorial-eyebrow text-brand-accent mb-8 sm:mb-10 flex items-center gap-3">
              <span aria-hidden="true">◆</span>
              <span>Issue 01 — Tennis Club Management</span>
              <span className="rule-clay" aria-hidden="true" />
              <span className="hidden sm:inline">Munich · 2026</span>
            </p>

            {/* Headline — italic Court-Clay accent is the Phase 4
                scroll-driven "breathing" element via `.hero-headline-accent`. */}
            <h1
              id="hero-heading"
              className="font-editorial editorial-display text-foreground max-w-5xl"
            >
              Die Kunst{' '}
              <em className="italic text-brand-primary hero-headline-accent">der ruhigen Hand</em>
              <span className="block mt-2 text-foreground/40">im Vereinshaus.</span>
            </h1>

            {/* Sub */}
            <p className="mt-8 sm:mt-10 max-w-2xl text-lg sm:text-xl text-foreground/70 leading-relaxed">
              Wo Vereinsführung auf Mitgliederachtsamkeit trifft — eine Plattform für Planung,
              Buchung und Abrechnung. Hergestellt in München, gehostet in der EU.
            </p>

            {/* CTAs */}
            <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-brand-primary text-primary-foreground font-medium rounded-sm hover:bg-brand-primary/90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
                onClick={() => analytics.signUp('hero_cta_primary', 'default')}
              >
                Kostenlos testen
                <ArrowUpRight
                  className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="#section-features"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 border border-foreground/15 text-foreground font-medium rounded-sm hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Funktionen erkunden
                <span
                  aria-hidden="true"
                  className="text-foreground/40 group-hover:translate-x-0.5 transition-transform"
                >
                  ↓
                </span>
              </Link>
            </div>

            {/* Metadata strip */}
            <div className="mt-16 sm:mt-24 pt-6 hairline-t flex flex-wrap items-baseline gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span>SWINGZ GmbH</span>
              <span aria-hidden="true">·</span>
              <span>Munich, DE</span>
              <span aria-hidden="true">·</span>
              <span>Hosting EU</span>
              <span aria-hidden="true">·</span>
              <span>DSGVO-konform</span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">14 Tage Testphase</span>
            </div>
          </div>
        </HeroVideoSlot>
      </SectionReveal>

      {/* ═══════════ BENTO FEATURES ═══════════ */}
      <BentoSection />

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <SectionReveal
        as="section"
        id="section-how"
        aria-labelledby="how-heading"
        className="py-20 sm:py-32 bg-foreground/[0.015] hairline-t"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <p className="editorial-eyebrow text-brand-accent mb-5 inline-flex items-center gap-3">
              <span className="rule-clay" aria-hidden="true" />
              In drei Schritten
              <span className="rule-clay" aria-hidden="true" />
            </p>
            <h2
              id="how-heading"
              className="font-editorial text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight max-w-3xl mx-auto"
            >
              Vom Probetraining zur <em className="italic text-brand-primary">ganzen Saison</em>.
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-px max-w-5xl mx-auto bg-foreground/10 border border-foreground/10 rounded-sm overflow-hidden">
            {HOW_STEPS.map((step) => (
              <li
                key={step.numeral}
                className="relative bg-background p-8 sm:p-10 transition-colors hover:bg-foreground/[0.015]"
              >
                <span
                  className="font-editorial italic text-7xl sm:text-8xl text-brand-accent/70 block leading-none mb-6"
                  aria-hidden="true"
                >
                  {step.numeral}
                </span>
                <h3 className="font-editorial text-xl sm:text-2xl text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </SectionReveal>

      {/* ═══════════ PRICING (lazy via next/dynamic, ssr:true) ═══════════ */}
      <SectionReveal
        as="section"
        id="section-pricing"
        aria-labelledby="pricing-heading"
        className="py-20 sm:py-32 hairline-t"
      >
        <h2 id="pricing-heading" className="sr-only">
          Preise
        </h2>
        <PricingSection />
      </SectionReveal>

      {/* ═══════════ CTA ═══════════ */}
      <SectionReveal
        as="section"
        aria-labelledby="cta-heading"
        className="py-24 sm:py-40 bg-foreground text-background hairline-t relative overflow-hidden"
      >
        <div className="absolute inset-0 paper-grain opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
          <p className="editorial-eyebrow text-brand-accent mb-6 inline-flex items-center gap-3">
            <span className="rule-clay" aria-hidden="true" />
            Bereit
            <span className="rule-clay" aria-hidden="true" />
          </p>
          <h2
            id="cta-heading"
            className="font-editorial text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-background tracking-tight"
          >
            Beginne deine <em className="italic text-brand-accent">Saison</em>.
          </h2>
          <p className="mt-6 sm:mt-8 max-w-2xl mx-auto text-base sm:text-lg text-background/65 leading-relaxed">
            14 Tage kostenlos. Keine Kreditkarte. Volle Plattform. Auf Wunsch richten wir deinen
            Club persönlich ein.
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 px-8 py-4 bg-background text-foreground font-medium rounded-sm hover:bg-background/90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground active:scale-[0.98]"
            >
              Kostenlos registrieren
              <ArrowUpRight
                className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2.5 px-8 py-4 border border-background/30 text-background font-medium rounded-sm hover:border-background/60 hover:bg-background/[0.04] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-background/40 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Persönlich sprechen
            </Link>
          </div>
        </div>
      </SectionReveal>

      {/* ═══════════ FOOTER ═══════════ */}
      <FooterSection />
    </div>
  );
}
