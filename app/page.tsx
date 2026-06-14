import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SWINGZ — KI-gestütztes Tennisclub-Management',
  description:
    'Die Plattform für intelligente Trainingsplanung, intuitive Buchungsverwaltung und smarter Club-Betrieb. Early Access jetzt kostenlos.',
};

export default async function RootPage() {
  // Check if user is authenticated - if yes, redirect to dashboard
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

  // Not authenticated - show landing page
  const LandingPageContent = (await import('./landing/page')).default;
  return <LandingPageContent />;
}
