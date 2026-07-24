import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteStorageFile } from '@/lib/supabase/storage-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:avatar:upload');

const STORAGE_BUCKET = 'swingz-files';
const UPLOAD_PREFIX = 'avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/**
 * POST /api/avatar/upload
 *
 * Upload a user avatar to Supabase Storage and update the user's avatar_url.
 * Requires authentication. Returns the public URL of the uploaded avatar.
 *
 * Body: multipart/form-data with field "file" (the image)
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const safeExt = extension || '.jpg';
    const storagePath = `${UPLOAD_PREFIX}/${userId}/${ts}-${rand}${safeExt}`;

    try {
      const supabase = createServiceClient();

      // Delete old avatar if exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (existingUser?.avatar_url) {
        await deleteStorageFile(supabase, existingUser.avatar_url, STORAGE_BUCKET, UPLOAD_PREFIX);
      }

      // Upload new avatar
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

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      // Update user's avatar_url in DB
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        log.error('Avatar URL update error:', updateError);
        return NextResponse.json(
          {
            error: 'Bild wurde hochgeladen, aber Speichern fehlgeschlagen. Bitte erneut versuchen.',
          },
          { status: 500 }
        );
      }

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

/**
 * DELETE /api/avatar/upload
 *
 * Remove the current user's avatar.
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const supabase = createServiceClient();

      const { data: existingUser } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (existingUser?.avatar_url) {
        await deleteStorageFile(supabase, existingUser.avatar_url, STORAGE_BUCKET, UPLOAD_PREFIX);
      }

      await supabase
        .from('users')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', userId);

      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
