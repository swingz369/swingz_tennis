import type { createServiceClient } from '@/lib/supabase/service';

/**
 * Extract a storage file path from a Supabase Storage public URL
 * and optionally restrict deletion to a specific path prefix.
 *
 * @example
 * // URL: https://xxx.supabase.co/storage/v1/object/public/swingz-files/avatars/user123/photo.jpg
 * // Bucket: 'swingz-files'
 * // Returns: 'avatars/user123/photo.jpg'
 */
function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split('/');
    const bucketIdx = pathParts.indexOf(bucket);
    if (bucketIdx === -1) return null;
    return pathParts.slice(bucketIdx + 1).join('/');
  } catch {
    return null;
  }
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

/**
 * Delete a file from Supabase Storage given its public URL.
 *
 * Only deletes files whose path starts with `allowedPrefix` to prevent
 * accidental deletion of unrelated files (e.g. from other upload categories).
 * Silently ignores errors (file may already be deleted, URL may be invalid, etc.).
 *
 * @param supabase  - Service-role Supabase client
 * @param publicUrl - The public URL of the file to delete
 * @param bucket    - The storage bucket name
 * @param allowedPrefix - Only delete if the path starts with this prefix
 */
export async function deleteStorageFile(
  supabase: SupabaseClient,
  publicUrl: string,
  bucket: string,
  allowedPrefix: string
): Promise<void> {
  const filePath = extractStoragePath(publicUrl, bucket);
  if (!filePath) return;
  if (!filePath.startsWith(allowedPrefix)) return;

  try {
    await supabase.storage.from(bucket).remove([filePath]);
  } catch {
    // Ignore cleanup errors — file may already be deleted
  }
}
