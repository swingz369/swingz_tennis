'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Zap, Star, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '29',
    subtitle: 'Für kleine Vereine',
    features: [
      'Bis zu 50 Mitglieder',
      'Bis zu 3 Trainer',
      'Buchungs-Management',
      'Mitgliederverwaltung',
      'E-Mail-Support',
      'Sichere EU-Hosting',
    ],
    popular: false,
    icon: Zap,
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    price: '79',
    subtitle: 'Für wachsende Vereine',
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
    popular: true,
    icon: Star,
  },
];

export default function AdminSubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('Abonnement erfolgreich gestartet! Willkommen bei SWINGZ.');
    } else if (searchParams.get('cancelled') === '1') {
      toast.info('Checkout abgebrochen. Du kannst jederzeit ein Abonnement starten.');
    }
  }, [searchParams]);

  const handleSubscribe = async (plan: 'starter' | 'professional') => {
    setLoading(plan);
    try {
      const res = await apiFetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Starten des Checkouts');
        return;
      }
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      toast.error('Netzwerkfehler — bitte erneut versuchen');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Abonnement</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wähle den passenden Plan für deinen Verein. 14 Tage kostenlos testen — keine Kreditkarte
          erforderlich.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Stripe-Zahlungen werden aktiv sobald <code className="font-mono">STRIPE_SECRET_KEY</code>,{' '}
          <code className="font-mono">STRIPE_STARTER_PRICE_ID</code> und{' '}
          <code className="font-mono">STRIPE_PROFESSIONAL_PRICE_ID</code> in den
          Vercel-Umgebungsvariablen gesetzt sind.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              'relative flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
              plan.popular && 'ring-2 ring-brand-primary/30'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-brand-primary to-brand-light text-white border-0 px-3">
                  Am beliebtesten
                </Badge>
              </div>
            )}
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 mb-1">
                <plan.icon
                  className={cn(
                    'h-5 w-5',
                    plan.popular ? 'text-brand-primary' : 'text-brand-secondary'
                  )}
                />
                <CardTitle className="text-lg">{plan.name}</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">{plan.subtitle}</p>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-extrabold text-foreground">€{plan.price}</span>
                <span className="text-sm text-muted-foreground">/Monat</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2
                      className={cn(
                        'h-4 w-4 shrink-0',
                        plan.popular ? 'text-brand-primary' : 'text-brand-secondary'
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.popular ? 'brand' : 'outline'}
                className="w-full"
                disabled={loading !== null}
                onClick={() => handleSubscribe(plan.id)}
              >
                {loading === plan.id ? 'Weiterleitung…' : 'Jetzt starten'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        14 Tage kostenlos testen · Keine Kreditkarte erforderlich · Jederzeit kündbar
      </p>
    </div>
  );
}
