import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { systemDb } from '@/infrastructure/db';

const BUCKET = 'swingz-files';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');

    const sb = systemDb('Vereinsdokumente: Löschen inkl. Storage');
    const { data: doc } = await sb
      .from('club_documents')
      .select('id, club_id, file_path')
      .eq('id', id)
      .maybeSingle();

    if (!doc) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    if (doc.club_id !== auth.clubId) return forbiddenResponse();

    await sb.storage.from(BUCKET).remove([doc.file_path]);
    await sb.from('club_documents').delete().eq('id', id);

    return NextResponse.json({ success: true });
  });
}
