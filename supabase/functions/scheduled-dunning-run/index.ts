import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BillingEngine } from '../lib/billing-engine.ts';

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

    const billingEngine = new BillingEngine(supabase);

    const { data: clubs } = await supabase.from('clubs').select('id').eq('status', 'active');

    if (!clubs || clubs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active clubs found',
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let totalProcessed = 0;
    const results = [];

    for (const club of clubs) {
      try {
        const dunningRecords = await billingEngine.processAutomaticDunning(club.id);
        totalProcessed += dunningRecords.length;
        results.push({
          club_id: club.id,
          processed: dunningRecords.length,
        });
      } catch (error) {
        console.error(`Error processing dunning for club ${club.id}:`, error);
        results.push({
          club_id: club.id,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed dunning for ${clubs.length} clubs`,
        total_processed: totalProcessed,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in scheduled dunning run:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
