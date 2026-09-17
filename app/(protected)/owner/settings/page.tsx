import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Settings, Mail, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsEditorClient, type EditableSetting } from './_components/settings-editor-client';

export const dynamic = 'force-dynamic';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        {ok ? (
          <CheckCircle className="h-4 w-4 text-success-500" />
        ) : (
          <XCircle className="h-4 w-4 text-error-400" />
        )}
      </div>
    </div>
  );
}

export default async function OwnerSettingsPage() {
  await requireAuth();
  const sb = createServiceClient();

  // ── Globale Settings (club_id IS NULL) — editierbar + read-only BLOCK ──
  const { data: globalSettings } = await sb
    .from('system_settings')
    .select('id, category, key, value, type, description, is_required, validation, club_id')
    .is('club_id', null)
    .order('category')
    .order('key');

  // Drizzle liefert `validation` als JSONB. Supabase-JS gibt je nach Selektion
  // ein rohes Objekt oder null zurück — coerce defensiv zu einer getypten Form.
  function coerce(s: {
    id: string;
    category: string;
    key: string;
    value: string;
    type: string;
    description: string | null;
    is_required: boolean;
    validation: unknown;
  }): EditableSetting {
    return {
      id: s.id,
      category: s.category,
      key: s.key,
      value: s.value,
      type: s.type,
      description: s.description,
      is_required: s.is_required,
      validation:
        s.validation && typeof s.validation === 'object'
          ? (s.validation as EditableSetting['validation'])
          : {},
    };
  }

  const settings: EditableSetting[] = (globalSettings ?? [])
    .filter((s) => s !== null)
    .map((s) => coerce(s as Parameters<typeof coerce>[0]));

  const { count: clubCount } = await sb.from('clubs').select('id', { count: 'exact', head: true });

  const env = {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    resend: !!process.env.RESEND_API_KEY,
    supabase: (clubCount ?? 0) >= 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plattform-Einstellungen"
        description="System-Status, globale Konfiguration und DB-Einstellungen"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Service-Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusRow
            label="Supabase (Datenbank)"
            ok={env.supabase}
            detail={`${clubCount} Vereine`}
          />
          <StatusRow
            label="Stripe (Zahlungen)"
            ok={env.stripe}
            detail={env.stripe ? 'Konfiguriert' : 'API-Key fehlt'}
          />
          <StatusRow
            label="Resend (E-Mail)"
            ok={env.resend}
            detail={env.resend ? 'noreply@swingz.cloud' : 'API-Key fehlt'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {[
            ['Absender (System)', 'noreply@swingz.cloud'],
            ['Absender (Kontakt)', 'info@swingz.cloud'],
            ['Auth-Mails', 'Supabase SMTP via Resend'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between py-1.5 border-b border-border last:border-0"
            >
              <span className="text-muted-foreground">{k}</span>
              <span className="font-mono text-xs">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Preismodell
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {[
            ['Solo S (Einzelverein)', '€ 29 / Monat'],
            ['Solo L (Einzelverein)', '€ 59 / Monat'],
            ['Tennisschule S', '€ 99 / Monat'],
            ['Tennisschule L', '€ 179 / Monat'],
            ['Stripe API-Version', '2026-05-27.dahlia'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between py-1.5 border-b border-border last:border-0"
            >
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editierbare DB-Settings via Client */}
      <SettingsEditorClient settings={settings} />
    </div>
  );
}
