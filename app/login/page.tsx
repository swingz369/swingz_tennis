'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Trophy, Sparkles, ArrowRight, Eye, EyeOff, Shield, Zap } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { apiFetch } from '@/lib/api-fetch';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login fehlgeschlagen');
        return;
      }

      analytics.login('email', true);
      window.location.href = '/dashboard';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login fehlgeschlagen';
      analytics.login('email', false);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-login-hero" />
          {/* Aurora blobs */}
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute top-20 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div className="absolute top-40 right-20 w-64 h-64 bg-brand-accent/8 rounded-full blur-3xl animate-aurora [animation-delay:5s]" />
            <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-brand-secondary/10 rounded-full blur-3xl animate-aurora [animation-delay:10s]" />
          </div>
          <div className="absolute inset-0 noise opacity-[0.04]" />
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.025]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="login-dotgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-dotgrid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-16 text-white">
          <div>
            <Link href="/" className="flex items-center gap-3 mb-12 group w-fit">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                <IconBox
                  icon={Trophy}
                  size="md"
                  variant="gradient-primary"
                  className="h-12 w-12"
                  iconClassName="h-7 w-7"
                />
              </div>
              <span className="text-2xl font-bold font-display">SWINGZ</span>
            </Link>

            <h1 className="text-4xl font-extrabold leading-tight max-w-md">
              Die Zukunft des{' '}
              <span className="text-gradient-accent bg-clip-text text-transparent">
                Tennisclub-Managements
              </span>
            </h1>

            <p className="mt-6 text-white/55 text-lg max-w-md leading-relaxed">
              Automatisierte Trainingsplanung, intuitive Buchungsverwaltung und smarter Club-Betrieb
              — ab sofort verfügbar.
            </p>
          </div>

          {/* Stats + Feature cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-background/5 backdrop-blur-sm border border-white/10 hover:bg-background/8 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-accent to-brand-accent-600 flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold">Automatisierte Saisonplanung</p>
                <p className="text-white/60 text-sm">Automatisch optimierte Trainingspläne</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-background/5 backdrop-blur-sm border border-white/10 hover:bg-background/8 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-brand-accent" />
                  <p className="font-semibold text-sm">Persönliches Onboarding</p>
                </div>
                <p className="text-white/55 text-xs">Wir richten deinen Club ein</p>
              </div>
              <div className="p-4 rounded-xl bg-background/5 backdrop-blur-sm border border-white/10 hover:bg-background/8 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-brand-light" />
                  <p className="font-semibold text-sm">DSGVO-konform</p>
                </div>
                <p className="text-white/55 text-xs">Daten in der EU</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background dark:bg-card relative">
        {/* Theme Toggle — always visible (mobile + desktop) */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle className="h-9 w-9 rounded-full" />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />

        <div className="relative w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-foreground dark:text-white font-display">
                SWINGZ
              </span>
            </Link>
          </div>

          <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-foreground">Anmelden</h2>
              <p className="mt-2 text-muted-foreground">
                Melde dich an, um deinen Club zu verwalten
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@verein.de"
                    required
                    className="h-12 rounded-xl border-border focus:border-brand-light focus:ring-brand-light/20 pl-4 pr-4 transition-shadow focus:shadow-glow-green-sm"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                    Passwort
                  </Label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-brand-light hover:text-brand-primary font-medium transition-colors"
                  >
                    Passwort vergessen?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 rounded-xl border-border focus:border-brand-light focus:ring-brand-light/20 pr-12 transition-shadow focus:shadow-glow-green-sm"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors z-10"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-error-50 p-4 text-sm text-error-600 border border-error-100 animate-scale-in flex items-start gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-error-400" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-green-sm hover:shadow-glow-green transition-all duration-300 hover:brightness-105 active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Anmeldung läuft...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Anmelden
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground font-medium">oder</span>
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Noch kein Konto?{' '}
                <a
                  href="/register"
                  className="text-brand-primary hover:text-brand-light font-semibold transition-colors underline-offset-2 hover:underline"
                >
                  Zugang anfragen
                </a>
              </p>
            </div>
          </Card>

          {/* Trust badge */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> DSGVO-konform · Daten in der EU
            </span>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Mit der Anmeldung stimmst du unseren{' '}
            <a
              href="/terms"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Nutzungsbedingungen
            </a>{' '}
            und{' '}
            <a
              href="/datenschutz"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Datenschutzrichtlinie
            </a>{' '}
            zu.
          </p>
        </div>
      </div>
    </div>
  );
}
