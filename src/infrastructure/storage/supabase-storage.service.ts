/**
 * Supabase Storage Service Implementation
 * Infrastructure Layer
 *
 * Konkrete Implementierung der StorageService Interface mit Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import type {
  StorageService,
  StorageFile,
  UploadOptions,
} from '@/domain/services/storage-service.interface';
import { env } from '@/lib/env';

export class SupabaseStorageService implements StorageService {
  private supabase: ReturnType<typeof createClient>;
  private bucketName: string;

  constructor(bucketName: string = 'swingz-files') {
    this.supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    this.bucketName = bucketName;
  }

  async uploadFile(
    file: Buffer | Blob,
    path: string,
    options?: UploadOptions
  ): Promise<StorageFile> {
    const { data, error } = await this.supabase.storage.from(this.bucketName).upload(path, file, {
      contentType: options?.allowedTypes?.[0],
      upsert: true,
      metadata: options?.metadata,
    });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const publicUrl = this.supabase.storage.from(this.bucketName).getPublicUrl(path).data.publicUrl;

    return {
      path,
      url: publicUrl,
      size: file instanceof Buffer ? file.length : file.size,
      mimeType: options?.allowedTypes?.[0] || 'application/octet-stream',
      uploadedAt: new Date(),
    };
  }

  async downloadFile(path: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage.from(this.bucketName).download(path);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async deleteFiles(paths: string[]): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucketName).remove(paths);

    if (error) {
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(path.split('/').slice(0, -1).join('/'));

    if (error) return false;

    const filename = path.split('/').pop();
    return data?.some((file) => file.name === filename) || false;
  }

  async getPublicUrl(path: string): Promise<string> {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

    return data.publicUrl;
  }

  async getSignedUrl(path: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async listFiles(directory: string): Promise<StorageFile[]> {
    const { data, error } = await this.supabase.storage.from(this.bucketName).list(directory);

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (
      data?.map((file) => ({
        path: `${directory}/${file.name}`,
        url: this.supabase.storage.from(this.bucketName).getPublicUrl(`${directory}/${file.name}`)
          .data.publicUrl,
        size: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'application/octet-stream',
        uploadedAt: new Date(file.created_at),
      })) || []
    );
  }

  async getFileMetadata(path: string): Promise<StorageFile> {
    const directory = path.split('/').slice(0, -1).join('/');
    const filename = path.split('/').pop()!;

    const { data, error } = await this.supabase.storage.from(this.bucketName).list(directory);

    if (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }

    const file = data?.find((f) => f.name === filename);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    return {
      path,
      url: this.supabase.storage.from(this.bucketName).getPublicUrl(path).data.publicUrl,
      size: file.metadata?.size || 0,
      mimeType: file.metadata?.mimetype || 'application/octet-stream',
      uploadedAt: new Date(file.created_at),
    };
  }

  async moveFile(oldPath: string, newPath: string): Promise<void> {
    const { error } = await this.supabase.storage.from(this.bucketName).move(oldPath, newPath);

    if (error) {
      throw new Error(`Failed to move file: ${error.message}`);
    }
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .copy(sourcePath, destinationPath);

    if (error) {
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }
}
