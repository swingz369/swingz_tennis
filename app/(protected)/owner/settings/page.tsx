import { requireAuth } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Settings, Mail, CreditCard, Database } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        {ok ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
      </div>
    </div>
  );
}

export default async function OwnerSettingsPage() {
  await requireAuth();
  const sb = createServiceClient();

  const { data: globalSettings } = await sb
    .from('system_settings')
    .select('category, key, value, description')
    .is('club_id', null)
    .order('category')
    .order('key');

  const { count: clubCount } = await sb.from('clubs').select('id', { count: 'exact', head: true });

  const env = {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    resend: !!process.env.RESEND_API_KEY,
    gemini: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    supabase: (clubCount ?? 0) >= 0,
  };

  const settingsByCategory = (globalSettings ?? []).reduce<Record<string, typeof globalSettings>>(
    (acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plattform-Einstellungen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System-Status und globale Konfiguration
        </p>
      </div>

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
          <StatusRow
            label="Google Gemini (KI)"
            ok={env.gemini}
            detail={env.gemini ? 'Flash aktiv' : 'API-Key fehlt'}
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
            ['Starter', '€ 29 / Monat'],
            ['Professional', '€ 79 / Monat'],
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

      {Object.keys(settingsByCategory).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              Globale DB-Einstellungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(settingsByCategory).map(([category, settings]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {category}
                </p>
                {(settings ?? []).map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <div>
                      <span className="text-sm font-mono">{s.key}</span>
                      {s.description && (
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs max-w-[180px] truncate">
                      {s.value}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
