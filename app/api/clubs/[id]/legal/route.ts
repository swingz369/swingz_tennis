import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { z } from 'zod';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

const short = z.string().trim().max(200).optional();
const LegalInfoSchema = z
  .object({
    amtsgericht: short,
    registernummer: short,
    gruendungsjahr: short,
    vorsitzender: short,
    kassenwart: short,
    iban: short,
    bic: short,
    glaeubiger_id: short,
    bank: short,
    steuernummer: short,
    rechnungstext: z.string().trim().max(500).optional(),
    rechnungsfusszeile: z.string().trim().max(300).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(_req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (auth.role !== 'owner' && auth.clubId !== id) return forbiddenResponse();
    const { data } = await auth.supabase
      .from('clubs')
      .select('legal_info')
      .eq('id', id)
      .maybeSingle();
    return NextResponse.json({ legal_info: data?.legal_info ?? {} });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse();
    if (auth.role !== 'owner' && auth.clubId !== id) return forbiddenResponse();
    const parsed = LegalInfoSchema.safeParse((await req.json().catch(() => null))?.legal_info);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Angaben' }, { status: 400 });
    }
    const legal_info = parsed.data;
    const { error } = await auth.supabase
      .from('clubs')
      .update({ legal_info, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return internalErrorResponse();
    return NextResponse.json({ success: true });
  });
}
