import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:documents');
const BUCKET = 'swingz-files';
const MAX_SIZE = 20 * 1024 * 1024;

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) return forbiddenResponse();
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ documents: [] });

    const { data } = await (auth.supabase as any)
      .from('club_documents')
      .select('id, name, category, file_url, file_size_bytes, mime_type, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ documents: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin access required');
    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'Kein Verein' }, { status: 400 });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Ungültiges FormData' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name || 'Dokument';
    const category = (formData.get('category') as string) || 'sonstige';

    if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: 'Datei zu groß (max 20 MB)' }, { status: 400 });

    const ext = file.name.split('.').pop() ?? 'bin';
    const filePath = `documents/${clubId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const sb = createServiceClient();
    const { error: uploadErr } = await sb.storage.from(BUCKET).upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadErr) {
      log.error('Upload failed', uploadErr);
      return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = sb.storage.from(BUCKET).getPublicUrl(filePath);

    const { data: doc, error: dbErr } = await (sb as any)
      .from('club_documents')
      .insert({
        club_id: clubId,
        name: name.trim(),
        category,
        file_url: publicUrl,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: auth.user.id,
      })
      .select('id, name, category, file_url, file_size_bytes, mime_type, created_at')
      .single();

    if (dbErr) {
      await sb.storage.from(BUCKET).remove([filePath]);
      return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  });
}
