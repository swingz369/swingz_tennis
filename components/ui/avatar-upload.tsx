'use client';

import { useState, useRef, useCallback } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface AvatarUploadProps {
  userName?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onAvatarChange?: (url: string | null) => void;
  editable?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
};

const FALLBACK_TEXT_SIZE = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export function AvatarUpload({
  userName,
  avatarUrl,
  size = 'md',
  onAvatarChange,
  editable = true,
}: AvatarUploadProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(avatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      // Client-side validation
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('Datei zu groß. Maximal 2 MB erlaubt.');
        return;
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
      if (!allowed.includes(file.type)) {
        toast.error('Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP, AVIF.');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await apiFetch('/api/avatar/upload', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type — browser sets it with boundary for FormData
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload fehlgeschlagen');
        }

        const data = await res.json();
        setCurrentUrl(data.url);
        onAvatarChange?.(data.url);
        toast.success('Profilbild aktualisiert');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
      } finally {
        setUploading(false);
      }
    },
    [onAvatarChange]
  );

  const handleDelete = useCallback(async () => {
    if (!currentUrl) return;
    setDeleting(true);
    try {
      const res = await apiFetch('/api/avatar/upload', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Löschen fehlgeschlagen');
      }
      setCurrentUrl(null);
      onAvatarChange?.(null);
      toast.success('Profilbild entfernt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeleting(false);
    }
  }, [currentUrl, onAvatarChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={`${SIZE_CLASSES[size]} ring-2 ring-border transition-all duration-200`}>
          <AvatarImage src={currentUrl || undefined} alt={userName || 'Avatar'} />
          <AvatarFallback
            className={`bg-gradient-to-br from-brand-light to-brand-primary text-white font-semibold ${FALLBACK_TEXT_SIZE[size]}`}
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        {editable && (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${uploading ? 'opacity-100' : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {uploading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {editable && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs"
          >
            <Upload className="h-3 w-3 mr-1.5" />
            {uploading ? 'Wird hochgeladen...' : 'Foto ändern'}
          </Button>
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              {deleting ? 'Wird entfernt...' : 'Entfernen'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
