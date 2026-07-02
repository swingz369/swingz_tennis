'use client';

/**
 * Editorial Pricing Section (Phase 3)
 *
 * Client component because of the monthly/yearly billing toggle.
 * Hairline-bordered cards on cream paper. Court Clay accent for
 * the "popular" plan via a thin top-rule instead of a dark fill
 * (we're a magazine, not a casino).
 *
 * The reveal animation is opt-in via the `reveal` class on the
 * outer SectionReveal in the parent landing — this component only
 * owns the toggle + price computation.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

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
  popular: boolean;
};

const PRICING_PLANS: Plan[] = [
  {
    name: 'Starter',
    subtitle: 'Für kleine Vereine',
    price: '29',
    yearlyPrice: '290',
    yearlyPricePerMonth: '24,17',
    savings: '58 €',
    period: '/Monat',
    description: 'Alles, was ein kleiner Verein braucht — fokussiert auf das Wesentliche.',
    features: [
      'Bis zu 50 Mitglieder',
      'Bis zu 3 Trainer',
      'Buchungs-Management',
      'Mitgliederverwaltung',
      'E-Mail-Support',
      'EU-Hosting',
    ],
    cta: 'Kostenlos testen',
    popular: false,
  },
  {
    name: 'Professional',
    subtitle: 'Für wachsende Vereine',
    price: '79',
    yearlyPrice: '790',
    yearlyPricePerMonth: '65,83',
    savings: '158 €',
    period: '/Monat',
    description: 'KI-Planung, erweiterte Analytik und Saison-Wizard für ambitionierte Vereine.',
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
  },
];

export function PricingSection() {
  const [billingYearly, setBillingYearly] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="text-center mb-14 sm:mb-20">
        <p className="editorial-eyebrow text-brand-accent mb-5">
          <span className="rule-clay mr-3" aria-hidden="true" />
          Membership
        </p>
        <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight">
          Für jeden Verein die <em className="italic text-brand-primary">richtige Lösung</em>.
        </h2>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Flexible Modelle — vom kleinen Verein bis zum großen Verband. Klar, ohne Kleingedrucktes.
        </p>

        {/* ── Billing Toggle ── */}
        <div className="mt-9 inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-foreground/10 bg-card/50">
          <span
            className={`text-sm font-medium transition-colors ${
              !billingYearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Monatlich
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={billingYearly}
            aria-label="Jährliche Abrechnung"
            onClick={() => setBillingYearly((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              billingYearly ? 'bg-brand-primary' : 'bg-foreground/20'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform duration-300 ${
                billingYearly ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              billingYearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Jährlich
          </span>
          <span className="ml-1 font-mono text-[10px] tracking-widest uppercase text-brand-accent">
            −2 Mo.
          </span>
        </div>
      </div>

      {/* ── Plans ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-px max-w-5xl mx-auto bg-foreground/10 rounded-sm overflow-hidden border border-foreground/10">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.name}
            className="relative flex flex-col bg-background p-8 sm:p-10 transition-colors duration-300 hover:bg-foreground/[0.02]"
          >
            {plan.popular && (
              <span
                className="absolute top-0 left-0 right-0 h-[2px] bg-brand-accent"
                aria-hidden="true"
              />
            )}
            {plan.popular && (
              <p className="font-mono text-[10px] tracking-widest uppercase text-brand-accent mb-4">
                ◆ Am beliebtesten
              </p>
            )}
            <h3 className="font-editorial text-2xl sm:text-3xl text-foreground">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.subtitle}</p>

            <div className="mt-7 flex items-baseline gap-2">
              <span className="font-editorial text-5xl sm:text-6xl text-foreground">
                €{billingYearly ? plan.yearlyPrice : plan.price}
              </span>
              <span className="text-sm text-muted-foreground">
                {billingYearly ? '/Jahr' : plan.period}
              </span>
            </div>
            {billingYearly && (
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                €{plan.yearlyPricePerMonth} / Monat · {plan.savings} gespart
              </p>
            )}

            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{plan.description}</p>

            <ul className="mt-8 space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <CheckCircle2
                    className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                      plan.popular ? 'text-brand-accent' : 'text-brand-primary'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9">
              <Link
                href="/register"
                className={`group inline-flex w-full items-center justify-center gap-2 rounded-sm py-3.5 text-sm font-semibold transition-all duration-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  plan.popular
                    ? 'bg-brand-primary text-primary-foreground hover:bg-brand-primary/90 focus-visible:ring-brand-primary'
                    : 'border border-foreground/20 text-foreground hover:border-foreground/40 hover:bg-foreground/[0.03] focus-visible:ring-foreground/30'
                }`}
              >
                {plan.cta}
                <span
                  aria-hidden="true"
                  className="group-hover:translate-x-0.5 transition-transform"
                >
                  →
                </span>
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        14 Tage Testphase · Keine Kreditkarte · Jederzeit kündbar
      </p>
    </div>
  );
}
