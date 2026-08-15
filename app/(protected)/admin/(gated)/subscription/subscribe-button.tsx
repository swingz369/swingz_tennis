'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PLANS, BILLING_INTERVALS, type PlanKey, type BillingInterval } from '@/lib/plans';

export function SubscribeButton({
  plan,
  interval,
  primary,
  label,
}: {
  plan: string;
  interval: BillingInterval;
  primary?: boolean;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Starten des Checkouts');
        return;
      }
      if (data.url) {
        router.push(data.url);
      } else if (data.success) {
        toast.success('Plan gewechselt!');
        router.refresh();
      }
    } catch {
      toast.error('Netzwerkfehler — bitte erneut versuchen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={primary ? 'primary' : 'outline'}
      className="w-full"
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? 'Weiterleitung…' : label}
    </Button>
  );
}

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/stripe/portal');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Öffnen des Kundenportals');
        return;
      }
      if (data.url) router.push(data.url);
    } catch {
      toast.error('Netzwerkfehler — bitte erneut versuchen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="w-full" disabled={loading} onClick={handleClick}>
      {loading ? 'Weiterleitung…' : 'Abo verwalten'}
    </Button>
  );
}

export function SubscriptionToasts() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('Abonnement erfolgreich gestartet! Willkommen bei SwingZ.');
    } else if (searchParams.get('cancelled') === '1') {
      toast.info('Checkout abgebrochen. Du kannst jederzeit ein Abonnement starten.');
    }
  }, [searchParams]);
  return null;
}

export function PlanCards({
  planKeys,
  recommended,
  currentTier,
  isActive,
  features,
}: {
  planKeys: PlanKey[];
  recommended: PlanKey;
  currentTier: string;
  isActive: boolean;
  features: string[];
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <div className="space-y-5">
      {/* Billing interval toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-xl border bg-muted p-1 gap-1">
          {(Object.keys(BILLING_INTERVALS) as BillingInterval[]).map((key) => (
            <button
              key={key}
              onClick={() => setInterval(key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                interval === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {BILLING_INTERVALS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {planKeys.map((key) => {
          const plan = PLANS[key];
          const isCurrent = isActive && currentTier === key;
          const isRecommended = key === recommended;
          const months = BILLING_INTERVALS[interval].monthCount;
          const total = plan.pricePerMonth * months;

          return (
            <Card
              key={key}
              className={cn('relative flex flex-col', isRecommended && 'ring-2 ring-primary/40')}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white border-0 px-3 text-xs">Empfohlen</Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-lg">{plan.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{plan.sublabel}</p>
                <div className="mt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">€{plan.pricePerMonth}</span>
                    <span className="text-sm text-muted-foreground">/Monat</span>
                  </div>
                  {interval === 'annual' && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      zahlbar als €{total} jährlich
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 flex-1">
                <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="space-y-2">
                    <Badge variant="success" className="w-full justify-center py-1.5 text-xs">
                      Aktives Abonnement
                    </Badge>
                    <PortalButton />
                  </div>
                ) : (
                  <SubscribeButton
                    plan={key}
                    interval={interval}
                    primary={isRecommended}
                    label={isActive ? 'Plan wechseln' : 'Jetzt starten'}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
