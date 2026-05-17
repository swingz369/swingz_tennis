import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SCHEDULER_URL = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3002';
const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // Auth check — only authenticated users can trigger scheduling
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin or superadmin role
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await request.json();

    // Forward to Express scheduler with API key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (SCHEDULER_API_KEY) {
      headers['x-api-key'] = SCHEDULER_API_KEY;
    }

    const res = await fetch(`${SCHEDULER_URL}/api/schedule/optimize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Scheduler proxy error:', error);
    return NextResponse.json({ error: 'Scheduling service unavailable' }, { status: 503 });
  }
}
