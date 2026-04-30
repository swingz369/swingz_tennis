import { createClient } from '@/infrastructure/external/supabase/server';
import { NextResponse } from 'next/server';

export interface SearchResult {
  id: string;
  type: 'member' | 'booking' | 'trainer' | 'club';
  title: string;
  subtitle?: string;
  url: string;
  relevance: number;
}

/**
 * Search across multiple entity types
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();
  const results: SearchResult[] = [];

  // Search members (by name or email)
  try {
    const { data: members } = await supabase
      .from('users')
      .select('id, full_name, email')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
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

  // Search bookings (by booking ID)
  try {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, booked_at, status')
      .ilike('id', `%${query}%`)
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

  // Search trainers (by name)
  try {
    const { data: trainers } = await supabase
      .from('trainers')
      .select('id, name, email')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
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

  // Search clubs (by name)
  try {
    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name')
      .ilike('name', `%${query}%`)
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

  // Sort by relevance and return
  return NextResponse.json(results.sort((a, b) => b.relevance - a.relevance).slice(0, limit));
}
