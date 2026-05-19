import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/external/supabase/server'
import { getActiveStep, WIZARD_STEPS } from './wizard-steps'

export default async function WizardIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: season } = await supabase
    .from('seasons').select('planning_status').eq('id', id).single()
  const step = WIZARD_STEPS[getActiveStep(season?.planning_status ?? 'draft')]
  redirect(`/admin/seasons/${id}/wizard/${step.href}`)
}
