import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { errorResponse, internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

// GET /api/news/[id] — returns a single news item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    const { data, error } = await auth.supabase
      .from('news_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return errorResponse('NOT_FOUND', 'News-Eintrag nicht gefunden');
    }

    return NextResponse.json({ news: data });
  });
}

// PATCH /api/news/[id] — update a news item (admin only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    // Nur Inhaltsfelder; club_id/author_id/Zähler sind nicht änderbar.
    const raw = await req.json();
    const patch = Object.fromEntries(
      ['title', 'content', 'excerpt', 'is_pinned', 'audience']
        .filter((k) => k in raw)
        .map((k) => [k, raw[k]])
    );
    const { data, error } = await auth.supabase
      .from('news_posts')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true, news: data });
  });
}

// DELETE /api/news/[id] — delete a news item (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const { error } = await auth.supabase.from('news_posts').delete().eq('id', id);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}
