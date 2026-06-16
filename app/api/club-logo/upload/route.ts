import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteStorageFile } from '@/lib/supabase/storage-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:club-logo:upload');

const STORAGE_BUCKET = 'swingz-files';
const UPLOAD_PREFIX = 'club-logos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'];
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/**
 * POST /api/club-logo/upload
 *
 * Upload a club logo to Supabase Storage and update the club's branding.
 * Requires admin role. Returns the public URL of the uploaded logo.
 *
 * Body: multipart/form-data with field "file" and optional "variant" (light|dark|favicon)
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club zugeordnet.' }, { status: 400 });
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Ungültiges FormData. Erwartet: multipart/form-data mit Feld "file".' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { error: 'Keine Datei gefunden. Feld "file" erforderlich.' },
        { status: 400 }
      );
    }

    const variant = (formData.get('variant') as string) || 'light';

    // Validate file type
    const fileName = file.name.toLowerCase();
    const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    const mimeType = file.type || EXT_TO_MIME[extension] || '';

    if (!ALLOWED_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: `Ungültiger Dateityp. Erlaubt: ${ALLOWED_EXTENSIONS.join(', ')}. Erhalten: ${extension || mimeType}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Datei zu groß. Maximal ${MAX_FILE_SIZE / 1024 / 1024} MB erlaubt.` },
        { status: 400 }
      );
    }

    // Generate unique storage path
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const safeExt = extension || '.png';
    const storagePath = `${UPLOAD_PREFIX}/${clubId}/${variant}/${ts}-${rand}${safeExt}`;

    try {
      const supabase = createServiceClient();

      // Delete old logo for this variant if exists
      const dbColumn =
        variant === 'dark'
          ? 'logo_dark_url'
          : variant === 'favicon'
            ? 'favicon_url'
            : 'logo_light_url';

      const { data: existingClub } = await supabase
        .from('clubs')
        .select(dbColumn)
        .eq('id', clubId)
        .single();

      const oldUrl = (existingClub as Record<string, string | null> | null)?.[dbColumn];
      if (oldUrl) {
        await deleteStorageFile(supabase, oldUrl, STORAGE_BUCKET, UPLOAD_PREFIX);
      }

      // Upload new logo
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType || 'image/png',
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload fehlgeschlagen: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      // Update club branding in DB
      const { error: updateError } = await supabase
        .from('clubs')
        .update({ [dbColumn]: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', clubId);

      if (updateError) {
        log.error('Club logo URL update error:', updateError);
      }

      return NextResponse.json({
        url: urlData.publicUrl,
        path: storagePath,
        variant,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Upload-Fehler';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

/**
 * DELETE /api/club-logo/upload
 *
 * Remove the club's logo for a given variant.
 * Body: JSON { variant: 'light' | 'dark' | 'favicon' }
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club zugeordnet.' }, { status: 400 });
    }

    let variant: string;
    try {
      const body = await request.json();
      variant = body.variant || 'light';
    } catch {
      variant = 'light';
    }
    // Validate variant to prevent arbitrary column access
    const validVariants = ['light', 'dark', 'favicon'] as const;
    if (!validVariants.includes(variant as (typeof validVariants)[number])) {
      return NextResponse.json(
        { error: 'Ungültige Variante. Erlaubt: light, dark, favicon' },
        { status: 400 }
      );
    }

    try {
      const supabase = createServiceClient();

      const dbColumn =
        variant === 'dark'
          ? 'logo_dark_url'
          : variant === 'favicon'
            ? 'favicon_url'
            : 'logo_light_url';

      const { data: existingClub } = await supabase
        .from('clubs')
        .select(dbColumn)
        .eq('id', clubId)
        .single();

      const existingUrl = (existingClub as Record<string, string | null> | null)?.[dbColumn];
      if (existingUrl) {
        await deleteStorageFile(supabase, existingUrl, STORAGE_BUCKET, UPLOAD_PREFIX);
      }

      await supabase
        .from('clubs')
        .update({ [dbColumn]: null, updated_at: new Date().toISOString() })
        .eq('id', clubId);

      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
