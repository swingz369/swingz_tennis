'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/clubs/${clubId}/legal`)
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setInfo(d.legal_info ?? {});
      })
      .catch(() => toast.error('Vereinsregisterdaten konnten nicht geladen werden'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vereinsregister</CardTitle>
          <CardDescription>Amtsgericht, Registernummer und Vorstand deines Vereins</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Amtsgericht', 'amtsgericht', 'Amtsgericht Köln')}
          {field('Registernummer', 'registernummer', 'VR 12345')}
          {field('Gründungsjahr', 'gruendungsjahr', '1965')}
          {field('1. Vorsitzender', 'vorsitzender', 'Max Mustermann')}
          {field('Kassenwart', 'kassenwart', 'Maria Muster')}
          {field('Steuernummer', 'steuernummer', '222/5700/0352')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bankverbindung</CardTitle>
          <CardDescription>Kontodaten für Lastschriften und Überweisungen</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Bank', 'bank', 'Sparkasse Köln')}
          {field('IBAN', 'iban', 'DE12 3456 7890 1234 5678 90')}
          {field('BIC', 'bic', 'COLSDE33')}
        </CardContent>
      </Card>

      <div className="flex justify-end border-t border-border pt-5">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
}
