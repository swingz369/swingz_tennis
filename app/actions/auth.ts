'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Clears auth cookies and redirects to login.
 */
export async function clearAuthCookiesAndRedirect() {
  'use server';

  const cookieStore = await cookies();

  // Clear all auth-related cookies
  cookieStore.delete('sb-access-token');
  cookieStore.delete('sb-refresh-token');
  cookieStore.delete('sb-session-token');
  cookieStore.delete('demo-mode');

  redirect('/login');
}
