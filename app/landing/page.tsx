'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FeatureCard, StatsCard } from '@/components/ui';
import { createClient } from '@/infrastructure/external/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { analytics } from '@/lib/analytics';
import { getVariant } from '@/lib/experiments';
import {
  Trophy,
  BarChart3,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
  Calendar,
  Brain,
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  // A/B test: hero CTA text variant
  const heroCtaVariant = getVariant('landing_hero_cta');

  useEffect(() => {
    const cookies = document.cookie.split(';');
    const hasDemoMode = cookies.some((c) => c.trim().startsWith('demo-mode='));
    if (hasDemoMode) {
      router.replace('/dashboard');
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (data.session?.user) {
        router.replace('/dashboard');
      }
    });
  }, [router, heroCtaVariant]); // heroCtaVariant added to deps

  // Track experiment exposure on mount
  useEffect(() => {
    if (heroCtaVariant) {
      analytics.trackEvent('experiment_exposure', {
        experiment_key: 'landing_hero_cta',
        variant: heroCtaVariant,
      });
    }
  }, [heroCtaVariant]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header – Transparente Blase */}
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-24 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brandPrimary to-[#2D6A4F]"
                style={{ boxShadow: '0 12px 40px -8px rgba(27, 67, 50, 0.6)' }}
              >
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <span className="text-3xl font-bold text-white tracking-tight">SWINGZ</span>
            </Link>
            <div className="hidden md:flex md:items-center md:gap-4">
              <Link href="/login">
                <Button
                  size="md"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={() => analytics.featureUsed('header_login')}
                >
                  Anmelden
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="md"
                  variant="accent"
                  onClick={() => analytics.signUp('landing_header')}
                >
                  Kostenlos starten
                </Button>
              </Link>
            </div>
            <div className="md:hidden">
              <Link href="/login">
                <Button size="sm" variant="accent">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero – Deep Gradient (arbitrary value, never purged) */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0A3D2E_0%,#1B4332_50%,#2D6A4F_100%)] pt-32 pb-24">
        {/* Background blobs */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#40916C_0%,#1B4332_100%)] opacity-30" />
        <div className="absolute -bottom-1/4 -left-1/4 h-96 w-96 rounded-full bg-[#FF6B35]/20 blur-3xl" />
        <div className="absolute -top-1/4 -right-1/4 h-96 w-96 rounded-full bg-[#1B4332]/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge – Floating subtle */}
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md border border-white/10 shadow-lg"
              style={{ animation: 'float 3s ease-in-out infinite' }}
            >
              <Sparkles className="h-4 w-4 text-[#FF6B35]" />
              KI-gestützte Saisonplanung für Tennisvereine
            </div>

            {/* Main Headline – Professional Typography */}
            <h1
              className="mb-6 text-hero-lg font-extrabold leading-tight text-white tracking-tight"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Optimale Trainingspläne.{' '}
              <span className="bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#40916C] bg-clip-text text-transparent">
                Maximale Performance.
              </span>
            </h1>

            {/* Subline – Clear, benefit-driven */}
            <p className="mx-auto mb-10 max-w-2xl text-lg text-white/90 leading-relaxed font-medium">
              Die KI-gesteuerte Scheduler-Plattform für Tennisclubs. Automatisiere die
              Trainingsplanung, erhöhe die Auslastung und gib deinen Mitgliedern das beste Erlebnis.
            </p>

            {/* CTA Buttons – Primary + Secondary */}
            <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/login">
                <button
                  type="button"
                  className="min-w-[200px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#40916C] text-white px-8 py-4 text-lg font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:ring-offset-2"
                  style={{
                    boxShadow:
                      '0 12px 40px -8px rgba(27, 67, 50, 0.5), 0 8px 24px -4px rgba(27, 67, 50, 0.35)',
                  }}
                  onClick={() => analytics.signUp('landing_hero_cta', heroCtaVariant || 'default')}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {heroCtaVariant || 'Demo starten'}
                </button>
              </Link>
              <Link href="/login">
                <button
                  type="button"
                  className="min-w-[200px] inline-flex items-center justify-center gap-2 rounded-full bg-[#1e3a5f] text-white px-8 py-4 text-lg font-medium transition-all duration-200 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-2 active:scale-[0.98] shadow-[0_8px_24px_-4px_rgba(30,58,95,0.3)]"
                  onClick={() => analytics.featureUsed('landing_learn_more')}
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Mehr erfahren
                </button>
              </Link>
            </div>

            {/* Hero Visual – 3D Tennisball with Court Lines */}
            <div className="relative mx-auto mt-8 flex max-w-3xl items-center justify-center">
              {/* Floating tennis ball illustration */}
              <div className="relative" style={{ animation: 'float 3s ease-in-out infinite' }}>
                <svg
                  width="280"
                  height="280"
                  viewBox="0 0 200 200"
                  style={{ filter: 'drop-shadow(0 12px 40px rgba(27, 67, 50, 0.5))' }}
                >
                  {/* Tennis ball body */}
                  <defs>
                    <radialGradient id="ballGrad" cx="30%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#52B788" />
                      <stop offset="50%" stopColor="#1B4332" />
                      <stop offset="100%" stopColor="#0A3D2E" />
                    </radialGradient>
                    <filter id="ballShadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow
                        dx="0"
                        dy="20"
                        stdDeviation="20"
                        floodColor="rgba(27,67,50,0.4)"
                      />
                    </filter>
                  </defs>
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="url(#ballGrad)"
                    filter="url(#ballShadow)"
                  />
                  {/* White curved lines */}
                  <path
                    d="M100 10 A 70 70 0 0 1 100 190"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    opacity="0.9"
                  />
                  <path
                    d="M100 25 A 65 65 0 0 1 100 175"
                    stroke="white"
                    strokeWidth="6"
                    fill="none"
                    opacity="0.7"
                  />
                  <path
                    d="M100 40 A 60 60 0 0 1 100 160"
                    stroke="white"
                    strokeWidth="5"
                    fill="none"
                    opacity="0.5"
                  />
                  {/* Highlight reflection */}
                  <ellipse
                    cx="60"
                    cy="60"
                    rx="30"
                    ry="20"
                    fill="white"
                    opacity="0.2"
                    transform="rotate(-45 60 60)"
                  />
                </svg>
              </div>

              {/* Decorative court lines – subtle */}
              <div className="absolute inset-0 opacity-10">
                <svg viewBox="0 0 400 400" className="h-full w-full">
                  <path d="M50 100 L350 100" stroke="white" strokeWidth="4" />
                  <path d="M50 300 L350 300" stroke="white" strokeWidth="4" />
                  <path d="M200 50 L200 350" stroke="white" strokeWidth="4" />
                  <circle cx="200" cy="200" r="60" stroke="white" strokeWidth="4" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="h-24 w-full"
          >
            <path
              d="M0 120L60 110C120 100 240 80 360 75C480 70 600 80 720 85C840 90 960 90 1080 85C1200 80 1320 70 1380 65L1440 60V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Stats Section – Quick Social Proof */}
      <section className="relative -mt-12 z-10 bg-white pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatsCard label="Vereine aktiv" value="1,200+" icon={<Shield className="h-6 w-6" />} />
            <StatsCard
              label="Trainings geplant"
              value="50K+"
              icon={<Calendar className="h-6 w-6" />}
            />
            <StatsCard
              label="Mitglieder verwaltet"
              value="85K+"
              icon={<Users className="h-6 w-6" />}
            />
            <StatsCard label="KI-Optimierungen" value="10K+" icon={<Brain className="h-6 w-6" />} />
          </div>
        </div>
      </section>

      {/* Features Section – Premium Card Grid */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2
              className="text-hero-md mb-4 font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Warum SWINGZ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Revolutioniere deine Trainingsplanung mit modernster KI und professionellem Design.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Brain className="h-8 w-8 text-brandPrimary" />}
              title="KI-gestützte Optimierung"
              description="Automatische Wochenplanung unter Berücksichtigung von Trainer-Kapazitäten, Gruppenbedürfnissen und Hallenverfügbarkeit."
              highlight
            />
            <FeatureCard
              icon={<Calendar className="h-8 w-8 text-brandAccent" />}
              title="Intuitive Buchungsansicht"
              description="Monatskalender mit Drag & Drop – verschiebe Sessions mit einem Klick und sieh sofort Verfügbarkeiten."
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8 text-brandPrimary" />}
              title="Echtzeit Analytics"
              description="Umfassende Dashboards mit KPIs, Auslastungsstatistiken und KI-Genauigkeit auf einen Blick."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-brandAccent" />}
              title="Mitglieder-Management"
              description="Verwalte alle Mitglieder, Gruppen und Buchungen zentral – mit personalisierten Zugängen."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-brandPrimary" />}
              title="Sicher & Skalierbar"
              description="Enterprise-Grade Security mit Role-Based Access und Multi-Club-Support für große Verbände."
            />
            <FeatureCard
              icon={<Sparkles className="h-8 w-8 text-brandAccent" />}
              title="Demo-Modus"
              description="Probiere alle Funktionen sofort aus – kein Account nötig. Starte in unter 30 Sekunden."
            />
          </div>
        </div>
      </section>

      {/* CTA Section – Final push */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brandPrimary to-[#0A3D2E] pb-24">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="mb-6 text-hero-md font-bold text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Bereit für die nächste Saison?
            </h2>
            <p className="mb-10 text-xl text-white/90">
              Starte jetzt kostenlos und erlebe die Zukunft des Vereinsmanagements.
            </p>
            <Link href="/login">
              <button
                type="button"
                className="min-w-[200px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#40916C] text-white px-8 py-4 text-lg font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#1B4332] focus:ring-offset-2"
                style={{
                  boxShadow:
                    '0 12px 40px -8px rgba(27, 67, 50, 0.5), 0 8px 24px -4px rgba(27, 67, 50, 0.35)',
                }}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Demo starten
              </button>
            </Link>
            <Link href="/login">
              <button
                type="button"
                className="min-w-[200px] inline-flex items-center justify-center gap-2 rounded-full bg-[#1e3a5f] text-white px-8 py-4 text-lg font-medium transition-all duration-200 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-2 active:scale-[0.98] shadow-[0_8px_24px_-4px_rgba(30,58,95,0.3)]"
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Mehr erfahren
              </button>
            </Link>
            <p className="mt-4 text-white/70 text-sm">
              Keine Kreditkarte erforderlich – 30 Tage kostenlos testen.
            </p>
          </div>
        </div>
      </section>

      {/* Footer – Simple */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brandPrimary to-[#2D6A4F]">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">SWINGZ</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2025 SWINGZ – Revolutionizing Tennis Club Management.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
