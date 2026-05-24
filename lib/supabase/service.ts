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

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export function createServiceClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
