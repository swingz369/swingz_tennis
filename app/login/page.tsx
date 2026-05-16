'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Trophy, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { analytics } from '@/lib/analytics';

export default function LoginPage() {
  const router = useRouter();
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
      // Use server-side login API with proper cookie handling
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important for cookies
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes('fetch failed') || data.error?.includes('Connection')) {
          console.warn('Supabase not available - using demo mode');
          document.cookie = 'demo-mode=true; path=/';
          window.location.href = '/';
          return;
        }
        setError(data.error || 'Login failed');
        return;
      }

      analytics.login('email', true);

      // Force full page reload to ensure cookies are picked up
      window.location.href = '/';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      analytics.login('email', false);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    document.cookie = 'demo-mode=true; path=/';
    analytics.login('demo', true);
    router.push('/');
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <div className="hidden lg:flex lg:flex-1 relative">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 100% at 30% 0%, hsl(var(--brand-primary-light) / 0.25) 0%, transparent 50%),
                radial-gradient(ellipse 80% 80% at 70% 100%, hsl(var(--brand-accent) / 0.15) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 50% 12%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 10%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 noise opacity-[0.02]" />

          <div className="absolute top-20 left-20 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
          <div
            className="absolute bottom-20 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
            style={{ animationDelay: '5s' }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-16 text-white">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold">SWINGZ</span>
            </div>

            <h1 className="text-4xl font-bold leading-tight max-w-md">
              Willkommen zurück bei{' '}
              <span className="text-gradient-primary bg-gradient-to-r from-green-400 to-brand-light bg-clip-text text-transparent">
                Premium Tennis Club Management
              </span>
            </h1>

            <p className="mt-6 text-white/60 text-lg max-w-md leading-relaxed">
              Verwalte deinen Tennisverein mit modernster KI-Technologie und intuitivem Design.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="h-12 w-12 rounded-xl bg-gradient-accent flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold">KI-optimierte Planung</p>
                <p className="text-white/60 text-sm">+47% Effizienzsteigerung</p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 text-center">
                <p className="text-2xl font-bold">1.2K+</p>
                <p className="text-white/60 text-sm">Vereine</p>
              </div>
              <div className="flex-1 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 text-center">
                <p className="text-2xl font-bold">50K+</p>
                <p className="text-white/60 text-sm">Trainings</p>
              </div>
              <div className="flex-1 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 text-center">
                <p className="text-2xl font-bold">85K+</p>
                <p className="text-white/60 text-sm">Mitglieder</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 relative">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-gray-100 dark:from-gray-800 to-transparent opacity-50" />

        <div className="relative w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">SWINGZ</span>
            </div>
          </div>

          <Card variant="elevated" className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Anmelden</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Melde dich mit deinem Konto an
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@verein.de"
                  required
                  className="h-12 rounded-xl border-gray-200 dark:border-gray-700 focus:border-brand-light focus:ring-brand-light/20"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Passwort
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 rounded-xl border-gray-200 dark:border-gray-700 focus:border-brand-light focus:ring-brand-light/20 pr-12"
                  />
                  <Button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Passwort anzeigen/verstecken"
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r bg-gradient-primary text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
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
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white dark:bg-gray-900 px-4 text-gray-400">oder</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-accent hover:text-brand-accent hover:bg-brand-accent/5 transition-all duration-300 font-medium"
                onClick={handleDemoLogin}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Demo-Modus starten
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>
                Noch kein Konto?{' '}
                <button className="text-brand-primary hover:text-brand-light dark:text-brand-light dark:hover:text-brand-light/80 font-semibold transition-colors">
                  Registrierung anfragen
                </button>
              </p>
            </div>
          </Card>

          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            Mit der Anmeldung stimmst du unseren{' '}
            <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors">
              Nutzungsbedingungen
            </button>{' '}
            und{' '}
            <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors">
              Datenschutzrichtlinie
            </button>{' '}
            zu.
          </p>
        </div>
      </div>
    </div>
  );
}
