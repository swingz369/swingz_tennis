import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { searchQuerySchema } from '@/application/validation/schemas';
import { validateQuery } from '@/application/validation/validator';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const validation = validateQuery(searchQuerySchema, url.searchParams);
    if (!validation) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }
    const { q, limit } = validation.data;

    const results: SearchResult[] = [];

    try {
      const { data: members } = await auth.supabase
        .from('users')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(limit);

      if (members) {
        for (const m of members) {
          results.push({
            id: m.id,
            type: 'member',
            title: m.full_name || m.email,
            subtitle: m.email,
            url: `/members/${m.id}`,
            relevance: 10,
          });
        }
      }
    } catch (e) {
      console.warn('Member search error:', e);
    }

    try {
      const { data: bookings } = await auth.supabase
        .from('bookings')
        .select('id, booked_at, status')
        .ilike('id', `%${q}%`)
        .limit(limit);

      if (bookings) {
        for (const b of bookings) {
          const date = new Date(b.booked_at).toLocaleDateString('de-DE');
          results.push({
            id: b.id,
            type: 'booking',
            title: `Buchung ${date}`,
            subtitle: `Status: ${b.status}`,
            url: `/bookings`,
            relevance: 5,
          });
        }
      }
    } catch (e) {
      console.warn('Booking search error:', e);
    }

    try {
      const { data: trainers } = await auth.supabase
        .from('trainers')
        .select('id, name, email')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(limit);

      if (trainers) {
        for (const t of trainers) {
          results.push({
            id: t.id,
            type: 'trainer',
            title: t.name,
            subtitle: t.email,
            url: `/admin/trainers`,
            relevance: 8,
          });
        }
      }
    } catch (e) {
      console.warn('Trainer search error:', e);
    }

    try {
      const { data: clubs } = await auth.supabase
        .from('clubs')
        .select('id, name')
        .ilike('name', `%${q}%`)
        .limit(limit);

      if (clubs) {
        for (const c of clubs) {
          results.push({
            id: c.id,
            type: 'club',
            title: c.name,
            url: `/admin/clubs`,
            relevance: 7,
          });
        }
      }
    } catch (e) {
      console.warn('Club search error:', e);
    }

    return NextResponse.json(results.sort((a, b) => b.relevance - a.relevance).slice(0, limit));
  });
}
