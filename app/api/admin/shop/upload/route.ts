import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';

const STORAGE_BUCKET = 'swingz-files';
const UPLOAD_PREFIX = 'shop-products';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
};

/**
 * POST /api/admin/shop/upload
 *
 * Upload a product image to Supabase Storage.
 * Requires admin role. Returns the public URL of the uploaded image.
 *
 * Body: multipart/form-data with field "file" (the image)
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json(
        { error: 'Kein Club zugeordnet. Superadmins müssen einen Club auswählen.' },
        { status: 400 }
      );
    }

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

    // Validate file type (by MIME or extension)
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
    const safeExt = extension || '.jpg';
    const storagePath = `${UPLOAD_PREFIX}/${clubId}/${ts}-${rand}${safeExt}`;

    try {
      const supabase = createServiceClient();
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload fehlgeschlagen: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      return NextResponse.json({
        url: urlData.publicUrl,
        path: storagePath,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Upload-Fehler';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
