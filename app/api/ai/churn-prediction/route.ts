import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import type { Database } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:ai:churn-prediction');

type AttendanceRow = Database['public']['Tables']['attendance_records']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

interface MemberWithUser {
  user_id: string;
  users: { full_name?: string | null; email?: string | null } | null;
  created_at: string | null;
}

interface AtRiskMember {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  reasons: string[];
  riskLevel: 'high' | 'medium' | 'low';
  trends?: {
    attendanceDecline: boolean;
    bookingDecline: boolean;
    hasOverdueInvoices: boolean;
  };
}

/**
 * KI Churn Prediction API v2
 * Batch-optimierte Version ohne N+1 Queries
 * Identifiziert gefährdete Mitglieder basierend auf:
 *   - Anwesenheit (30 Tage)
 *   - Buchungsaktivität (Rückgang >50%)
 *   - Überfällige Rechnungen
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    if (!auth.clubId) {
      return NextResponse.json({ atRisk: [], churnRiskRate: 0, totalMembers: 0 });
    }

    try {
      const supabase = auth.supabase;
      const clubId = auth.clubId;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // ── 1. Alle aktiven Mitglieder abrufen (ein Query) ──
      const { data: members, error: membersError } = (await supabase
        .from('user_club_memberships')
        .select('user_id, users!inner(full_name, email), created_at')
        .eq('club_id', clubId)
        .eq('is_active', true)) as { data: MemberWithUser[] | null; error: unknown };

      if (membersError || !members || members.length === 0) {
        return NextResponse.json({ atRisk: [], churnRiskRate: 0, totalMembers: 0, trends: [] });
      }

      const memberIds = members.map((m) => m.user_id);

      // ── 2. Batch: Attendance Records (ein Query) ──
      const { data: attendanceRecords } = (await supabase
        .from('attendance_records')
        .select('participant_id')
        .in('participant_id', memberIds)
        .gte('created_at', thirtyDaysAgo.toISOString())) as {
        data: Pick<AttendanceRow, 'participant_id'>[] | null;
      };

      const attendanceCount = new Map<string, number>();
      for (const record of attendanceRecords ?? []) {
        attendanceCount.set(
          record.participant_id,
          (attendanceCount.get(record.participant_id) ?? 0) + 1
        );
      }

      // ── 3. Batch: Bookings – letzte 30 Tage ──
      const { data: recentBookings } = (await supabase
        .from('bookings')
        .select('member_id, booked_at')
        .in('member_id', memberIds)
        .gte('booked_at', thirtyDaysAgo.toISOString())) as {
        data: Pick<BookingRow, 'member_id' | 'booked_at'>[] | null;
      };

      const recentBookingCount = new Map<string, number>();
      for (const booking of recentBookings ?? []) {
        recentBookingCount.set(
          booking.member_id,
          (recentBookingCount.get(booking.member_id) ?? 0) + 1
        );
      }

      // ── 4. Batch: Bookings – 30-60 Tage zurück (für Decline-Vergleich) ──
      const { data: olderBookings } = (await supabase
        .from('bookings')
        .select('member_id')
        .in('member_id', memberIds)
        .lt('booked_at', thirtyDaysAgo.toISOString())
        .gte('booked_at', sixtyDaysAgo.toISOString())) as {
        data: Pick<BookingRow, 'member_id'>[] | null;
      };

      const olderBookingCount = new Map<string, number>();
      for (const booking of olderBookings ?? []) {
        olderBookingCount.set(
          booking.member_id,
          (olderBookingCount.get(booking.member_id) ?? 0) + 1
        );
      }

      // ── 5. Batch: Überfällige Rechnungen ──
      const { data: overdueInvoices } = (await supabase
        .from('invoices')
        .select('member_id')
        .in('member_id', memberIds)
        .eq('status', 'open')
        .lt('due_date', now.toISOString())) as { data: Pick<InvoiceRow, 'member_id'>[] | null };

      const overdueSet = new Set(overdueInvoices?.map((inv) => inv.member_id) ?? []);

      // ── 6. Risiko-Scores berechnen (in memory, keine DB-Calls mehr) ──
      const atRisk: AtRiskMember[] = [];

      for (const m of members) {
        let riskScore = 0;
        const reasons: string[] = [];
        const userId = m.user_id;

        const hasRecentAttendance = (attendanceCount.get(userId) ?? 0) > 0;
        if (!hasRecentAttendance) {
          riskScore += 40;
          reasons.push('Keine Anwesenheit in den letzten 30 Tagen');
        }

        const recentB = recentBookingCount.get(userId) ?? 0;
        const olderB = olderBookingCount.get(userId) ?? 0;
        const bookingDecline = olderB > 0 && recentB < olderB * 0.5;
        if (bookingDecline) {
          riskScore += 25;
          reasons.push('Buchungsaktivität stark rückläufig');
        } else if (olderB === 0 && recentB === 0) {
          riskScore += 10;
          reasons.push('Keine Buchungshistorie in den letzten 60 Tagen');
        }

        const hasOverdueInvoices = overdueSet.has(userId);
        if (hasOverdueInvoices) {
          riskScore += 35;
          reasons.push('Überfällige Rechnungen');
        }

        if (riskScore >= 50) {
          atRisk.push({
            userId,
            name: m.users?.full_name || 'Unbekannt',
            email: m.users?.email || '',
            riskScore,
            reasons,
            riskLevel: riskScore >= 70 ? 'high' : 'medium',
            trends: {
              attendanceDecline: !hasRecentAttendance,
              bookingDecline,
              hasOverdueInvoices,
            },
          });
        }
      }

      // Sortieren – höchstes Risiko zuerst
      atRisk.sort((a, b) => b.riskScore - a.riskScore);

      return NextResponse.json({
        atRisk: atRisk.slice(0, 20),
        churnRiskRate: Math.round((atRisk.length / members.length) * 100),
        totalMembers: members.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Churn prediction error:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
