/**
 * Enhanced Audit Service - Comprehensive logging for all critical operations
 * Extends existing audit infrastructure with additional event types
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuditLogEntry {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * Enhanced Audit Logger with additional event types
 */
export class EnhancedAuditService {
  /**
   * Log member update
   */
  static async logMemberUpdate(
    actorId: string,
    memberId: string,
    changes: Record<string, { from: any; to: any }>,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'member_updated',
      resource_type: 'member',
      resource_id: memberId,
      details: { changes },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log session creation
   */
  static async logSessionCreated(
    actorId: string,
    sessionId: string,
    data: Record<string, any>,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'session_created',
      resource_type: 'session',
      resource_id: sessionId,
      details: data,
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log session update
   */
  static async logSessionUpdated(
    actorId: string,
    sessionId: string,
    changes: Record<string, { from: any; to: any }>,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'session_updated',
      resource_type: 'session',
      resource_id: sessionId,
      details: { changes },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log session deletion
   */
  static async logSessionDeleted(
    actorId: string,
    sessionId: string,
    reason?: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'session_deleted',
      resource_type: 'session',
      resource_id: sessionId,
      details: { reason },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log booking cancellation
   */
  static async logBookingCancelled(
    actorId: string,
    bookingId: string,
    reason: string,
    policy: { refundPercentage: number; cancellationFee: number },
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'booking_cancelled',
      resource_type: 'booking',
      resource_id: bookingId,
      details: {
        reason,
        refund_percentage: policy.refundPercentage,
        cancellation_fee: policy.cancellationFee,
      },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log payment status change
   */
  static async logPaymentStatusChanged(
    actorId: string,
    paymentId: string,
    oldStatus: string,
    newStatus: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'payment_status_changed',
      resource_type: 'payment',
      resource_id: paymentId,
      details: {
        old_status: oldStatus,
        new_status: newStatus,
      },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log settings change
   */
  static async logSettingsChanged(
    actorId: string,
    settingKey: string,
    changes: Record<string, { from: any; to: any }>,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'settings_changed',
      resource_type: 'settings',
      resource_id: settingKey,
      details: { changes },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log invoice creation
   */
  static async logInvoiceCreated(
    actorId: string,
    invoiceId: string,
    data: { memberId: string; totalAmount: number; items: number },
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'invoice_created',
      resource_type: 'invoice',
      resource_id: invoiceId,
      details: data,
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log SEPA mandate signing
   */
  static async logSepaMandateSigned(
    actorId: string,
    mandateId: string,
    iban: string,
    request?: Request
  ): Promise<void> {
    await this.log({
      user_id: actorId,
      action: 'sepa_mandate_signed',
      resource_type: 'sepa_mandate',
      resource_id: mandateId,
      details: {
        iban_last4: iban.slice(-4), // Only store last 4 digits for privacy
      },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(email: string, reason: string, request?: Request): Promise<void> {
    await this.log({
      user_id: 'system', // No user ID for failed login
      action: 'login_failed',
      resource_type: 'auth',
      resource_id: email,
      details: { reason },
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Log successful login
   */
  static async logSuccessfulLogin(userId: string, request?: Request): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'login_successful',
      resource_type: 'auth',
      resource_id: userId,
      details: {},
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
      user_agent: request?.headers.get('user-agent'),
    });
  }

  /**
   * Core logging function
   */
  private static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        ...entry,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to write audit log:', error);
        // Don't throw - audit failures shouldn't break the main operation
      }
    } catch (error) {
      console.error('Unexpected error in audit logging:', error);
    }
  }

  /**
   * Query audit logs for a specific resource
   */
  static async getResourceHistory(
    resourceType: string,
    resourceId: string,
    limit: number = 50
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Query audit logs for a specific user
   */
  static async getUserActivity(userId: string, limit: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch user activity:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Query recent audit logs with filters
   */
  static async getRecentLogs(filters?: {
    action?: string;
    resourceType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    let query = supabase.from('audit_logs').select('*');

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query.order('created_at', { ascending: false });
    query = query.limit(filters?.limit || 100);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return data || [];
  }
}
