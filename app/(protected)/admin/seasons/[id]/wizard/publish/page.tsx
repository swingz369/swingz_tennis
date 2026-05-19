import { notFound } from 'next/navigation'
import { createClient } from '@/infrastructure/external/supabase/server'
import { PublishButton } from './publish-button'

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: season } = await (supabase as any)
    .from('seasons')
    .select('id, name, planning_status, club_id')
    .eq('id', id)
    .single()
  if (!season) notFound()

  const alreadyPublished =
    season.planning_status === 'published' ||
    season.planning_status === 'active' ||
    season.planning_status === 'completed' ||
    season.planning_status === 'archived'

  const [
    { count: groupsCount },
    { count: planEntriesCount },
    { count: invoicesCount },
    { count: waitlistCount },
    { count: noTrainerCount },
  ] = await Promise.all([
    (supabase as any)
      .from('training_groups')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', id),
    (supabase as any)
      .from('season_plan_entries')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', id),
    (supabase as any)
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', id),
    (supabase as any)
      .from('season_waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', id),
    (supabase as any)
      .from('season_plan_entries')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', id)
      .is('trainer_id', null),
  ])

  const warnings: string[] = []
  if ((noTrainerCount ?? 0) > 0) {
    warnings.push(`${noTrainerCount} Trainingsgruppe(n) ohne Trainer.`)
  }
  if ((invoicesCount ?? 0) === 0) {
    warnings.push('Noch keine Rechnungen generiert.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Veröffentlichen</h1>
        <p className="text-muted-foreground">Überprüfe die Zusammenfassung und veröffentliche die Saison.</p>
      </div>

      <div className="rounded-lg border p-6 space-y-3">
        <h2 className="font-semibold text-lg">{season.name}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Gruppen</span>
          <span className="font-medium">{groupsCount ?? 0}</span>
          <span className="text-muted-foreground">Planeinträge</span>
          <span className="font-medium">{planEntriesCount ?? 0}</span>
          <span className="text-muted-foreground">Rechnungen</span>
          <span className="font-medium">{invoicesCount ?? 0}</span>
          <span className="text-muted-foreground">Warteliste</span>
          <span className="font-medium">{waitlistCount ?? 0}</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-1">
          <p className="font-semibold text-yellow-800">Warnungen</p>
          {warnings.map((w) => (
            <p key={w} className="text-sm text-yellow-700">• {w}</p>
          ))}
        </div>
      )}

      {alreadyPublished ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="font-semibold text-green-800">Saison bereits veröffentlicht</p>
          <p className="text-sm text-green-700 mt-1">
            Status: <span className="font-medium">{season.planning_status}</span>
          </p>
        </div>
      ) : (
        <PublishButton seasonId={id} />
      )}
    </div>
  )
}
