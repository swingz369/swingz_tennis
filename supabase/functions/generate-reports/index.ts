import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString();
    const nowStr = now.toISOString();

    // Get all active clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('status', 'active');

    if (clubsError) {
      console.error('[GenerateReports] clubs error:', clubsError);
      return new Response(JSON.stringify({ error: clubsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clubs || clubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active clubs found', reports: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reports = [];

    for (const club of clubs) {
      try {
        // Count new members this week
        const { count: newMembers } = await supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'member')
          .gte('created_at', weekAgoStr);

        // Count total active members
        const { count: totalMembers } = await supabase
          .from('user_club_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('role', 'member')
          .eq('is_active', true);

        // Count sessions this week
        const { count: totalSessions } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .gte('created_at', weekAgoStr);

        // Count open invoices
        const { count: openInvoices } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .in('status', ['open', 'sent', 'overdue']);

        // Sum overdue invoice amounts
        const { data: overdueData } = await supabase
          .from('invoices')
          .select('amount')
          .eq('club_id', club.id)
          .eq('status', 'overdue');

        const overdueTotal = (overdueData ?? []).reduce(
          (sum: number, inv: { amount: number }) => sum + Number(inv.amount),
          0
        );

        // Count trial training requests this week
        const { count: trialRequests } = await supabase
          .from('trial_trainings')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .gte('created_at', weekAgoStr);

        // Count pending approvals
        const { count: pendingApprovals } = await supabase
          .from('trial_trainings')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .eq('status', 'requested');

        // Count RSVPs this week
        const { count: rsvps } = await supabase
          .from('session_rsvps')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id)
          .gte('created_at', weekAgoStr);

        reports.push({
          club_id: club.id,
          club_name: club.name,
          period: { from: weekAgoStr.slice(0, 10), to: nowStr.slice(0, 10) },
          members: {
            total: totalMembers ?? 0,
            new_this_week: newMembers ?? 0,
          },
          sessions: {
            total_this_week: totalSessions ?? 0,
          },
          rsvps: {
            this_week: rsvps ?? 0,
          },
          trial_training: {
            requests_this_week: trialRequests ?? 0,
            pending_approval: pendingApprovals ?? 0,
          },
          billing: {
            open_invoices: openInvoices ?? 0,
            overdue_total_eur: overdueTotal,
          },
        });
      } catch (error) {
        console.error(`[GenerateReports] Error for club ${club.id}:`, error);
        reports.push({ club_id: club.id, club_name: club.name, error: (error as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: nowStr,
        clubs_processed: clubs.length,
        reports,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GenerateReports] Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
