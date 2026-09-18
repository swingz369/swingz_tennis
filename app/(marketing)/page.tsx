import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SWINGZ | Tennisclub-Management',
  description:
    'Die Plattform für intelligente Trainingsplanung, intuitive Buchungsverwaltung und smarter Club-Betrieb. Early Access jetzt kostenlos.',
  alternates: {
    canonical: '/',
  },
};

// Must re-check auth on every request — otherwise a cached/static response
// can serve the landing page to a just-logged-in user before the redirect.
export const dynamic = 'force-dynamic';

export default async function MarketingRootPage() {
  // Server-side auth check — logged-in users get the dashboard, not the pitch.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect('/dashboard');
    }
  } catch {
    // Supabase not available or user not authenticated, show landing page
  }

  // Not authenticated — render the editorial landing experience
  // (wrapped by app/(marketing)/layout.tsx which applies .theme-editorial)
  const LandingPage = (await import('./landing/page')).default;
  return <LandingPage />;
}
