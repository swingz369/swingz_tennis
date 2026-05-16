import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth } from '@/lib/api-auth';

// GET /api/news — returns news for the current user's club
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ news: [] });
  }

  return withApiAuth(req, async (auth) => {
    // Build query based on role
    let query = auth.supabase
      .from('news_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);

    // Non-superadmin: filter by club
    if (auth.role !== 'superadmin' && auth.clubId) {
      query = query.eq('club_id', auth.clubId);
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet — return empty gracefully
      return NextResponse.json({ news: [] });
    }

    return NextResponse.json({ news: data ?? [] });
  });
}

// POST /api/news — create a news item (admin only)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('demo-mode')) {
    return NextResponse.json({ success: true, id: 'demo-news-id' });
  }

  return withApiAuth(req, async (auth) => {
    if (auth.role !== 'admin' && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from('news_posts')
      .insert({
        title,
        content: content || '',
        excerpt: body.excerpt || null,
        is_pinned: body.is_pinned || false,
        is_published: true,
        author_id: auth.user.id,
        club_id: auth.clubId ?? '',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, news: data });
  });
}
