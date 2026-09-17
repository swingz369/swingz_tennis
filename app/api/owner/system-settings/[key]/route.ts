/**
 * PATCH /api/owner/system-settings/[key]
 *
 * Owner-gated Mutation einer GLOBALEN system_settings-Row (club_id IS NULL).
 *
 * Was darf editiert werden:
 *   - Alles mit club_id IS NULL (Plattform-weite Konfiguration)
 *   - Validierung laeuft gegen die in der Row hinterlegte `validation`-Spalte:
 *     { min?: number, max?: number, pattern?: string, enum?: string[] }
 *   - `type` in der Row ('number'|'string'|'boolean'|...) bestimmt das Parsing.
 *
 * Was darf NICHT editiert werden:
 *   - club-spezifische Rows (club_id IS NOT NULL) — gehoeren in /api/admin/system/settings.
 *   - Settings mit is_required=true, die durch ENV-Vars oder Migration gepflegt werden
 *     (z. B. board_quorum_min_members). Diese werden per 422 abgelehnt, weil sie
 *     ein bewusstes Schema-Update benoetigen.
 *
 * Defense-in-depth: Service-Client (RLS-Bypass) weil Owner plattformweit operiert.
 * verifyRole('owner') als einziger Auth-Gate.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:owner:system-settings');

interface PatchBody {
  value?: string | number | boolean;
}

interface Setting {
  id: string;
  category: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  is_required: boolean;
  validation: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

function parseToType(raw: string, type: string): unknown {
  switch (type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    default:
      return raw;
  }
}

function coerce(value: unknown, type: string): string {
  switch (type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
    case 'boolean':
      return value === true ? 'true' : value === false ? 'false' : '';
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return typeof value === 'string' ? value : value == null ? '' : String(value);
  }
}

function validate(value: unknown, s: Setting): string | null {
  // Required-by-validation: enum > range (number) > pattern (string)
  if (s.validation.enum?.length) {
    if (!s.validation.enum.includes(String(value))) {
      return `Wert muss eine der Optionen sein: ${s.validation.enum.join(', ')}`;
    }
  }
  if (s.type === 'number' && typeof value === 'number') {
    if (s.validation.min !== undefined && value < s.validation.min) {
      return `Wert muss ≥ ${s.validation.min} sein`;
    }
    if (s.validation.max !== undefined && value > s.validation.max) {
      return `Wert muss ≤ ${s.validation.max} sein`;
    }
  }
  if (s.type === 'string' && typeof value === 'string' && s.validation.pattern) {
    // ReDoS-Schutz: Pattern werden auf Laenge und Simplizitaet geprueft, bevor
    // sie kompiliert werden. Verschachtelte Quantifiers koennten die Node-Event-Loop
    // auf einem einzelnen Match mehrere Sekunden blockieren (klassische ReDoS-Bombe).
    // ReDoS-Schutz, zweite Iteration: strengeres Pattern-Verbot. Deckt sowohl
    // `a++` als auch die klassische `(a+)+`-Bombe ab, weil jedes Pattern mit
    // >= 2 Quantifier-Chars (in beliebiger Kombination) abgelehnt wird — ohne
    // Length-und-Nested-Group-AST-Checks über externe Deps.
    if (s.validation.pattern.length > 80) {
      return 'Pattern zu lang (max. 80 Zeichen, ReDoS-Schutz)';
    }
    const quantifierCount = (s.validation.pattern.match(/[+*?]/g) ?? []).length;
    if (quantifierCount >= 2) {
      return 'Pattern mit mehreren Quantifiers nicht erlaubt (ReDoS-Schutz)';
    }
    try {
      const re = new RegExp(s.validation.pattern);
      if (!re.test(value)) return `Wert entspricht nicht dem Pattern ${s.validation.pattern}`;
    } catch {
      return 'Pattern ungueltig (DB-Verantwortung)';
    }
  }
  return null;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'owner'))) {
      return forbiddenResponse('Zugriff nur für den Plattformbetreiber');
    }

    const { key } = await ctx.params;
    if (!/^[a-z][a-z0-9_]{0,99}$/i.test(key)) {
      return NextResponse.json({ error: 'Ungültiger Setting-Key' }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: 'Body muss valides JSON sein' }, { status: 400 });
    }
    if (body.value === undefined) {
      return NextResponse.json({ error: 'Feld "value" ist erforderlich' }, { status: 400 });
    }

    const sb = createServiceClient();

    const { data: setting, error: loadErr } = await sb
      .from('system_settings')
      .select('id, category, key, value, type, description, is_required, validation')
      .eq('key', key)
      .is('club_id', null)
      .maybeSingle<Setting>();

    if (loadErr) {
      log.error('Read setting failed', loadErr);
      return NextResponse.json({ error: 'Setting-Lookup fehlgeschlagen' }, { status: 500 });
    }
    if (!setting) {
      return NextResponse.json(
        { error: `Globales Setting "${key}" nicht gefunden` },
        { status: 404 }
      );
    }
    // is_required-Settings werden per Migration / ENV-Var gepflegt — der API-Pfad
    // ist nicht der richtige Modify-Channel, weil sie Schema-Constraints tragen
    // (z. B. board_quorum_min_members referenziert in lib/decisions/decision.service.ts).
    if (setting.is_required) {
      return NextResponse.json(
        {
          error:
            'Dieses Setting ist als is_required markiert und kann nicht via API geaendert werden',
        },
        { status: 422 }
      );
    }

    // Vergleich gegen aktuellen Wert, um No-Op-PATCHes zu vermeiden.
    const currentParsed = parseToType(setting.value, setting.type);
    if (body.value === currentParsed) {
      return NextResponse.json(
        { error: 'Keine Änderung — Wert ist bereits aktuell', setting },
        { status: 409 }
      );
    }

    const validationError = validate(body.value, setting);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    const newValue = coerce(body.value, setting.type);

    const { error: updErr } = await sb
      .from('system_settings')
      .update({
        value: newValue,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq('id', setting.id);

    if (updErr) {
      log.error('Update setting failed', updErr);
      return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
    }

    await logAudit({
      actorId: auth.user.id,
      action: 'update',
      resourceType: 'system_settings',
      resourceId: setting.id,
      // Plattformweite Einstellung — bewusst ohne club_id (nur Owner-sichtbar).
      clubId: null,
      details: {
        kind: 'system_setting_update',
        setting_key: key,
        value_was: setting.value,
        value_now: newValue,
      },
      request,
    });

    log.info('System setting updated by owner', { actor: auth.user.id, key });

    return NextResponse.json({
      success: true,
      key,
      value: newValue,
      setting: { ...setting, value: newValue },
    });
  });
}
