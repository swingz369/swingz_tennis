import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

// POST /api/news/read — Beiträge als gelesen markieren (idempotent; RLS lässt nur sichtbare Beiträge zu)
export async function POST(req: NextRequest) {
  return withApiAuth(
    req,
    async (auth, body) => {
      const { error } = await auth.supabase.from('news_post_reads').upsert(
        body.ids.map((post_id: string) => ({ post_id, user_id: auth.user.id })),
        { onConflict: 'post_id,user_id', ignoreDuplicates: true }
      );
      if (error) return internalErrorResponse();
      return NextResponse.json({ success: true });
    },
    { body: schema }
  );
}
