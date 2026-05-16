'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  Zap,
  ChevronRight,
  Play,
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
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
  }, [router, heroCtaVariant]);

  useEffect(() => {
    if (heroCtaVariant) {
      analytics.trackEvent('experiment_exposure', {
        experiment_key: 'landing_hero_cta',
        variant: heroCtaVariant,
      });
    }
  }, [heroCtaVariant]);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-light shadow-lg">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">SWINGZ</span>
            </Link>

            <div className="hidden md:flex md:items-center md:gap-3">
              <Link href="/login">
                <Button
                  size="md"
                  variant="ghost"
                  className="text-white/90 hover:text-white hover:bg-white/10 border border-white/20 backdrop-blur-sm"
                  onClick={() => analytics.featureUsed('header_login')}
                >
                  Anmelden
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="md"
                  variant="accent"
                  className="shadow-glow-accent"
                  onClick={() => analytics.signUp('landing_header')}
                >
                  Kostenlos starten
                  <ArrowRight className="ml-1.5 h-4 w-4" />
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
          </nav>
        </div>
      </header>

      <section className="relative min-h-[100svh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--brand-primary-light) / 0.3) 0%, transparent 50%),
                radial-gradient(ellipse 60% 40% at 100% 50%, hsl(var(--brand-secondary) / 0.2) 0%, transparent 50%),
                radial-gradient(ellipse 50% 50% at 0% 80%, hsl(var(--brand-accent) / 0.1) 0%, transparent 50%),
                linear-gradient(180deg, hsl(150 50% 12%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 10%) 100%)
              `,
            }}
          />

          <div className="absolute inset-0 opacity-20 overflow-hidden">
            <div className="absolute top-20 left-10 w-36 sm:w-48 h-36 sm:h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div
              className="absolute top-40 right-20 w-48 sm:w-64 h-48 sm:h-64 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
              style={{ animationDelay: '5s' }}
            />
          </div>

          <div className="absolute inset-0 noise opacity-[0.02]" />

          <svg
            className="absolute inset-0 w-full h-full opacity-[0.03]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="animate-in animate-in-delay-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                  </span>
                  KI-gestützte Saisonplanung
                </div>
              </div>

              <h1 className="animate-in animate-in-delay-2">
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight">
                  Optimale
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mt-2">
                  <span className="text-gradient-primary bg-clip-text text-transparent">
                    Trainingspläne.
                  </span>
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mt-2">
                  Maximale
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mt-2">
                  <span className="text-gradient-accent bg-clip-text text-transparent">
                    Performance.
                  </span>
                </span>
              </h1>

              <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-white/70 leading-relaxed max-w-xl mx-auto lg:mx-0 animate-in animate-in-delay-3">
                Die KI-gesteuerte Scheduler-Plattform für Tennisclubs. Automatisiere die
                Trainingsplanung, erhöhe die Auslastung und biete deinen Mitgliedern ein
                <span className="text-white font-medium"> Premium-Erlebnis</span>.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start animate-in animate-in-delay-4">
                <Link href="/login">
                  <button
                    type="button"
                    className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary via-brand-primary/80 to-brand-light px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all duration-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-light focus:ring-offset-2 focus:ring-offset-brand-950 overflow-hidden min-h-[48px]"
                    style={{
                      boxShadow:
                        '0 0 60px -12px hsl(var(--brand-primary-light) / 0.5), 0 8px 32px -8px hsl(var(--brand-primary) / 0.4)',
                    }}
                    onClick={() =>
                      analytics.signUp('landing_hero_cta', heroCtaVariant || 'default')
                    }
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <Sparkles className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">{heroCtaVariant || 'Demo starten'}</span>
                    <ChevronRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/login">
                  <button
                    type="button"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-medium text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-brand-950 min-h-[48px]"
                    onClick={() => analytics.featureUsed('landing_learn_more')}
                  >
                    <Play className="h-5 w-5" />
                    Mehr erfahren
                  </button>
                </Link>
              </div>

              <div className="mt-10 sm:mt-12 flex items-center gap-6 sm:gap-8 justify-center lg:justify-start animate-in animate-in-delay-5">
                <div className="flex -space-x-3">
                  {['A', 'M', 'S', 'L'].map((letter, i) => (
                    <div
                      key={i}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-brand-light to-brand-primary border-2 border-brand-950 flex items-center justify-center text-white text-xs sm:text-sm font-semibold"
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold">1,200+ Vereine</p>
                  <p className="text-white/60 text-sm">vertrauen auf SWINGZ</p>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/20 to-brand-light/20 rounded-3xl blur-3xl" />

                <div className="relative animate-float">
                  <svg width="400" height="400" viewBox="0 0 200 200" className="drop-shadow-2xl">
                    <defs>
                      <radialGradient id="ballGradient" cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="hsl(150 38% 63%)" />
                        <stop offset="40%" stopColor="hsl(var(--brand-primary-light))" />
                        <stop offset="70%" stopColor="hsl(var(--brand-primary))" />
                        <stop offset="100%" stopColor="hsl(150 50% 12%)" />
                      </radialGradient>
                      <filter id="ballGlitch" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow
                          dx="0"
                          dy="25"
                          stdDeviation="25"
                          floodColor="hsl(var(--brand-primary) / 0.5)"
                        />
                      </filter>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="hsl(0 0% 100% / 0.9)" />
                        <stop offset="100%" stopColor="hsl(0 0% 100% / 0.7)" />
                      </linearGradient>
                    </defs>

                    <circle
                      cx="100"
                      cy="100"
                      r="85"
                      fill="url(#ballGradient)"
                      filter="url(#ballGlitch)"
                    />

                    <path
                      d="M100 15 A 70 70 0 0 1 100 185"
                      stroke="url(#lineGradient)"
                      strokeWidth="6"
                      fill="none"
                    />
                    <path
                      d="M100 30 A 60 60 0 0 1 100 170"
                      stroke="white"
                      strokeWidth="4"
                      fill="none"
                      opacity="0.6"
                    />
                    <path
                      d="M100 45 A 50 50 0 0 1 100 155"
                      stroke="white"
                      strokeWidth="3"
                      fill="none"
                      opacity="0.4"
                    />

                    <ellipse
                      cx="55"
                      cy="55"
                      rx="35"
                      ry="22"
                      fill="white"
                      opacity="0.15"
                      transform="rotate(-50 55 55)"
                    />

                    <circle
                      cx="100"
                      cy="100"
                      r="20"
                      fill="none"
                      stroke="white"
                      strokeWidth="0.5"
                      opacity="0.2"
                    />
                  </svg>
                </div>

                <div className="absolute -top-8 -right-8 w-28 h-28 bg-gradient-to-br from-brand-accent/20 to-transparent rounded-full blur-2xl opacity-70" />
              </div>

              <div className="absolute top-10 right-0 glass-dark rounded-2xl p-4 shadow-2xl animate-float-slow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-accent to-orange-700 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">KI-Optimierung</p>
                    <p className="text-white/60 text-xs">+47% Effizienz</p>
                  </div>
                </div>
              </div>

              <div
                className="absolute bottom-20 -left-10 glass-dark rounded-2xl p-4 shadow-2xl animate-float-slow"
                style={{ animationDelay: '2s' }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Auto-Scheduling</p>
                    <p className="text-white/60 text-xs">50+ Plätze</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="w-full h-32"
          >
            <path
              d="M0 200L60 190C120 180 240 160 360 150C480 140 600 140 720 145C840 150 960 160 1080 165C1200 170 1320 170 1380 170L1440 170V200H1380C1320 200 1200 200 1080 200C960 200 840 200 720 200C600 200 480 200 360 200C240 200 120 200 60 200H0Z"
              fill="white"
              fillOpacity="0.02"
            />
            <path
              d="M0 200L60 195C120 190 240 180 360 170C480 160 600 150 720 150C840 150 960 160 1080 165C1200 170 1320 175 1380 177L1440 180V200H1380C1320 200 1200 200 1080 200C960 200 840 200 720 200C600 200 480 200 360 200C240 200 120 200 60 200H0Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      <section className="relative -mt-1 z-10 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                label: 'Aktive Vereine',
                value: '1,200+',
                icon: Shield,
                color: 'bg-gradient-to-br from-brand-light to-brand-primary',
              },
              {
                label: 'Trainings geplant',
                value: '50K+',
                icon: Calendar,
                color: 'from-brand-accent to-orange-700',
              },
              {
                label: 'Mitglieder',
                value: '85K+',
                icon: Users,
                color: 'from-brand-secondary to-blue-800',
              },
              {
                label: 'KI-Optimierungen',
                value: '10K+',
                icon: Brain,
                color: 'from-brand-light to-brand-primary',
              },
            ].map((stat, idx) => (
              <div key={idx} className="text-center group">
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.color} text-white shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <stat.icon className="h-7 w-7" />
                </div>
                <p className="text-4xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gray-100 to-transparent opacity-50" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-14 sm:mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
              Warum{' '}
              <span className="text-gradient-primary bg-clip-text text-transparent">SWINGZ</span>?
            </h2>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Revolutioniere deine Trainingsplanung mit modernster KI und durchdachtem Design.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'KI-gestützte Optimierung',
                description:
                  'Automatische Wochenplanung unter Berücksichtigung von Trainer-Kapazitäten, Gruppenbedürfnissen und Hallenverfügbarkeit.',
                gradient: 'bg-gradient-to-br from-brand-light to-brand-primary',
                highlight: true,
              },
              {
                icon: Calendar,
                title: 'Intuitive Buchungsansicht',
                description:
                  'Monatskalender mit Drag & Drop – verschiebe Sessions mit einem Klick und sieh sofort Verfügbarkeiten.',
                gradient: 'from-brand-accent to-orange-700',
              },
              {
                icon: BarChart3,
                title: 'Echtzeit Analytics',
                description:
                  'Umfassende Dashboards mit KPIs, Auslastungsstatistiken und KI-Genauigkeit auf einen Blick.',
                gradient: 'from-brand-secondary to-blue-700',
              },
              {
                icon: Users,
                title: 'Mitglieder-Management',
                description:
                  'Verwalte alle Mitglieder, Gruppen und Buchungen zentral – mit personalisierten Zugängen.',
                gradient: 'bg-gradient-accent',
              },
              {
                icon: Shield,
                title: 'Sicher & Skalierbar',
                description:
                  'Enterprise-Grade Security mit Role-Based Access und Multi-Club-Support für große Verbände.',
                gradient: 'from-brand-light to-brand-primary',
              },
              {
                icon: Zap,
                title: 'Demo-Modus',
                description:
                  'Probiere alle Funktionen sofort aus – kein Account nötig. Starte in unter 30 Sekunden.',
                gradient: 'from-brand-light to-brand-primary',
                highlight: true,
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className={`group relative bg-white rounded-3xl p-8 shadow-sm border border-gray-100 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 ${feature.highlight ? 'ring-2 ring-brand-primary/20' : ''}`}
              >
                {feature.highlight && (
                  <div className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-br from-brand-primary to-brand-light text-white text-xs font-semibold rounded-full">
                    Empfohlen
                  </div>
                )}
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 80% 50%, hsl(var(--brand-accent) / 0.15) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 50% 12%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 10%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 noise opacity-[0.03]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            Bereit für die nächste Saison?
          </h2>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">
            Starte jetzt kostenlos und erlebe die Zukunft des Vereinsmanagements.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/login">
              <button
                type="button"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-accent via-orange-400 to-orange-300 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all duration-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-950 min-h-[48px]"
                style={{
                  boxShadow:
                    '0 0 60px -12px hsl(var(--brand-accent) / 0.5), 0 8px 32px -8px hsl(var(--brand-accent) / 0.4)',
                }}
              >
                <Sparkles className="h-5 w-5" />
                Demo starten
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/login">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-medium text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[48px]"
              >
                <ArrowRight className="h-5 w-5" />
                Mehr erfahren
              </button>
            </Link>
          </div>

          <p className="mt-8 text-white/50 text-sm">
            Keine Kreditkarte erforderlich – 30 Tage kostenlos testen.
          </p>
        </div>
      </section>

      <footer className="bg-gray-900 py-12 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-950" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SWINGZ</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">
                Impressum
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Datenschutz
              </a>
              <a href="#" className="hover:text-white transition-colors">
                AGB
              </a>
            </div>

            <p className="text-sm text-gray-500">© 2025 SWINGZ – Premium Tennis Club Management</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
