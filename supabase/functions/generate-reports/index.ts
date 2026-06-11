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

    // Single RPC call — all aggregation happens server-side via LATERAL joins
    const { data: rows, error: rpcError } = await supabase.rpc('generate_weekly_club_reports', {
      week_ago: weekAgoStr,
    });

    if (rpcError) {
      console.error('[GenerateReports] RPC error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reports = (rows ?? []).map((row: Record<string, unknown>) => ({
      club_id: row.club_id,
      club_name: row.club_name,
      period: { from: weekAgoStr.slice(0, 10), to: nowStr.slice(0, 10) },
      members: {
        total: Number(row.total_members),
        new_this_week: Number(row.new_members_week),
      },
      sessions: {
        total_this_week: Number(row.sessions_week),
      },
      rsvps: {
        this_week: Number(row.rsvps_week),
      },
      trial_training: {
        requests_this_week: Number(row.trial_requests_week),
        pending_approval: Number(row.pending_approvals),
      },
      billing: {
        open_invoices: Number(row.open_invoices),
        overdue_total_eur: Number(row.overdue_total),
      },
    }));

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: nowStr,
        clubs_processed: reports.length,
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
