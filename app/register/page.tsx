'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Trophy className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">SwingZ</span>
        </Link>
        <ThemeToggle />
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
