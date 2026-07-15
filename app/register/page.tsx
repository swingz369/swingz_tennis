'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clubName, email, message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Fehler beim Absenden');
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="relative overflow-hidden bg-brand-secondary">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 100% at 30% 0%, hsl(var(--brand-primary-light) / 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 70% 100% at 100% 100%, hsl(var(--brand-accent) / 0.12) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 55% 10%) 0%, hsl(var(--brand-secondary)) 60%, hsl(150 30% 8%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute -top-10 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div
              className="absolute -bottom-16 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
              style={{ animationDelay: '5s' }}
            />
          </div>
          <div className="absolute inset-0 noise opacity-[0.04]" />
        </div>
        <div className="relative flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
              <IconBox icon={Trophy} variant="gradient-primary" iconClassName="h-6 w-6" />
            </div>
            <span className="font-bold text-lg text-white font-display">SWINGZ</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-white/90 hover:text-white hover:bg-background/10"
              >
                Anmelden
              </Button>
            </Link>
            <ThemeToggle className="text-white/70 hover:text-white hover:bg-background/10" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {done ? (
            <Card className="p-8 text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/20 mx-auto">
                <CheckCircle2 className="h-6 w-6 text-success-600" />
              </div>
              <h2 className="text-xl font-bold">Anfrage eingegangen!</h2>
              <p className="text-sm text-muted-foreground">
                Wir melden uns bei dir unter <strong>{email}</strong> — in der Regel innerhalb von
                1–2 Werktagen.
              </p>
              <Link href="/login" className="text-sm text-primary hover:underline block">
                Zum Login
              </Link>
            </Card>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold">Zugang anfragen</h1>
                <p className="text-sm text-muted-foreground">
                  Kein Self-Service — wir richten deinen Zugang manuell ein.
                </p>
              </div>
              <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Dein Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Max Mustermann"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="clubName">Vereinsname</Label>
                    <Input
                      id="clubName"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      placeholder="TC Musterstadt e.V."
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-Mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="max@tc-musterstadt.de"
                      className="mt-1.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Nachricht (optional)</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Kurze Info zu deinem Verein..."
                      className="mt-1.5 resize-none"
                      rows={3}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !name || !email}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Anfrage absenden
                  </Button>
                </form>
              </Card>
              <p className="text-center text-xs text-muted-foreground">
                Bereits registriert?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Einloggen
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
