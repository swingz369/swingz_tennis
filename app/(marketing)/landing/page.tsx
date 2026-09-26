'use client';

/**
 * Landing Page
 *
 * Nutzt dieselbe Designsprache wie die App (Login/Dashboard):
 * dunkelgrüner Gradient-Hero mit Aurora-Blobs (wie /login),
 * font-display Headlines, shadcn Button/Card, FeatureCard-Grid.
 *
 * Sections: Skip-Link, Nav, Hero (Split mit Produktbild), Trust-Band,
 * Features (asymmetrisches Raster), Ablauf (Liste), Preise (lazy), CTA, Footer.
 */

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/external/supabase/client';
import { analytics } from '@/lib/analytics';
import { ArrowRight, Trophy, ShieldCheck, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';

import { SectionReveal } from './_components/section-reveal';
import { BentoSection } from './_components/bento-section';
import { FooterSection } from './_components/footer-section';
import { HeroShowcase } from './_components/hero-showcase';

// PricingSection ist die einzige Client-Komponente mit interaktivem State
// (Billing-Toggle) — lazy-hydrieren, initiales HTML rendert trotzdem (ssr:true).
const PricingSection = dynamic(
  () => import('./_components/pricing-section').then((m) => ({ default: m.PricingSection })),
  {
    ssr: true,
    loading: () => (
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8" aria-hidden="true">
        <div className="h-32 skeleton" />
      </div>
    ),
  }
);

const HOW_STEPS = [
  {
    step: '1',
    title: 'Zugang anfragen',
    body: 'Erzählt uns kurz von eurem Verein und den Aufgaben, die ihr vereinfachen möchtet.',
  },
  {
    step: '2',
    title: 'Konfigurieren',
    body: 'Wir richten euren Club persönlich ein und begleiten das Onboarding.',
  },
  {
    step: '3',
    title: 'Durchstarten',
    body: 'Plant Trainingseinheiten, verwaltet Buchungen, organisiert die ganze Saison.',
  },
];

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
    <div id="main-content" className="bg-background text-foreground" suppressHydrationWarning>
      {/* ═══════════ SKIP LINK (A11y) ═══════════ */}
      <a
        href="#section-features"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-primary-foreground focus:rounded-xl focus:font-medium focus:shadow-lg"
      >
        Direkt zum Inhalt springen
      </a>

      {/* ═══════════ SITE NAV ═══════════ */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <IconBox icon={Trophy} size="sm" variant="gradient-primary" />
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                SWINGZ
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="#section-features"
                className="py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                Funktionen
              </Link>
              <Link
                href="#section-how"
                className="py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                Ablauf
              </Link>
              <Link
                href="#section-pricing"
                className="py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                Preise
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login" onClick={() => analytics.featureUsed('header_login')}>
                  Anmelden
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register" onClick={() => analytics.signUp('header_cta', 'default')}>
                  Zugang anfragen
                  <ArrowRight className="h-4 w-4 hidden sm:inline" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden bg-login-hero text-white"
      >
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-16 lg:pt-24 pb-16 sm:pb-20 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1
              id="hero-heading"
              className="font-display text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight animate-in"
            >
              Dein Tennisclub.
              <span className="block text-brand-light">Übersichtlich verwaltet.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg sm:text-xl text-white/70 leading-relaxed animate-in animate-in-delay-1">
              Trainingsplanung, Buchungen und Abrechnung an einem Ort. Gehostet in der EU.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-in animate-in-delay-2">
              <Button size="lg" asChild>
                <Link
                  href="/register"
                  onClick={() => analytics.signUp('hero_cta_primary', 'default')}
                >
                  Zugang anfragen
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:border-white/40 hover:text-white hover:bg-white/5"
                asChild
              >
                <Link href="/demo" onClick={() => analytics.featureUsed('hero_cta_demo')}>
                  Demo ansehen
                </Link>
              </Button>
            </div>
          </div>

          <div className="animate-in animate-in-delay-3">
            <HeroShowcase />
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST-BAND ═══════════ */}
      <div className="border-b border-border bg-muted/40">
        <ul className="mx-auto max-w-7xl px-6 lg:px-8 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            DSGVO-konform
          </li>
          <li className="inline-flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            Hosting in der EU
          </li>
        </ul>
      </div>

      {/* ═══════════ FEATURES ═══════════ */}
      <BentoSection />

      {/* ═══════════ ABLAUF ═══════════ */}
      <SectionReveal
        as="section"
        id="section-how"
        aria-labelledby="how-heading"
        className="py-20 sm:py-28 bg-muted/50"
      >
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2
            id="how-heading"
            className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-10 sm:mb-14"
          >
            Von der Anmeldung zur ganzen Saison
          </h2>

          <ol className="divide-y divide-border">
            {HOW_STEPS.map((step) => (
              <li key={step.step} className="flex gap-6 py-6 first:pt-0 last:pb-0">
                <span
                  className="font-display text-4xl font-extrabold text-brand-primary/40 tabular-nums w-10 shrink-0"
                  aria-hidden="true"
                >
                  {step.step}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </SectionReveal>

      {/* ═══════════ PREISE (lazy via next/dynamic, ssr:true) ═══════════ */}
      <SectionReveal
        as="section"
        id="section-pricing"
        aria-labelledby="pricing-heading"
        className="py-20 sm:py-28"
      >
        <PricingSection />
      </SectionReveal>

      {/* ═══════════ CTA ═══════════ */}
      <SectionReveal as="section" aria-labelledby="cta-heading" className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="rounded-xl bg-brand-secondary text-white px-6 py-14 sm:px-16 sm:py-16 text-center">
            <h2
              id="cta-heading"
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
            >
              Bereit für die neue Saison?
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-white/75 leading-relaxed">
              Transparente Preise. Wir richten euren Zugang persönlich ein und begleiten den Start.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-white text-brand-secondary hover:bg-white/90 hover:brightness-100"
                asChild
              >
                <Link href="/register">
                  Zugang anfragen
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:border-white/60 hover:text-white hover:bg-white/5"
                asChild
              >
                <Link href="/contact">Persönlich sprechen</Link>
              </Button>
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* ═══════════ FOOTER ═══════════ */}
      <FooterSection />
    </div>
  );
}
