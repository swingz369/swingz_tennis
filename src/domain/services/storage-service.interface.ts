/**
 * Storage Service Interface (Domain Layer)
 *
 * Definiert die Contract für File Storage ohne Infrastructure-Details
 * Pattern from INTEGRATION_ROADMAP.md Phase 2.2
 *
 * Use Cases können diese Interface verwenden, ohne von konkreten
 * Storage-Providern (Supabase Storage, S3, etc.) abhängig zu sein
 */

export interface StorageFile {
  path: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface UploadOptions {
  /**
   * File visibility
   * - 'public': Anyone can access via URL
   * - 'private': Requires authentication to access
   */
  visibility?: 'public' | 'private';

  /**
   * Maximum file size in bytes
   */
  maxSize?: number;

  /**
   * Allowed MIME types
   */
  allowedTypes?: string[];

  /**
   * Custom metadata
   */
  metadata?: Record<string, string>;
}

export interface StorageService {
  /**
   * Upload a file to storage
   *
   * @param file - File buffer or blob
   * @param path - Storage path (e.g., 'invoices/2026/invoice-123.pdf')
   * @param options - Upload options
   * @returns StorageFile with public URL
   */
  uploadFile(file: Buffer | Blob, path: string, options?: UploadOptions): Promise<StorageFile>;

  /**
   * Download a file from storage
   *
   * @param path - Storage path
   * @returns File buffer
   */
  downloadFile(path: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   *
   * @param path - Storage path
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Delete multiple files from storage
   *
   * @param paths - Array of storage paths
   */
  deleteFiles(paths: string[]): Promise<void>;

  /**
   * Check if file exists
   *
   * @param path - Storage path
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Get public URL for a file
   *
   * @param path - Storage path
   * @returns Public URL (or signed URL for private files)
   */
  getPublicUrl(path: string): Promise<string>;

  /**
   * Get signed URL for temporary access to private file
   *
   * @param path - Storage path
   * @param expiresIn - Expiration time in seconds
   */
  getSignedUrl(path: string, expiresIn: number): Promise<string>;

  /**
   * List files in a directory
   *
   * @param directory - Directory path
   */
  listFiles(directory: string): Promise<StorageFile[]>;

  /**
   * Get file metadata
   *
   * @param path - Storage path
   */
  getFileMetadata(path: string): Promise<StorageFile>;

  /**
   * Move/rename a file
   *
   * @param oldPath - Current path
   * @param newPath - New path
   */
  moveFile(oldPath: string, newPath: string): Promise<void>;

  /**
   * Copy a file
   *
   * @param sourcePath - Source path
   * @param destinationPath - Destination path
   */
  copyFile(sourcePath: string, destinationPath: string): Promise<void>;
}

/**
 * Usage in Use Case:
 *
 * ```ts
 * // src/application/use-cases/invoice.use-cases.ts
 * import type { StorageService } from '@/domain/services/storage-service.interface';
 * import type { InvoiceRepository } from '@/domain/repositories/invoice-repository.interface';
 *
 * export class GenerateInvoicePDFUseCase {
 *   constructor(
 *     private readonly invoiceRepo: InvoiceRepository,
 *     private readonly storageService: StorageService  // ← Interface
 *   ) {}
 *
 *   async execute(invoiceId: string): Promise<string> {
 *     const invoice = await this.invoiceRepo.findById(invoiceId);
 *     const pdfBuffer = await generatePDF(invoice);  // Some PDF lib
 *
 *     // Upload via interface
 *     const file = await this.storageService.uploadFile(
 *       pdfBuffer,
 *       `invoices/${invoice.year}/invoice-${invoice.number}.pdf`,
 *       { visibility: 'private' }
 *     );
 *
 *     return file.url;
 *   }
 * }
 * ```
 */
