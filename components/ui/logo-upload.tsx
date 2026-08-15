'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Trash2, Upload, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface LogoUploadProps {
  /** Current logo URL (from DB or state) */
  logoUrl?: string | null;
  /** Which branding variant this is for */
  variant?: 'light' | 'dark' | 'favicon' | 'dashboard-bg';
  /** Label shown above the component */
  label?: string;
  /** Club ID for API calls that need x-club-id header */
  clubId?: string;
  /** Called when the logo URL changes (after upload or URL input) */
  onLogoChange?: (url: string | null) => void;
}

export function LogoUpload({
  logoUrl,
  variant = 'light',
  label = 'Logo',
  clubId,
  onLogoChange,
}: LogoUploadProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(logoUrl || null);
  const [urlInput, setUrlInput] = useState(logoUrl || '');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      const maxSize = variant === 'dashboard-bg' ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`Datei zu groß. Maximal ${maxSize / 1024 / 1024} MB erlaubt.`);
        return;
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];
      if (!allowed.includes(file.type)) {
        toast.error('Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP, AVIF, SVG.');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('variant', variant);

        const res = await apiFetch('/api/club-logo/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(extractErrorMessage(data) || 'Upload fehlgeschlagen');
        }

        const data = await res.json();
        setCurrentUrl(data.url);
        setUrlInput(data.url);
        onLogoChange?.(data.url);
        toast.success('Logo aktualisiert');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
      } finally {
        setUploading(false);
      }
    },
    [onLogoChange, variant]
  );

  const handleUrlApply = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error('Bitte eine URL eingeben');
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error('Ungültige URL');
      return;
    }

    // Persist URL directly via the branding API
    try {
      const res = await apiFetch('/api/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(clubId ? { 'x-club-id': clubId } : {}),
        },
        body: JSON.stringify({
          logos: {
            ...(variant === 'light' ? { light: url } : {}),
            ...(variant === 'dark' ? { dark: url } : {}),
            ...(variant === 'favicon' ? { favicon: url } : {}),
            ...(variant === 'dashboard-bg' ? { dashboardBg: url } : {}),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data) || 'Speichern fehlgeschlagen');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
      return;
    }

    setCurrentUrl(url);
    onLogoChange?.(url);
    toast.success('Logo-URL gespeichert');
  }, [urlInput, variant, onLogoChange, clubId]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await apiFetch('/api/club-logo/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data) || 'Löschen fehlgeschlagen');
      }
      setCurrentUrl(null);
      setUrlInput('');
      onLogoChange?.(null);
      toast.success('Logo entfernt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeleting(false);
    }
  }, [variant, onLogoChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>

      {/* Preview */}
      {currentUrl && (
        <div className="relative group inline-block">
          <div
            className={
              variant === 'dashboard-bg'
                ? 'w-full max-w-md h-32 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden'
                : 'w-24 h-24 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden'
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element,jsx-a11y/no-noninteractive-element-interactions -- logo upload preview needs raw <img> for dynamic external URLs */}
            <img
              src={currentUrl}
              alt={label}
              className={
                variant === 'dashboard-bg'
                  ? 'w-full h-full object-cover'
                  : 'max-w-full max-h-full object-contain'
              }
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-0 p-0"
            onClick={handleDelete}
            aria-label="Logo löschen"
          >
            {deleting ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      )}

      {/* Upload tabs: Datei vs URL */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="h-8 w-fit">
          <TabsTrigger value="upload" className="text-xs gap-1 px-3">
            <Upload className="h-3 w-3" /> Datei
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1 px-3">
            <LinkIcon className="h-3 w-3" /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading ? 'Wird hochgeladen...' : 'Datei auswählen'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-2xs text-muted-foreground mt-1">
            JPG, PNG, WebP, SVG · Max. {variant === 'dashboard-bg' ? '5' : '2'} MB
          </p>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleUrlApply} className="shrink-0">
              Übernehmen
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
