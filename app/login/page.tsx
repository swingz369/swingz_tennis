'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { analytics } from '@/lib/analytics';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (err) {
        // Demo fallback: if Supabase not running or credentials invalid
        if (
          err.message.includes('fetch failed') ||
          err.message.includes('Connection') ||
          err.message.includes('Invalid')
        ) {
          console.warn('Supabase not available or invalid credentials - using demo mode');
          // Set demo cookie for server-side detection
          document.cookie = 'demo-mode=true; path=/';
          router.push('/');
          return;
        }
        setError(err.message);
      } else if (data.user) {
        analytics.login('email', true);
        router.push('/');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      analytics.login('email', false);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Quick demo login - set cookie for server
    document.cookie = 'demo-mode=true; path=/';
    analytics.login('demo', true);
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-navy-900 via-brand-navy-800 to-brand-primary-900 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-brand-primary/50/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-accent-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary-500 to-brand-primary-700 shadow-lg"
            style={{
              boxShadow: '0 12px 40px -8px rgba(27,67,50,0.6)',
            }}
          >
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SWINGZ</h1>
          <p className="mt-2 text-sm text-gray-300">Tennisclub Management System</p>
        </div>

        {/* Login Card */}
        <Card variant="elevated" className="w-full">
          <div className="space-y-6 p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900">Willkommen zurück</h2>
              <p className="mt-1 text-sm text-gray-500">Melde dich mit deinem Konto an</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@verein.de"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Passwort
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-brand-primary-600 to-brand-primary-700 text-white hover:from-brand-primary-700 hover:to-brand-primary-800 shadow-md hover:shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                  'Anmelden'
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-3 text-gray-500">oder</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-2 border-dashed border-gray-300 text-gray-700 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
                onClick={handleDemoLogin}
              >
                <Trophy className="mr-2 h-4 w-4 text-brand-primary" />
                Demo-Modus starten
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-gray-400">
              <p>
                Noch kein Konto?{' '}
                <button className="text-brand-primary hover:text-brand-primary font-medium underline underline-offset-2">
                  Registrierung anfragen
                </button>
              </p>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Mit der Anmeldung stimmst du unseren{' '}
          <button className="text-gray-300 hover:text-white underline underline-offset-2">
            Nutzungsbedingungen
          </button>{' '}
          und{' '}
          <button className="text-gray-300 hover:text-white underline underline-offset-2">
            Datenschutzrichtlinie
          </button>{' '}
          zu.
        </p>
      </div>
    </div>
  );
}
