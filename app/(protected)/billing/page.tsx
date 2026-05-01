'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, Sparkles, Crown } from 'lucide-react';

type Plan = {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'Monat',
    description: 'Für kleine Vereine zum Einstieg',
    features: [
      'Bis zu 50 Mitglieder',
      'Grundlegende Buchungsfunktionen',
      'E-Mail-Benachrichtigungen',
      'Community-Support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'Monat',
    description: 'Für wachsende Tennisvereine',
    features: [
      'Bis zu 500 Mitglieder',
      'KI-optimierte Stundenplanung',
      'Wartelisten-Management',
      'Prioritäts-Support',
      'Erweiterte Analysen',
      'Anpassbare Branding',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    period: 'Monat',
    description: 'Für große Vereine und Organisationen',
    features: [
      'Unbegrenzte Mitglieder',
      'Alle Pro Features',
      'White-Label Lösung',
      'Custom Domain',
      'API-Zugang',
      'Dedizierter Account Manager',
    ],
  },
];

interface Subscription {
  id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  stripeSubscriptionId?: string;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      // Get current user
      const userRes = await fetch('/api/user/member');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserEmail(userData.email || '');
      }

      // Get subscription via admin endpoint (with current user context)
      // In prod: create dedicated /api/subscription/current endpoint
      const subsRes = await fetch('/api/admin/billing/subscriptions');
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        const mySubs = Array.isArray(subsData)
          ? subsData.filter((s: any) => s.memberEmail === userEmail)
          : [];
        if (mySubs.length > 0) {
          setSubscription({
            id: mySubs[0].id,
            plan: mySubs[0].plan,
            status: mySubs[0].status,
            currentPeriodEnd: mySubs[0].currentPeriodEnd,
            stripeSubscriptionId: mySubs[0].stripeSubscriptionId,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      toast.success('Free Plan aktiviert');
      return;
    }

    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: `price_${planId}`, // In production, map to real Stripe price ID from env
          successUrl: `${window.location.origin}/billing?success=true&plan=${planId}`,
          cancelUrl: `${window.location.origin}/billing?canceled=true`,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Checkout fehlgeschlagen');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Fehler beim Starten des Checkouts');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Fehler beim Öffnen des Kundenportals');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Fehler beim Öffnen');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';
  const isActive = subscription?.status === 'active';
  const isPastDue = subscription?.status === 'past_due';

  return (
    <div className="space-y-12 p-8">
      {/* Current Status */}
      {subscription && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Aktuelles Abonnement</CardTitle>
                <CardDescription>
                  Plan: <span className="font-semibold capitalize">{currentPlan}</span>
                  {isPastDue && (
                    <Badge variant="error" className="ml-2">
                      Zahlung ausstehend
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="secondary" className="ml-2">
                      Aktiv
                    </Badge>
                  )}
                </CardDescription>
              </div>
              {subscription.stripeSubscriptionId && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  Abonnement verwalten
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Nächste Abrechnung:{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString('de-DE')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan;
          const isDisabled = isActive && isCurrentPlan;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.popular
                  ? 'border-2 border-brand-primary shadow-xl scale-105'
                  : 'border border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-brand-primary px-4 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Beliebt
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrentPlan && <Crown className="w-5 h-5 text-yellow-500" />}
                    {isCurrentPlan && (
                      <Badge variant="secondary" className="ml-2">
                        Aktiv
                      </Badge>
                    )}
                    {isPastDue && (
                      <Badge variant="error" className="ml-2">
                        Zahlung ausstehend
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <span className="text-5xl font-bold">€{plan.price}</span>
                  <span className="text-gray-500">/{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                  disabled={isDisabled || checkoutLoading === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {checkoutLoading === plan.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : isDisabled ? (
                    'Aktueller Plan'
                  ) : plan.id === 'free' ? (
                    'Kostenlos starten'
                  ) : (
                    'Jetzt upgraden'
                  )}
                </Button>

                {plan.id === 'pro' && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    14 Tage kostenlos testen, jederzeit kündbar
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contact for Enterprise */}
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-gray-600">
          Sie benötigen eine individuelle Lösung für Ihren großen Verein?{' '}
          <a href="mailto:sales@swingz.de" className="text-brand-primary hover:underline">
            Kontaktieren Sie uns
          </a>
        </p>
      </div>
    </div>
  );
}
