import { createServiceClient } from '@/lib/supabase/service';
import { OwnerAuditClient } from './audit-client';
import { AuditStatStrip } from './_components/audit-stat-strip';
import { PageHeader } from '@/components/ui/page-header';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/**
 * Plattformweiter Audit-Log — Server Component.
 *
 * Lädt nur die Stammdaten für die Filter-Dropdowns (Vereinsliste, vordefinierte
 * Action-Listen). Die eigentliche Audit-Log-Query passiert client-side
 * gefiltert & paginiert via /api/owner/audit-logs.
 *
 * Phase 3: Reihenfolge geändert — Stat-Strip + Schnellstart-Tipps vor der
 * Filter-Sidebar, damit Erstbesucher sofort verstehen, was die Seite kann.
 * (Bisheriger Audit-Stat-Strip rendert statisch, kommt ohne Live-Data — siehe
 * Komponente für Begründung.)
 */
export default async function OwnerAuditLogPage() {
  const sb = createServiceClient();

  // Clubs für das Club-Dropdown (alle Status — Owner darf auch gelöschte sehen)
  const { data: clubs } = await sb
    .from('clubs')
    .select('id, name, status')
    .order('name', { ascending: true });

  const clubOptions = (clubs ?? []).map((c: { id: string; name: string; status: string }) => ({
    id: c.id,
    name: c.name,
    status: c.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Plattform-Audit-Log"
          description="Alle sicherheits- und datenrelevanten Aktionen über alle Vereine hinweg"
        />
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-info-300 text-info-700 dark:border-info-700 dark:text-info-300 shrink-0"
        >
          <Shield className="h-3 w-3" /> Owner-only
        </Badge>
      </div>

      <AuditStatStrip />

      <OwnerAuditClient clubOptions={clubOptions} />
    </div>
  );
}
