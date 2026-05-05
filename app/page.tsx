import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';

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
  } catch (error) {
    // Supabase not available or user not authenticated, show landing page
    console.log('User not authenticated, showing landing page');
  }

  // Not authenticated - show landing page
  const LandingPageContent = (await import('./landing/page')).default;
  return <LandingPageContent />;
}
