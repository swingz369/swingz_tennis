'use client';
import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface LegalInfo {
  amtsgericht?: string;
  registernummer?: string;
  gruendungsjahr?: string;
  vorsitzender?: string;
  kassenwart?: string;
  iban?: string;
  bic?: string;
  bank?: string;
  steuernummer?: string;
}

export function LegalTab({ clubId }: { clubId: string }) {
  const [info, setInfo] = useState<LegalInfo>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/api/clubs/${clubId}/legal`)
      .then((r) => r.json())
      .then((d) => setInfo(d.legal_info ?? {}));
  }, [clubId]);

  const set = (key: keyof LegalInfo, val: string) => setInfo((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}/legal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legal_info: info }),
      });
      if (!res.ok) {
        toast.error('Fehler beim Speichern');
        return;
      }
      toast.success('Vereinsregisterdaten gespeichert');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof LegalInfo, placeholder: string) => (
    <div key={key}>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={info[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="mt-1.5"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Vereinsregister</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Amtsgericht', 'amtsgericht', 'Amtsgericht Köln')}
          {field('Registernummer', 'registernummer', 'VR 12345')}
          {field('Gründungsjahr', 'gruendungsjahr', '1965')}
          {field('1. Vorsitzender', 'vorsitzender', 'Max Mustermann')}
          {field('Kassenwart', 'kassenwart', 'Maria Muster')}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Bankverbindung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Bank', 'bank', 'Sparkasse Köln')}
          {field('IBAN', 'iban', 'DE12 3456 7890 1234 5678 90')}
          {field('BIC', 'bic', 'COLSDE33')}
          {field('Steuernummer', 'steuernummer', '222/5700/0352')}
        </CardContent>
      </Card>
      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Speichern
      </Button>
    </div>
  );
}
