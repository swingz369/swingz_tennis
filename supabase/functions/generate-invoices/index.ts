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

    const body = await req.json().catch(() => ({}));
    const requestedMonth: string | undefined = body.month;

    // Determine billing month (defaults to current month)
    const monthStr = requestedMonth ?? new Date().toISOString().slice(0, 7); // YYYY-MM
    const [yearStr, monStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: 'Invalid month format. Use YYYY-MM' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Last day of the month
    const dueDate = new Date(year, month, 0);
    const dueDateStr = dueDate.toISOString().slice(0, 10);
    const monthStart = `${yearStr}-${monStr}-01`;
    const monthEnd = dueDateStr;
    const monthLabel = new Date(year, month - 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });

    // Get all active clubs (or a specific one from body)
    let clubsQuery = supabase.from('clubs').select('id, name').eq('status', 'active');
    if (body.clubId) {
      clubsQuery = clubsQuery.eq('id', body.clubId);
    }
    const { data: clubs, error: clubsError } = await clubsQuery;

    if (clubsError) {
      console.error('[GenerateInvoices] clubs error:', clubsError);
      return new Response(JSON.stringify({ error: clubsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clubs || clubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active clubs found', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const club of clubs) {
      try {
        // 1. Get active members
        const { data: memberships, error: membershipsError } = await supabase
          .from('user_club_memberships')
          .select('id, user_id, club_id')
          .eq('club_id', club.id)
          .eq('role', 'member')
          .eq('is_active', true);

        if (membershipsError) throw membershipsError;
        if (!memberships || memberships.length === 0) {
          results.push({
            club_id: club.id,
            club_name: club.name,
            created: 0,
            skipped: 0,
            message: 'No active members',
          });
          continue;
        }

        // 2. Get fee configuration
        const { data: feeConfig } = await supabase
          .from('fee_configurations')
          .select('id, amount, currency, name')
          .eq('club_id', club.id)
          .eq('type', 'membership')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const feeAmount = feeConfig ? Number(feeConfig.amount) : 0;
        const feeCurrency = feeConfig?.currency ?? 'EUR';

        if (feeAmount === 0) {
          results.push({
            club_id: club.id,
            club_name: club.name,
            created: 0,
            skipped: memberships.length,
            message: 'No fee configured',
          });
          totalSkipped += memberships.length;
          continue;
        }

        // 3. Get existing invoices for this month
        const { data: existingInvoices } = await supabase
          .from('invoices')
          .select('member_id')
          .eq('club_id', club.id)
          .eq('invoice_type', 'membership')
          .gte('due_date', monthStart)
          .lte('due_date', monthEnd);

        const alreadyBilled = new Set(
          (existingInvoices ?? [])
            .map((inv: { member_id: string | null }) => inv.member_id)
            .filter(Boolean)
        );

        // 4. Get current invoice count for auto-numbering
        const { count: invoiceCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', club.id);

        const baseCount = invoiceCount ?? 0;

        // 5. Get club tax rate
        const { data: clubData } = await supabase
          .from('clubs')
          .select('tax_rate')
          .eq('id', club.id)
          .maybeSingle();
        const taxRate = (clubData as Record<string, unknown>)?.tax_rate ?? 0;

        // 6. Create invoices
        let created = 0;
        let skipped = 0;
        const toInsert = [];

        for (const membership of memberships) {
          if (alreadyBilled.has(membership.user_id)) {
            skipped++;
            continue;
          }

          const seqNum = baseCount + created + 1;
          const invoiceNumber = `INV-${year}-${monStr}-${String(seqNum).padStart(4, '0')}`;
          const memberTaxAmount = feeAmount * (Number(taxRate) / 100);

          toInsert.push({
            club_id: club.id,
            member_id: membership.user_id,
            invoice_number: invoiceNumber,
            invoice_type: 'membership',
            amount: feeAmount + memberTaxAmount,
            tax_amount: memberTaxAmount,
            currency: feeCurrency,
            status: 'open',
            due_date: dueDateStr,
            notes: `Mitgliedsbeitrag ${monthStr}`,
          });
          created++;
        }

        if (toInsert.length > 0) {
          const { data: insertedInvoices, error: insertError } = await supabase
            .from('invoices')
            .insert(toInsert)
            .select('id');

          if (insertError) throw insertError;

          // Create line items
          if (insertedInvoices && feeAmount > 0) {
            const lineItems = insertedInvoices.map((inv: { id: string }) => ({
              invoice_id: inv.id,
              description: feeConfig
                ? `${feeConfig.name} — ${monthStr}`
                : `Mitgliedsbeitrag ${monthStr}`,
              quantity: 1,
              unit_price: feeAmount,
              item_type: 'membership_fee',
            }));

            const { error: itemsError } = await supabase.from('invoice_items').insert(lineItems);
            if (itemsError)
              console.error('[GenerateInvoices] line items insert error:', itemsError);
          }
        }

        totalCreated += created;
        totalSkipped += skipped;

        results.push({
          club_id: club.id,
          club_name: club.name,
          created,
          skipped,
          message: `${created} Rechnung(en) erstellt, ${skipped} übersprungen`,
        });
      } catch (error) {
        console.error(`[GenerateInvoices] Error for club ${club.id}:`, error);
        results.push({ club_id: club.id, club_name: club.name, error: (error as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        month: monthStr,
        monthLabel,
        totalCreated,
        totalSkipped,
        clubsProcessed: clubs.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GenerateInvoices] Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
