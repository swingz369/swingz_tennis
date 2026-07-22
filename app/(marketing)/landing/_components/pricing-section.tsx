'use client';

/**
 * Pricing-Sektion — App-Design
 *
 * Client Component wegen des Monatlich/Jährlich-Toggles.
 * shadcn Card + Switch + Button statt der früheren Editorial-Hairline-Karten.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Plan = {
  name: string;
  subtitle: string;
  price: string;
  yearlyPrice: string;
  yearlyPricePerMonth: string;
  savings: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  popular: boolean;
};

const COMMON_FEATURES = [
  'Unbegrenzte Trainer',
  'Buchungs-Management',
  'Mitgliederverwaltung',
  'Automatisierte Saisonplanung',
  'Erweiterte Analytics & Reports',
  'Shop-Modul',
  'E-Mail-Support',
  'EU-Hosting',
];

const PRICING_PLANS: Plan[] = [
  {
    name: 'Starter',
    subtitle: 'Für kleine & mittlere Vereine',
    price: '29',
    yearlyPrice: '290',
    yearlyPricePerMonth: '24,17',
    savings: '58 €',
    period: '/Monat',
    description:
      'Alles, was ein Verein braucht — bis zu 200 Mitglieder. Danach wechselt ihr automatisch zu Professional.',
    features: ['Bis zu 200 Mitglieder', ...COMMON_FEATURES],
    cta: 'Jetzt registrieren',
    ctaHref: '/register',
    popular: false,
  },
  {
    name: 'Professional',
    subtitle: 'Für größere Vereine',
    price: '49',
    yearlyPrice: '490',
    yearlyPricePerMonth: '40,83',
    savings: '98 €',
    period: '/Monat',
    description:
      'Der gleiche Funktionsumfang wie Starter — der einzige Unterschied ist die Mitgliederanzahl.',
    features: ['Ab 201 Mitglieder', ...COMMON_FEATURES],
    cta: 'Jetzt registrieren',
    ctaHref: '/register',
    popular: true,
  },
  {
    name: 'Tennisschule',
    subtitle: 'Für Organisationen mit mehreren Vereinen',
    price: '79',
    yearlyPrice: '790',
    yearlyPricePerMonth: '65,83',
    savings: '158 €',
    period: '/Monat',
    description: 'Für Tennisschulen und Verbände, die mehrere Vereine zentral verwalten.',
    features: [
      'Bis zu 5 Vereine (danach 99 €/Monat)',
      'Zentrale Verwaltung aller Vereine',
      'Club-Switcher',
      ...COMMON_FEATURES,
    ],
    cta: 'Kontakt aufnehmen',
    ctaHref: '/contact',
    popular: false,
  },
];

export function PricingSection() {
  const [billingYearly, setBillingYearly] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="text-center mb-12 sm:mb-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent mb-3">
          Preise
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Für jeden Verein die richtige Lösung
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Flexible Modelle — vom kleinen Verein bis zur Tennisschule mit mehreren Vereinen. Klar,
          ohne Kleingedrucktes.
        </p>

        {/* ── Billing Toggle ── */}
        <div className="mt-8 inline-flex items-center gap-3">
          <span
            className={`text-sm font-medium transition-colors ${
              !billingYearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Monatlich
          </span>
          <Switch
            checked={billingYearly}
            onCheckedChange={setBillingYearly}
            aria-label="Jährliche Abrechnung"
          />
          <span
            className={`text-sm font-medium transition-colors ${
              billingYearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Jährlich
          </span>
          <Badge variant="accent" className="ml-1">
            2 Monate gratis
          </Badge>
        </div>
      </div>

      {/* ── Plans ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
        {PRICING_PLANS.map((plan) => (
          <Card
            key={plan.name}
            padding="xl"
            className={`relative flex flex-col ${
              plan.popular ? 'border-2 border-brand-primary/40 shadow-medium' : ''
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-white shadow-md">
                Am beliebtesten
              </span>
            )}
            <h3 className="text-xl font-bold text-foreground dark:text-white">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold tracking-tight text-foreground dark:text-white">
                €{billingYearly ? plan.yearlyPrice : plan.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {billingYearly ? '/Jahr' : plan.period}
              </span>
            </div>
            {billingYearly && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                €{plan.yearlyPricePerMonth} / Monat · {plan.savings} gespart
              </p>
            )}

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <CheckCircle2
                    className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand-primary dark:text-brand-light"
                    aria-hidden="true"
                  />
                  <span className="text-foreground/80 dark:text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-8"
              fullWidth
              variant={plan.popular ? 'default' : 'outline'}
              asChild
            >
              <Link href={plan.ctaHref}>{plan.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">Jederzeit kündbar</p>
    </div>
  );
}
