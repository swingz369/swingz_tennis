/**
 * Server-side Supabase service client (service_role key)
 *
 * Use this client for server-only operations that need elevated database access
 * (bypassing RLS). This client should NEVER be used in client-side code.
 *
 * Usage:
 *   import { createServiceClient } from '@/lib/supabase/service';
 *   const supabase = createServiceClient();
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return createClient(url, key);
}
