'use client';

/**
 * Landing Page — App-Design
 *
 * Nutzt dieselbe Designsprache wie die App (Login/Dashboard):
 * dunkelgrüner Gradient-Hero mit Aurora-Blobs (wie /login),
 * font-display Headlines, shadcn Button/Card, FeatureCard-Grid.
 *
 * Sections:
 *  1. Skip-Link (a11y)
 *  2. Site Nav (sticky, glass)
 *  3. Hero (bg-login-hero, Aurora, 2 CTAs)
 *  4. Features (FeatureCard-Grid)
 *  5. Ablauf (3 Schritte)
 *  6. Preise (Client-Chunk, lazy via next/dynamic — Billing-Toggle)
 *  7. CTA (gradient-primary Panel)
 *  8. Footer
 */

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/external/supabase/client';
import { analytics } from '@/lib/analytics';
import { ArrowRight, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { Card } from '@/components/ui/card';

import { SectionReveal } from './_components/section-reveal';
import { BentoSection } from './_components/bento-section';
import { FooterSection } from './_components/footer-section';

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
    title: 'Registrieren',
    body: 'Erstellt euren Club in wenigen Minuten und legt direkt los.',
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
      <header className="sticky top-0 z-40 glass">
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
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login" onClick={() => analytics.featureUsed('header_login')}>
                  Anmelden
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register" onClick={() => analytics.signUp('header_cta', 'default')}>
                  Jetzt registrieren
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
        {/* Aurora blobs — gleiche Deko wie /login */}
        <div className="absolute inset-0 opacity-25 overflow-hidden" aria-hidden="true">
          <div className="absolute top-20 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
          <div className="absolute top-40 right-20 w-64 h-64 bg-brand-accent/8 rounded-full blur-3xl animate-aurora [animation-delay:5s]" />
          <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-brand-secondary/10 rounded-full blur-3xl animate-aurora [animation-delay:10s]" />
        </div>
        <div className="absolute inset-0 noise opacity-[0.04]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-20 sm:pt-28 lg:pt-32 pb-20 sm:pb-28">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80 mb-8 animate-in">
            <Sparkles className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
            Modernes Tennisclub-Management
          </div>

          {/* Headline */}
          <h1
            id="hero-heading"
            className="font-display text-4xl sm:text-hero-md lg:text-hero-lg font-extrabold tracking-tight max-w-4xl animate-in animate-in-delay-1"
          >
            Dein Tennisclub.
            <span className="block text-gradient-accent">Intelligent verwaltet.</span>
          </h1>

          {/* Sub */}
          <p className="mt-6 max-w-2xl text-lg sm:text-xl text-white/70 leading-relaxed animate-in animate-in-delay-2">
            Eine Plattform für Trainingsplanung, Buchungen und Abrechnung — damit ihr euch aufs
            Vereinsleben konzentrieren könnt. Hergestellt in München, gehostet in der EU.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-in animate-in-delay-3">
            <Button size="lg" asChild>
              <Link
                href="/register"
                onClick={() => analytics.signUp('hero_cta_primary', 'default')}
              >
                Jetzt registrieren
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

          {/* Trust strip */}
          <div className="mt-16 pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50 animate-in animate-in-delay-4">
            <span>DSGVO-konform</span>
            <span aria-hidden="true">·</span>
            <span>EU-Hosting</span>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <BentoSection />

      {/* ═══════════ ABLAUF ═══════════ */}
      <SectionReveal
        as="section"
        id="section-how"
        aria-labelledby="how-heading"
        className="py-20 sm:py-28 bg-muted/50"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
              In drei Schritten
            </p>
            <h2
              id="how-heading"
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground max-w-3xl mx-auto"
            >
              Von der Anmeldung zur ganzen Saison
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {HOW_STEPS.map((step) => (
              <li key={step.step}>
                <Card padding="xl" className="h-full">
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-light text-white text-lg font-bold shadow-lg"
                    aria-hidden="true"
                  >
                    {step.step}
                  </div>
                  <h3 className="text-xl font-bold text-foreground dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </Card>
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
        <h2 id="pricing-heading" className="sr-only">
          Preise
        </h2>
        <PricingSection />
      </SectionReveal>

      {/* ═══════════ CTA ═══════════ */}
      <SectionReveal as="section" aria-labelledby="cta-heading" className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary text-white px-6 py-16 sm:px-16 sm:py-20 text-center shadow-strong">
            <div className="absolute inset-0 noise opacity-[0.04]" aria-hidden="true" />
            <div className="relative">
              <h2
                id="cta-heading"
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
              >
                Bereit für die neue Saison?
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-white/75 leading-relaxed">
                Volle Plattform, transparente Preise. Auf Wunsch richten wir deinen Club persönlich
                ein.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="bg-white text-brand-primary hover:bg-white/90 hover:brightness-100"
                  asChild
                >
                  <Link href="/register">
                    Jetzt registrieren
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
        </div>
      </SectionReveal>

      {/* ═══════════ FOOTER ═══════════ */}
      <FooterSection />
    </div>
  );
}
