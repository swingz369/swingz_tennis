import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { systemDb } from '@/infrastructure/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:news');

const audienceSchema = z.enum(['all', 'trainers', 'members']);

const createSchema = z.object({
  title: z.string().trim().min(1, 'Titel und Inhalt sind erforderlich').max(250),
  content: z.string().trim().min(1, 'Titel und Inhalt sind erforderlich'),
  excerpt: z.string().nullish(),
  is_pinned: z.boolean().optional(),
  audience: audienceSchema.default('all'),
  /** Zielgruppe zusätzlich per Glocke benachrichtigen. */
  notify: z.boolean().default(false),
});

// GET /api/news — Beiträge des aktiven Vereins; je Nutzer mit Lesestatus, für die Verwaltung mit Lesequote.
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
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
    if (error) return NextResponse.json({ news: [] });

    const isAdmin = await verifyRole(auth, 'admin');
    const [reads, stats] = await Promise.all([
      auth.supabase.from('news_post_reads').select('post_id').eq('user_id', auth.user.id),
      isAdmin && auth.clubId
        ? auth.supabase.rpc('news_read_stats', { p_club_id: auth.clubId })
        : Promise.resolve({ data: null }),
    ]);
    const readIds = new Set((reads.data ?? []).map((r) => r.post_id));
    const statById = new Map((stats.data ?? []).map((s) => [s.post_id, s]));

    return NextResponse.json({
      news: (data ?? []).map((n) => ({
        ...n,
        is_read: readIds.has(n.id),
        read_count: statById.get(n.id)?.read_count ?? null,
        audience_count: statById.get(n.id)?.audience_count ?? null,
      })),
    });
  });
}

// POST /api/news — Ankündigung veröffentlichen (Verwaltung)
export async function POST(req: NextRequest) {
  return withApiAuth(
    req,
    async (auth, body) => {
      if (!(await verifyRole(auth, 'admin'))) {
        return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
      }
      if (!auth.clubId) {
        return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
      }

      const { data, error } = await auth.supabase
        .from('news_posts')
        .insert({
          title: body.title,
          content: body.content,
          excerpt: body.excerpt || null,
          is_pinned: body.is_pinned ?? false,
          audience: body.audience,
          is_published: true,
          author_id: auth.user.id,
          club_id: auth.clubId,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) return internalErrorResponse();

      if (body.notify) {
        await notifyAudience(auth.clubId, body.audience, auth.user.id, data.title).catch((e) =>
          log.error(
            'Benachrichtigung zur Ankündigung fehlgeschlagen',
            e instanceof Error ? e : undefined
          )
        );
      }
      return NextResponse.json({ success: true, news: data });
    },
    { body: createSchema }
  );
}

/** Glocken-Eintrag für die Zielgruppe (ohne Autor). Legt fremde Zeilen an, daher Service-Client. */
async function notifyAudience(
  clubId: string,
  audience: z.infer<typeof audienceSchema>,
  authorId: string,
  title: string
) {
  const db = systemDb('news-announcement-notify');
  const { data } = await db
    .from('user_club_memberships')
    .select('user_id, role')
    .eq('club_id', clubId)
    .eq('is_active', true);
  const staff = ['trainer', 'admin', 'superadmin'];
  const ids = [
    ...new Set(
      (data ?? [])
        .filter((m) =>
          audience === 'all'
            ? true
            : audience === 'trainers'
              ? staff.includes(m.role)
              : m.role === 'member'
        )
        .map((m) => m.user_id)
        .filter((id) => id !== authorId)
    ),
  ];
  for (let i = 0; i < ids.length; i += 500) {
    await db.from('notifications').insert(
      ids.slice(i, i + 500).map((user_id) => ({
        user_id,
        club_id: clubId,
        type: 'info',
        title: 'Neue Ankündigung',
        message: title,
        action_url: '/messages?section=news',
      }))
    );
  }
}
