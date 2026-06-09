import { requireAuth } from '@/lib/auth';
import NewsAnnouncements, { type NewsItem } from '@/components/news-announcements';

export default async function NewsAnnouncementsPage() {
  const auth = await requireAuth();
  const { supabase, user } = auth;

  // The supabase client comes pre-initialized from requireAuth() with the
  // user's session cookies, so RLS policies apply automatically.

  // Detect admin/superadmin role for the manage-actions UI
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const roles: string[] = (memberships ?? []).map((m) => (m as { role: string }).role);
  const canManage = roles.some((r) => r === 'admin' || r === 'superadmin');

  // Server-side initial fetch so first paint is fast and the manage UI is
  // rendered with the right data from the start.
  let initialNews: NewsItem[] = [];
  try {
    let query = supabase
      .from('news_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);

    const isSuperAdmin = roles.includes('superadmin');
    const { data: primaryMembership } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('club_id', 'is', null)
      .limit(1)
      .maybeSingle();

    const clubId = (primaryMembership as { club_id?: string } | null)?.club_id ?? null;
    if (!isSuperAdmin && clubId) {
      query = query.eq('club_id', clubId);
    }

    const { data } = await query;
    initialNews = (data ?? []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      title: (n.title as string) ?? '',
      content: (n.content as string) ?? '',
      type: ((n.type as NewsItem['type']) ?? 'announcement') as NewsItem['type'],
      priority: ((n.priority as NewsItem['priority']) ?? 'medium') as NewsItem['priority'],
      publishedAt:
        (n.published_at as string) ?? (n.created_at as string) ?? new Date().toISOString(),
      author: (n.author_name as string) ?? (n.author as string) ?? 'SwingZ Team',
      tags: (n.tags as string[]) ?? [],
      expiresAt: (n.expires_at as string) ?? undefined,
      isPinned: Boolean(n.is_pinned),
    }));
  } catch {
    // Table may not exist yet — fall back to empty list
    initialNews = [];
  }

  return <NewsAnnouncements canManage={canManage} initialNews={initialNews} />;
}
