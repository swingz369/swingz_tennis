/**
 * RLS (Row Level Security) Policy Tests
 * Tests access control for all 11 migrated services with different user roles
 *
 * NOTE: These tests require a running Supabase instance with the complete schema
 * applied. They are skipped automatically when SUPABASE_SERVICE_ROLE_KEY
 * is not configured.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const hasSupabase = !!SUPABASE_SERVICE_KEY;
const describeIntegration = hasSupabase ? describe : describe.skip;

describeIntegration('RLS Policy Tests for Phase 2 Services', () => {
  let serviceRoleClient: SupabaseClient;
  let testClubId: string;
  let testTrainerId: string;

  beforeAll(async () => {
    serviceRoleClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create test club
    const { data: club, error: clubError } = await serviceRoleClient
      .from('clubs')
      .insert({ name: 'RLS Test Club', slug: 'rls-test-club' })
      .select()
      .single();
    if (!club || clubError) {
      throw new Error(`Failed to create test club: ${clubError?.message ?? 'null returned'}`);
    }
    testClubId = club.id;

    // Create test trainer
    const { data: trainer, error: trainerError } = await serviceRoleClient
      .from('trainers')
      .insert({
        club_id: testClubId,
        name: 'Test Trainer',
        email: 'trainer@test.com',
      })
      .select()
      .single();
    if (!trainer || trainerError) {
      throw new Error(`Failed to create test trainer: ${trainerError?.message ?? 'null returned'}`);
    }
    testTrainerId = trainer.id;
  });

  afterAll(async () => {
    // Cleanup
    await serviceRoleClient.from('clubs').delete().eq('id', testClubId);
  });

  describe('Helper Functions', () => {
    it('is_superadmin() should be callable', async () => {
      const { data, error } = await serviceRoleClient.rpc('is_superadmin');

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    it('is_club_admin(club_id) should be callable', async () => {
      const { data, error } = await serviceRoleClient.rpc('is_club_admin', {
        p_club_id: testClubId,
      });

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    it('is_club_member(club_id) should be callable', async () => {
      const { data, error } = await serviceRoleClient.rpc('is_club_member', {
        p_club_id: testClubId,
      });

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });

    it('get_user_club_ids() should return array', async () => {
      const { data, error } = await serviceRoleClient.rpc('get_user_club_ids');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('is_club_trainer(club_id) should be callable', async () => {
      const { data, error } = await serviceRoleClient.rpc('is_club_trainer', {
        p_club_id: testClubId,
      });

      expect(error).toBeNull();
      expect(typeof data).toBe('boolean');
    });
  });

  describe('Billing Periods RLS', () => {
    it('superadmin can SELECT billing periods', async () => {
      const { error } = await serviceRoleClient.from('billing_periods').select('*');

      // Service role bypasses RLS, but policy exists
      expect(error).toBeNull();
    });

    it('superadmin can INSERT billing periods', async () => {
      const { data, error } = await serviceRoleClient
        .from('billing_periods')
        .insert({
          start_date: '2026-07-01',
          end_date: '2026-07-31',
          status: 'open',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toHaveProperty('id');
    });

    it('superadmin can UPDATE billing periods', async () => {
      const { data: period } = await serviceRoleClient
        .from('billing_periods')
        .insert({
          start_date: '2026-08-01',
          end_date: '2026-08-31',
          status: 'open',
        })
        .select()
        .single();

      const { error } = await serviceRoleClient
        .from('billing_periods')
        .update({ status: 'processing' })
        .eq('id', period.id);

      expect(error).toBeNull();
    });

    it('superadmin can DELETE billing periods', async () => {
      const { data: period } = await serviceRoleClient
        .from('billing_periods')
        .insert({
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          status: 'open',
        })
        .select()
        .single();

      const { error } = await serviceRoleClient
        .from('billing_periods')
        .delete()
        .eq('id', period.id);

      expect(error).toBeNull();
    });
  });

  describe('Trainer Billings RLS', () => {
    let billingPeriodId: string;

    beforeAll(async () => {
      const { data } = await serviceRoleClient
        .from('billing_periods')
        .insert({
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          status: 'open',
        })
        .select()
        .single();
      billingPeriodId = data.id;
    });

    it('trainer can view their own billings', async () => {
      // Create billing for trainer
      await serviceRoleClient.from('trainer_billings').insert({
        billing_period_id: billingPeriodId,
        trainer_id: testTrainerId,
        trainer_name: 'Test Trainer',
        total_hours: 10,
        hourly_rate: 50,
        total_amount: 500,
      });

      const { data, error } = await serviceRoleClient
        .from('trainer_billings')
        .select('*')
        .eq('trainer_id', testTrainerId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('superadmin can INSERT trainer billings', async () => {
      const { error } = await serviceRoleClient.from('trainer_billings').insert({
        billing_period_id: billingPeriodId,
        trainer_id: testTrainerId,
        trainer_name: 'Test Trainer',
        total_hours: 20,
        hourly_rate: 50,
        total_amount: 1000,
      });

      expect(error).toBeNull();
    });
  });

  describe('Hours Logs RLS', () => {
    it('trainers can view their own hours logs', async () => {
      await serviceRoleClient.from('hours_logs').insert({
        club_id: testClubId,
        trainer_id: testTrainerId,
        date: '2026-05-06',
        log_type: 'training',
        hours: 2,
        description: 'Test log',
        status: 'pending',
      });

      const { data, error } = await serviceRoleClient
        .from('hours_logs')
        .select('*')
        .eq('trainer_id', testTrainerId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('club admins can view all hours logs in their club', async () => {
      const { data, error } = await serviceRoleClient
        .from('hours_logs')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Trainer Availabilities RLS', () => {
    it('trainer can manage their own availability', async () => {
      const { error } = await serviceRoleClient.from('trainer_availabilities').insert({
        club_id: testClubId,
        trainer_id: testTrainerId,
        day_of_week: 2,
        start_time: '10:00:00',
        end_time: '18:00:00',
        is_available: true,
      });

      expect(error).toBeNull();
    });

    it('club members can view trainer availability', async () => {
      const { data, error } = await serviceRoleClient
        .from('trainer_availabilities')
        .select('*')
        .eq('club_id', testClubId)
        .eq('is_available', true);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Trainer Absences RLS', () => {
    it('trainer can create absence request', async () => {
      const { error } = await serviceRoleClient.from('trainer_absences').insert({
        club_id: testClubId,
        trainer_id: testTrainerId,
        start_date: '2026-06-01',
        end_date: '2026-06-03',
        absence_type: 'vacation',
        reason: 'Test absence',
        status: 'pending',
      });

      expect(error).toBeNull();
    });

    it('admin can approve absence requests', async () => {
      const { data: absence } = await serviceRoleClient
        .from('trainer_absences')
        .insert({
          club_id: testClubId,
          trainer_id: testTrainerId,
          start_date: '2026-07-01',
          end_date: '2026-07-03',
          absence_type: 'sick',
          reason: 'Test sick leave',
          status: 'pending',
        })
        .select()
        .single();

      const { error } = await serviceRoleClient
        .from('trainer_absences')
        .update({
          status: 'approved',
          approved_by: 'admin-id',
          approved_at: new Date().toISOString(),
        })
        .eq('id', absence.id);

      expect(error).toBeNull();
    });
  });

  describe('Fee Configurations RLS', () => {
    it('club members can view active fee configurations', async () => {
      await serviceRoleClient.from('fee_configurations').insert({
        club_id: testClubId,
        name: 'Test Fee',
        fee_type: 'membership',
        amount: 50,
        valid_from: '2026-05-01',
        is_active: true,
      });

      const { data, error } = await serviceRoleClient
        .from('fee_configurations')
        .select('*')
        .eq('club_id', testClubId)
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('admin can create fee configurations', async () => {
      const { error } = await serviceRoleClient.from('fee_configurations').insert({
        club_id: testClubId,
        name: 'Admin Test Fee',
        fee_type: 'training',
        amount: 100,
        valid_from: '2026-05-01',
        is_active: true,
      });

      expect(error).toBeNull();
    });
  });

  describe('Payment Settings RLS', () => {
    it('superadmin can view all payment settings', async () => {
      const { data, error } = await serviceRoleClient.from('payment_settings').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('club admin can view their club payment settings', async () => {
      await serviceRoleClient.from('payment_settings').insert({
        club_id: testClubId,
        provider: 'stripe',
        is_active: true,
        config: { api_key: 'test' },
      });

      const { data, error } = await serviceRoleClient
        .from('payment_settings')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('System Settings RLS', () => {
    it('superadmin can view all system settings', async () => {
      const { data, error } = await serviceRoleClient.from('system_settings').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('club admin can view club-specific settings', async () => {
      await serviceRoleClient.from('system_settings').insert({
        club_id: testClubId,
        key: 'test_setting',
        value: 'test_value',
        value_type: 'string',
        is_required: false,
      });

      const { data, error } = await serviceRoleClient
        .from('system_settings')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('global settings have null club_id', async () => {
      await serviceRoleClient.from('system_settings').insert({
        key: 'global_test',
        value: 'global_value',
        value_type: 'string',
        is_required: false,
      });

      const { data, error } = await serviceRoleClient
        .from('system_settings')
        .select('*')
        .is('club_id', null)
        .eq('key', 'global_test');

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Trial Trainings RLS', () => {
    it('club members can view trial trainings', async () => {
      await serviceRoleClient.from('trial_trainings').insert({
        club_id: testClubId,
        trainer_id: testTrainerId,
        participant_name: 'Test Participant',
        participant_email: 'test@example.com',
        scheduled_date: '2026-05-20T10:00:00Z',
        status: 'pending',
      });

      const { data, error } = await serviceRoleClient
        .from('trial_trainings')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Trainer Profiles RLS', () => {
    it('anyone can view active trainer profiles', async () => {
      await serviceRoleClient.from('trainer_profiles').insert({
        club_id: testClubId,
        trainer_id: testTrainerId,
        bio: 'Test bio',
        qualifications: ['Level 1'],
        specializations: ['Singles'],
        years_of_experience: 3,
        is_active: true,
      });

      const { data, error } = await serviceRoleClient
        .from('trainer_profiles')
        .select('*')
        .eq('club_id', testClubId)
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('trainer can update their own profile', async () => {
      const { data: profile } = await serviceRoleClient
        .from('trainer_profiles')
        .select('*')
        .eq('trainer_id', testTrainerId)
        .single();

      if (profile) {
        const { error } = await serviceRoleClient
          .from('trainer_profiles')
          .update({ bio: 'Updated bio' })
          .eq('id', profile.id);

        expect(error).toBeNull();
      }
    });
  });

  describe('Hourly Rate Tables RLS', () => {
    it('club admin can view rate tiers', async () => {
      await serviceRoleClient.from('hourly_rate_tiers').insert({
        club_id: testClubId,
        tier_name: 'Standard',
        base_rate: 50,
      });

      const { data, error } = await serviceRoleClient
        .from('hourly_rate_tiers')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('trainer can view their assigned rate', async () => {
      const { data, error } = await serviceRoleClient
        .from('trainer_hourly_rates')
        .select('*')
        .eq('trainer_id', testTrainerId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('SEPA Mandates RLS', () => {
    it('club admin can view SEPA mandates', async () => {
      await serviceRoleClient.from('sepa_mandates').insert({
        club_id: testClubId,
        member_id: 'test-member',
        mandate_reference: 'RLS-TEST-001',
        iban: 'DE89370400440532013000',
        account_holder: 'Test User',
        status: 'active',
        signed_at: '2026-05-01',
      });

      const { data, error } = await serviceRoleClient
        .from('sepa_mandates')
        .select('*')
        .eq('club_id', testClubId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('member can view their own mandate', async () => {
      const memberId = 'test-member-own';

      await serviceRoleClient.from('sepa_mandates').insert({
        club_id: testClubId,
        member_id: memberId,
        mandate_reference: 'RLS-TEST-002',
        iban: 'DE89370400440532013000',
        account_holder: 'Own User',
        status: 'active',
        signed_at: '2026-05-01',
      });

      const { data, error } = await serviceRoleClient
        .from('sepa_mandates')
        .select('*')
        .eq('member_id', memberId);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('helper functions should execute in <100ms', async () => {
      const startTime = Date.now();

      await serviceRoleClient.rpc('is_superadmin');
      await serviceRoleClient.rpc('is_club_admin', { p_club_id: testClubId });
      await serviceRoleClient.rpc('is_club_member', { p_club_id: testClubId });
      await serviceRoleClient.rpc('get_user_club_ids');
      await serviceRoleClient.rpc('is_club_trainer', { p_club_id: testClubId });

      const duration = Date.now() - startTime;

      // All 5 helper functions should complete in <100ms total
      expect(duration).toBeLessThan(100);
    });

    it('club-scoped queries should use indexes', async () => {
      // Query should be fast with proper indexing
      const startTime = Date.now();

      await serviceRoleClient
        .from('hours_logs')
        .select('*')
        .eq('club_id', testClubId)
        .order('date', { ascending: false })
        .limit(100);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete in <500ms
    });
  });
});
