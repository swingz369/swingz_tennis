'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Image as ImageIcon, Globe } from 'lucide-react';
import { LogoUpload } from '@/components/ui/logo-upload';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

interface BrandingData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  customDomain: string;
}

export default function BrandingSettingsClient({ clubId }: { clubId: string }) {
  const [activeTab, setActiveTab] = useState('colors');
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState<BrandingData>({
    primaryColor: '#1B4332',
    secondaryColor: '#1e3a5f',
    accentColor: '#FF6B35',
    logoLightUrl: '',
    logoDarkUrl: '',
    customDomain: '',
  });

  const fetchBranding = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/branding?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setBranding({
          primaryColor: data.brand.primaryColor,
          secondaryColor: data.brand.secondaryColor,
          accentColor: data.brand.accentColor,
          logoLightUrl: data.logos.light || '',
          logoDarkUrl: data.logos.dark || '',
          customDomain: data.customDomain || '',
        });
      }
    } catch {
      console.error('Failed to load branding');
    }
  }, [clubId]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const saveBranding = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/branding', {
        method: 'PUT',
        headers: { 'x-club-id': clubId },
        body: JSON.stringify({
          brand: {
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
            accentColor: branding.accentColor,
          },
          // Logos are persisted directly by LogoUpload via /api/club-logo/upload
          customDomain: branding.customDomain || null,
        }),
      });
      if (res.ok) {
        toast.success('Branding gespeichert');
      } else {
        toast.error('Fehler beim Speichern');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="White-Label Einstellungen"
        description="Passe das Aussehen deines Clubs an und konfiguriere eine eigene Domain."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="colors">
            <Palette className="h-4 w-4 mr-2" /> Farben
          </TabsTrigger>
          <TabsTrigger value="logos">
            <ImageIcon className="h-4 w-4 mr-2" /> Logos
          </TabsTrigger>
          <TabsTrigger value="domain">
            <Globe className="h-4 w-4 mr-2" /> Domain
          </TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-4">
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Primärfarbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    placeholder="#1B4332"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sekundärfarbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                    placeholder="#1e3a5f"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Akzentfarbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.accentColor}
                    onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={branding.accentColor}
                    onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                    placeholder="#FF6B35"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={saveBranding} disabled={saving}>
                {saving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logos" className="space-y-4">
          <Card className="p-6 space-y-6">
            <LogoUpload
              logoUrl={branding.logoLightUrl}
              variant="light"
              label="Logo (Light Mode)"
              clubId={clubId}
              onLogoChange={(url) => setBranding({ ...branding, logoLightUrl: url || '' })}
            />
            <LogoUpload
              logoUrl={branding.logoDarkUrl}
              variant="dark"
              label="Logo (Dark Mode)"
              clubId={clubId}
              onLogoChange={(url) => setBranding({ ...branding, logoDarkUrl: url || '' })}
            />
            <LogoUpload
              logoUrl={null}
              variant="favicon"
              label="Favicon (Vereinssymbol)"
              clubId={clubId}
              onLogoChange={(url) => {
                if (url) {
                  // Update favicon immediately in browser
                  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
                  if (link) link.href = url;
                }
              }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Eigene Domain (Custom Domain)</Label>
              <Input
                placeholder="https://mein-verein.de"
                value={branding.customDomain}
                onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Nach Aktivierung wird dein Studio unter dieser Domain erreichbar sein. DNS-Eintrag
                muss auf swingz.cloud zeigen.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveBranding} disabled={saving}>
                {saving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
