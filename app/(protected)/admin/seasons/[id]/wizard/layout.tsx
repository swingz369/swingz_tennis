import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/infrastructure/external/supabase/server';
import { getActiveStep, WIZARD_STEPS } from './wizard-steps';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export default async function WizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, planning_status')
    .eq('id', id)
    .single();
  if (!season) notFound();

  const active = getActiveStep(season.planning_status ?? 'draft');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4">
        <p className="text-sm text-muted-foreground mb-3">{season.name} — Saisonplanung</p>
        <nav className="flex items-center gap-1">
          {WIZARD_STEPS.map((step, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <div key={step.href} className="flex items-center gap-1">
                {i > 0 && <div className="h-px w-6 bg-border mx-1" />}
                {done ? (
                  <Link
                    href={`/admin/seasons/${id}/wizard/${step.href}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Check className="h-4 w-4" />
                    {step.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-sm font-medium',
                      current ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-xs border',
                        current
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground'
                      )}
                    >
                      {i + 1}
                    </span>
                    {step.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <main className="container mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
