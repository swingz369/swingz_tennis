'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { createClient } from '@/infrastructure/external/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { analytics } from '@/lib/analytics';
import { useExperiment } from '@/lib/experiments';
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
  CheckCircle2,
  CreditCard,
  MessageCircle,
} from 'lucide-react';

/* ── Animated Counter Hook ── */
function useCountUp(end: number, duration = 2000, startCounting: boolean) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!startCounting) return;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * end));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, startCounting]);

  return count;
}

/* ── Scroll Reveal Observer ── */
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ── Stat Item ── */
function StatItem({
  value,
  suffix,
  label,
  icon: Icon,
  color,
  visible,
}: {
  value: number;
  suffix: string;
  label: string;
  icon: React.ElementType;
  color: string;
  visible: boolean;
}) {
  const count = useCountUp(value, 2000, visible);

  return (
    <div className="text-center group">
      <div
        className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg mb-5 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-xl`}
      >
        <Icon className="h-8 w-8" />
      </div>
      <p className="text-5xl font-extrabold text-foreground tracking-tight tabular-nums">
        {count.toLocaleString()}
        {suffix}
      </p>
      <p className="text-sm text-muted-foreground mt-2 font-medium">{label}</p>
    </div>
  );
}

/* ── Testimonial Data ── */

/* ── Feature Data ── */
const FEATURES = [
  {
    icon: Brain,
    title: 'KI-gestützte Optimierung',
    description:
      'Automatische Wochenplanung mit Berücksichtigung von Trainer-Kapazitäten, Gruppenbedürfnissen und Hallenverfügbarkeit.',
    gradient: 'from-brand-primary to-brand-light',
    stat: '+47%',
    statLabel: 'Effizienz',
    highlight: true,
  },
  {
    icon: Calendar,
    title: 'Intuitive Buchungsansicht',
    description:
      'Monatskalender mit Drag & Drop — Sessions verschieben, Verfügbarkeiten prüfen, Konflikte in Echtzeit erkennen.',
    gradient: 'from-brand-accent to-orange-600',
    stat: '< 3s',
    statLabel: 'Buchungszeit',
  },
  {
    icon: BarChart3,
    title: 'Echtzeit Analytics',
    description:
      'Dashboards mit KPIs, Auslastungsstatistiken und Vorhersagen — alle Daten übersichtlich auf einem Bildschirm.',
    gradient: 'from-brand-secondary to-blue-700',
    stat: '24/7',
    statLabel: 'Live-Daten',
  },
  {
    icon: Users,
    title: 'Mitglieder-Management',
    description:
      'Verwalte Mitglieder, Gruppen und Buchungen zentral. Mit personalisierten Zugängen für jedes Mitglied.',
    gradient: 'from-green-500 to-green-700',
    stat: '',
    statLabel: '',
  },
  {
    icon: Shield,
    title: 'Sicher & Skalierbar',
    description: 'Role-Based Access und Multi-Club-Support — von Anfang an für Wachstum gebaut.',
    gradient: 'from-indigo-500 to-indigo-700',
    stat: '',
    statLabel: '',
  },
  {
    icon: Zap,
    title: 'Integrationen & API',
    description:
      'REST-API für nahtlose Anbindung an euren bestehenden Tech-Stack und eure Vereinswebsite.',
    gradient: 'from-amber-500 to-amber-700',
    stat: '',
    statLabel: '',
  },
];

/* ── PRICING ── */
const PRICING_PLANS = [
  {
    name: 'Starter',
    subtitle: 'Für kleine Vereine',
    price: '29',
    period: '/Monat',
    description: 'Alles was du brauchst, um deinen Verein digital zu verwalten.',
    features: [
      'Bis zu 50 Mitglieder',
      'Bis zu 3 Trainer',
      'Buchungs-Management',
      'Mitgliederverwaltung',
      'E-Mail-Support',
      'Sichere EU-Hosting',
    ],
    cta: 'Kostenlos testen',
    popular: false,
    iconColor: 'text-brand-secondary',
    borderHover: 'hover:border-brand-secondary/40',
  },
  {
    name: 'Professional',
    subtitle: 'Für wachsende Vereine',
    price: '79',
    period: '/Monat',
    description: 'KI-gestützte Planung und erweiterte Analytics für maximale Performance.',
    features: [
      'Unbegrenzte Mitglieder',
      'Unbegrenzte Trainer',
      'KI-Scheduling-Optimierung',
      'Erweiterte Analytics & Reports',
      'Saisonplanungs-Wizard',
      'Shop-Modul',
      'Priority-Support',
      'API-Zugang',
    ],
    cta: 'Kostenlos testen',
    popular: true,
    iconColor: 'text-brand-primary',
    borderHover: 'hover:border-brand-light/40',
  },
];

/* ── Platform Stats Hook ── */
function usePlatformStats() {
  const [stats, setStats] = useState({ clubs: 0, sessions: 0, members: 0 });

  useEffect(() => {
    fetch('/api/public/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {
        /* silent fail — keeps default values */
      });
  }, []);

  return stats;
}

export default function LandingPage() {
  const router = useRouter();
  const { variant: heroCtaVariant } = useExperiment('landing_hero_cta');
  const platformStats = usePlatformStats();

  const { ref: statsRef, visible: statsVisible } = useRevealOnScroll();

  useEffect(() => {
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
    <div
      id="main-content"
      className="min-h-screen bg-background overflow-hidden"
      suppressHydrationWarning
    >
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative min-h-[100svh] flex items-center overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Background Layers */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 60% at 50% -20%, hsl(var(--brand-primary-light) / 0.35) 0%, transparent 50%),
                radial-gradient(ellipse 70% 50% at 100% 50%, hsl(var(--brand-secondary) / 0.25) 0%, transparent 50%),
                radial-gradient(ellipse 60% 60% at 0% 80%, hsl(var(--brand-accent) / 0.12) 0%, transparent 50%),
                linear-gradient(180deg, hsl(150 55% 10%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 8%) 100%)
              `,
            }}
          />
          {/* Aurora blobs */}
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute top-20 left-10 w-36 sm:w-48 h-36 sm:h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div
              className="absolute top-40 right-20 w-48 sm:w-64 h-48 sm:h-64 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
              style={{ animationDelay: '5s' }}
            />
            <div
              className="absolute bottom-20 left-1/3 w-56 h-56 bg-brand-secondary/10 rounded-full blur-3xl animate-aurora"
              style={{ animationDelay: '10s' }}
            />
          </div>
          {/* Dot grid */}
          <div className="absolute inset-0 noise opacity-[0.015]" />
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.025]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="dotgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
          </svg>
        </div>

        {/* Nav */}
        <header className="absolute inset-x-0 top-0 z-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <nav className="flex h-20 items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                  <IconBox
                    icon={Trophy}
                    size="md"
                    variant="gradient-primary"
                    className="h-11 w-11"
                    iconClassName="h-6 w-6"
                  />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white font-display">
                  SWINGZ
                </span>
              </Link>
              <div className="hidden md:flex md:items-center md:gap-3">
                <ThemeToggle className="h-9 w-9 rounded-full text-white/70 hover:text-white hover:bg-background/10" />
                <Link href="/login">
                  <Button
                    size="md"
                    variant="ghost"
                    className="text-white/85 hover:text-white hover:bg-background/10 border border-white/15 backdrop-blur-sm rounded-full"
                    onClick={() => analytics.featureUsed('header_login')}
                  >
                    Anmelden
                  </Button>
                </Link>
              </div>
              <div className="md:hidden">
                <Link href="/login">
                  <Button size="sm" variant="accent" className="rounded-full">
                    Login
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Column */}
            <div className="text-center lg:text-left">
              <div className="animate-in animate-in-delay-1">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-brand-accent/20 backdrop-blur-md border border-brand-accent/40 text-white/90 text-sm font-medium mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
                  </span>
                  Jetzt verfügbar
                </div>
              </div>

              <h1 id="hero-heading" className="animate-in animate-in-delay-2">
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight">
                  Optimale
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mt-1.5 text-gradient-primary bg-clip-text text-transparent">
                  Trainingspläne.
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mt-1.5">
                  Maximale
                </span>
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mt-1.5 text-gradient-accent bg-clip-text text-transparent">
                  Performance.
                </span>
              </h1>

              <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-white/65 leading-relaxed max-w-xl mx-auto lg:mx-0 animate-in animate-in-delay-3">
                Die KI-gesteuerte Plattform für Tennisclub-Management. Optimiere Trainingspläne,
                verwalte Mitglieder und steigere die Effizienz deines Vereins —{' '}
                <span className="text-white font-semibold">ab sofort verfügbar</span>.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start animate-in animate-in-delay-4">
                <Link href="/register">
                  <button
                    type="button"
                    className="group relative inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-brand-primary via-brand-primary/85 to-brand-light px-7 sm:px-8 py-4 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all duration-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-light focus:ring-offset-2 focus:ring-offset-brand-950 overflow-hidden min-h-[52px] shadow-glow-primary"
                    onClick={() =>
                      analytics.signUp('landing_hero_cta', heroCtaVariant || 'default')
                    }
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <Sparkles className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">
                      {heroCtaVariant === 'kostenlos_testen' ? 'Kostenlos testen' : 'Demo starten'}
                    </span>
                    <ChevronRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/contact">
                  <button
                    type="button"
                    className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-background/10 backdrop-blur-sm border border-white/20 px-7 sm:px-8 py-4 sm:py-4 text-base sm:text-lg font-medium text-white transition-all duration-300 hover:bg-background/20 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-brand-950 min-h-[52px]"
                    onClick={() => analytics.featureUsed('landing_learn_more')}
                  >
                    <Play className="h-5 w-5" />
                    Demo ansehen
                  </button>
                </Link>
              </div>

              <div className="mt-10 sm:mt-12 flex items-center gap-6 sm:gap-8 justify-center lg:justify-start animate-in animate-in-delay-5">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {['🎾', '🏆', '📊'].map((emoji, i) => (
                      <div
                        key={i}
                        className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-gradient-to-br from-brand-light to-brand-primary border-2 border-brand-950 flex items-center justify-center text-lg shadow-lg"
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Starte jetzt kostenlos</p>
                    <p className="text-white/50 text-xs">14 Tage Probezeit</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Column – Floating cards */}
            <div className="relative hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/15 to-brand-light/15 rounded-3xl blur-3xl" />
                {/* Tennis ball SVG */}
                <div className="relative animate-float">
                  <svg width="400" height="400" viewBox="0 0 200 200" className="drop-shadow-2xl">
                    <defs>
                      <radialGradient id="ballGrad" cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="hsl(150 38% 63%)" />
                        <stop offset="40%" stopColor="hsl(var(--brand-primary-light))" />
                        <stop offset="70%" stopColor="hsl(var(--brand-primary))" />
                        <stop offset="100%" stopColor="hsl(150 50% 12%)" />
                      </radialGradient>
                      <filter id="ballShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow
                          dx="0"
                          dy="25"
                          stdDeviation="25"
                          floodColor="hsl(var(--brand-primary) / 0.4)"
                        />
                      </filter>
                    </defs>
                    <circle
                      cx="100"
                      cy="100"
                      r="85"
                      fill="url(#ballGrad)"
                      filter="url(#ballShadow)"
                    />
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
                </div>
                {/* Floating cards */}
                <div className="absolute top-8 right-0 glass-strong rounded-2xl p-4 shadow-2xl animate-float-slow">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-accent to-orange-700 flex items-center justify-center shadow-lg">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">KI-Optimierung</p>
                      <p className="text-white/60 text-xs">+47% Effizienzsteigerung</p>
                    </div>
                  </div>
                </div>
                <div
                  className="absolute bottom-16 -left-8 glass-strong rounded-2xl p-4 shadow-2xl animate-float-slow"
                  style={{ animationDelay: '2.5s' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Auto-Scheduling</p>
                      <p className="text-white/60 text-xs">50+ Plätze parallel</p>
                    </div>
                  </div>
                </div>
                <div
                  className="absolute top-1/2 -right-6 glass-strong rounded-2xl p-4 shadow-2xl animate-float-slow"
                  style={{ animationDelay: '5s' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-secondary to-blue-700 flex items-center justify-center shadow-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">SOC 2 Security</p>
                      <p className="text-white/60 text-xs">Enterprise-Grade</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave transition */}
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
      </section>{' '}
      {/* ═══════════ VISION ═══════════ */}
      <section
        ref={statsRef}
        className="relative z-10 bg-background py-20 sm:py-28"
        aria-labelledby="vision-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-sm font-semibold mb-5">
              <Zap className="h-3.5 w-3.5" /> Unsere Vision
            </span>
            <h2
              id="vision-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight"
            >
              Was wir{' '}
              <span className="text-gradient-accent bg-clip-text text-transparent">vorhaben</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <StatItem
              value={platformStats.clubs || 1}
              suffix="+"
              label="Aktive Vereine"
              icon={Shield}
              color="from-brand-primary to-brand-light"
              visible={statsVisible}
            />
            <StatItem
              value={50}
              suffix="%"
              label="Weniger Planungsaufwand"
              icon={Brain}
              color="from-green-500 to-green-700"
              visible={statsVisible}
            />
            <StatItem
              value={platformStats.sessions || 10}
              suffix="+"
              label="Trainings geplant"
              icon={Calendar}
              color="from-brand-accent to-orange-600"
              visible={statsVisible}
            />
          </div>
        </div>
      </section>
      {/* ═══════════ FEATURES ═══════════ */}
      <section
        className="bg-muted py-20 sm:py-32 relative overflow-hidden"
        aria-labelledby="features-heading"
      >
        <div className="absolute top-0 right-0 w-full h-full bg-grid opacity-[0.4]" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gray-100/50 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Features
            </span>
            <h2
              id="features-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight"
            >
              Warum{' '}
              <span className="text-gradient-primary bg-clip-text text-transparent">SWINGZ</span>?
            </h2>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Revolutioniere deine Trainingsplanung mit modernster KI und durchdachtem Design.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {FEATURES.map((feature, idx) => (
              <div
                key={idx}
                className={`group relative bg-background rounded-3xl p-7 sm:p-8 shadow-elegant border border-border transition-all duration-500 hover:shadow-premium hover:-translate-y-2 ${feature.highlight ? 'ring-1 ring-brand-primary/15' : ''}`}
              >
                {feature.highlight && (
                  <div className="absolute -top-3 right-6 px-3.5 py-1 bg-gradient-to-r from-brand-primary to-brand-light text-white text-xs font-bold rounded-full shadow-md">
                    Beliebt
                  </div>
                )}
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-500`}
                >
                  <feature.icon className="h-7 w-7" />
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">{feature.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {feature.description}
                </p>
                {feature.stat && (
                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-foreground">{feature.stat}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {feature.statLabel}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="bg-background py-20 sm:py-32 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-sm font-semibold mb-5">
              <Zap className="h-3.5 w-3.5" /> So einfach geht&apos;s
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
              In{' '}
              <span className="text-gradient-accent bg-clip-text text-transparent">
                3 Schritten
              </span>{' '}
              zum smarten Club
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                icon: MessageCircle,
                title: 'Jetzt registrieren',
                description:
                  'Erstelle deinen Club in wenigen Minuten und starte mit der KI-Optimierung.',
              },
              {
                step: '02',
                icon: Calendar,
                title: 'Zugang erhalten',
                description:
                  'Wir richten deinen Club persönlich ein und begleiten dich beim Onboarding.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Durchstarten',
                description: 'Plane Trainingseinheiten, verwalte Buchungen und optimiere mit KI.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:shadow-glow-primary">
                  <item.icon className="h-9 w-9" />
                </div>
                <div className="absolute top-3 -right-2 text-7xl font-black text-white/90 select-none -z-10 group-hover:text-white transition-colors">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ═══════════ PRICING ═══════════ */}
      <section className="bg-background py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-gray-50 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-sm font-semibold mb-5">
              <CreditCard className="h-3.5 w-3.5" /> Preise
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
              Für jeden Verein die{' '}
              <span className="text-gradient-accent bg-clip-text text-transparent">
                richtige Lösung
              </span>
            </h2>
            <p className="mt-4 sm:mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Flexible Preismodelle — vom kleinen Verein bis zum großen Verband.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
              {PRICING_PLANS.map((plan, idx) => (
                <div
                  key={idx}
                  className={`relative flex flex-col bg-background rounded-3xl border border-border shadow-elegant transition-all duration-500 hover:shadow-premium hover:-translate-y-2 overflow-hidden max-w-lg w-full ${plan.popular ? 'ring-2 ring-brand-primary/30 z-10' : ''} ${plan.borderHover}`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-brand-primary to-brand-light text-white text-center text-sm font-bold py-2.5 tracking-wide">
                      Am beliebtesten
                    </div>
                  )}
                  <div className={`p-8 ${plan.popular ? 'pt-16' : 'pt-10'}`}>
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{plan.subtitle}</p>
                      <div className="mt-6 flex items-baseline justify-center gap-1">
                        <span className="text-5xl font-extrabold text-foreground tracking-tight">
                          €{plan.price}
                        </span>
                        <span className="text-muted-foreground text-sm font-medium">
                          {plan.period}
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <ul className="mt-8 space-y-3.5">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-3">
                          <CheckCircle2
                            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${plan.iconColor}`}
                          />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      <Link
                        href="/register"
                        className={`group flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 active:scale-[0.98] ${
                          plan.popular
                            ? 'bg-gradient-to-r from-brand-primary to-brand-light text-white shadow-lg hover:shadow-xl hover:brightness-105'
                            : 'bg-brand-secondary text-white hover:bg-brand-secondary/90 shadow-sm'
                        }`}
                      >
                        {plan.cta}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-12 text-center text-sm text-muted-foreground">
            14 Tage kostenlos testen · Keine Kreditkarte erforderlich · Jederzeit kündbar
          </p>
        </div>
      </section>
      {/* ═══════════ CTA ═══════════ */}
      <section className="relative py-24 sm:py-36 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 80% 50%, hsl(var(--brand-accent) / 0.15) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 55% 10%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 8%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 noise opacity-[0.025]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Bereit für die{' '}
            <span className="text-gradient-accent bg-clip-text text-transparent">Zukunft</span>?
          </h2>
          <p className="mt-5 sm:mt-6 text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
            Starte jetzt mit SWINGZ und revolutioniere die Trainingsplanung in deinem Verein —
            KI-gestützt, einfach zu bedienen, sofort einsatzbereit.
          </p>

          <div className="mt-9 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/register">
              <button
                type="button"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-brand-accent via-orange-400 to-orange-300 px-7 sm:px-8 py-4 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all duration-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-950 min-h-[52px] shadow-glow-accent"
              >
                <Sparkles className="h-5 w-5" />
                Kostenlos registrieren
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/contact">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-background/10 backdrop-blur-sm border border-white/20 px-7 sm:px-8 py-4 sm:py-4 text-base sm:text-lg font-medium text-white transition-all duration-300 hover:bg-background/20 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[52px]"
              >
                <ArrowRight className="h-5 w-5" />
                Kontakt
              </button>
            </Link>
          </div>

          <p className="mt-8 text-white/45 text-sm">
            14 Tage kostenlos testen — keine Kreditkarte erforderlich.
          </p>
        </div>
      </section>
      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-brand-secondary py-14 sm:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-950" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <IconBox icon={Trophy} size="md" variant="gradient-primary" iconClassName="h-6 w-6" />
              <div>
                <span className="text-xl font-bold text-white font-display">SWINGZ</span>
                <p className="text-xs text-muted-foreground">Premium Tennis Club Management</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-muted-foreground">
              <Link href="/impressum" className="hover:text-white transition-colors">
                Impressum
              </Link>
              <Link href="/datenschutz" className="hover:text-white transition-colors">
                Datenschutz
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                AGB
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Kontakt
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 SWINGZ — Alle Rechte vorbehalten.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
