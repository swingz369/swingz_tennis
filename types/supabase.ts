export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in_time: string | null;
          check_out_time: string | null;
          created_at: string;
          date: string;
          dispute_reason: string | null;
          dispute_resolved_at: string | null;
          dispute_resolved_by: string | null;
          duration_minutes: number | null;
          id: string;
          member_confirmed_at: string | null;
          member_status: string;
          notes: string | null;
          participant_id: string;
          participant_name: string;
          session_id: string;
          status: string;
          trainer_confirmed: boolean;
          trainer_confirmed_at: string | null;
          trainer_id: string;
          trainer_name: string;
          updated_at: string;
        };
        Insert: {
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date: string;
          dispute_reason?: string | null;
          dispute_resolved_at?: string | null;
          dispute_resolved_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          member_confirmed_at?: string | null;
          member_status?: string;
          notes?: string | null;
          participant_id: string;
          participant_name: string;
          session_id: string;
          status: string;
          trainer_confirmed?: boolean;
          trainer_confirmed_at?: string | null;
          trainer_id: string;
          trainer_name: string;
          updated_at?: string;
        };
        Update: {
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date?: string;
          dispute_reason?: string | null;
          dispute_resolved_at?: string | null;
          dispute_resolved_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          member_confirmed_at?: string | null;
          member_status?: string;
          notes?: string | null;
          participant_id?: string;
          participant_name?: string;
          session_id?: string;
          status?: string;
          trainer_confirmed?: boolean;
          trainer_confirmed_at?: string | null;
          trainer_id?: string;
          trainer_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_records_dispute_resolved_by_fkey';
            columns: ['dispute_resolved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          club_id: string | null;
          created_at: string;
          details: Json | null;
          id: string;
          ip_address: string | null;
          metadata: Json | null;
          resource_id: string;
          resource_type: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          club_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          resource_id: string;
          resource_type: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          club_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          resource_id?: string;
          resource_type?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      background_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          error_message: string | null;
          id: string;
          job_name: string;
          job_type: string;
          max_retries: number | null;
          payload: Json | null;
          priority: number;
          result: Json | null;
          retry_count: number | null;
          schedule_expression: string | null;
          scheduled_at: string | null;
          started_at: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          job_name: string;
          job_type: string;
          max_retries?: number | null;
          payload?: Json | null;
          priority?: number;
          result?: Json | null;
          retry_count?: number | null;
          schedule_expression?: string | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          error_message?: string | null;
          id?: string;
          job_name?: string;
          job_type?: string;
          max_retries?: number | null;
          payload?: Json | null;
          priority?: number;
          result?: Json | null;
          retry_count?: number | null;
          schedule_expression?: string | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      base_interest_rates: {
        Row: {
          created_at: string;
          id: string;
          rate: number;
          source: string | null;
          valid_from: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rate: number;
          source?: string | null;
          valid_from: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rate?: number;
          source?: string | null;
          valid_from?: string;
        };
        Relationships: [];
      };
      billing_line_items: {
        Row: {
          amount: number;
          created_at: string;
          date: string;
          description: string;
          hours: number;
          id: string;
          rate: number;
          session_id: string | null;
          trainer_billing_id: string;
          type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          date: string;
          description: string;
          hours: number;
          id?: string;
          rate: number;
          session_id?: string | null;
          trainer_billing_id: string;
          type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          date?: string;
          description?: string;
          hours?: number;
          id?: string;
          rate?: number;
          session_id?: string | null;
          trainer_billing_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_line_items_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'billing_line_items_trainer_billing_id_fkey';
            columns: ['trainer_billing_id'];
            isOneToOne: false;
            referencedRelation: 'trainer_billings';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_periods: {
        Row: {
          club_id: string;
          created_at: string;
          end_date: string;
          id: string;
          start_date: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          end_date: string;
          id?: string;
          start_date: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          end_date?: string;
          id?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_periods_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      board_decisions: {
        Row: {
          approved_by: string | null;
          attachments: Json | null;
          club_id: string;
          created_at: string;
          created_by: string;
          decision_type: Database['public']['Enums']['decision_type'];
          description: string | null;
          id: string;
          meeting_date: string | null;
          next_review: string | null;
          outcome: Database['public']['Enums']['decision_outcome'] | null;
          quorum_met: boolean | null;
          status: Database['public']['Enums']['decision_status'];
          title: string;
          updated_at: string;
          votes_abstain: number;
          votes_against: number;
          votes_for: number;
        };
        Insert: {
          approved_by?: string | null;
          attachments?: Json | null;
          club_id: string;
          created_at?: string;
          created_by: string;
          decision_type?: Database['public']['Enums']['decision_type'];
          description?: string | null;
          id?: string;
          meeting_date?: string | null;
          next_review?: string | null;
          outcome?: Database['public']['Enums']['decision_outcome'] | null;
          quorum_met?: boolean | null;
          status?: Database['public']['Enums']['decision_status'];
          title: string;
          updated_at?: string;
          votes_abstain?: number;
          votes_against?: number;
          votes_for?: number;
        };
        Update: {
          approved_by?: string | null;
          attachments?: Json | null;
          club_id?: string;
          created_at?: string;
          created_by?: string;
          decision_type?: Database['public']['Enums']['decision_type'];
          description?: string | null;
          id?: string;
          meeting_date?: string | null;
          next_review?: string | null;
          outcome?: Database['public']['Enums']['decision_outcome'] | null;
          quorum_met?: boolean | null;
          status?: Database['public']['Enums']['decision_status'];
          title?: string;
          updated_at?: string;
          votes_abstain?: number;
          votes_against?: number;
          votes_for?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'board_decisions_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_decisions_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_decisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_restrictions: {
        Row: {
          affects_existing_bookings: boolean;
          club_id: string;
          court_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_datetime: string;
          id: string;
          is_active: boolean;
          name: string;
          restriction_type: string;
          start_datetime: string;
          updated_at: string;
        };
        Insert: {
          affects_existing_bookings?: boolean;
          club_id: string;
          court_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_datetime: string;
          id?: string;
          is_active?: boolean;
          name: string;
          restriction_type: string;
          start_datetime: string;
          updated_at?: string;
        };
        Update: {
          affects_existing_bookings?: boolean;
          club_id?: string;
          court_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_datetime?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          restriction_type?: string;
          start_datetime?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_restrictions_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_restrictions_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_restrictions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_rules: {
        Row: {
          advance_booking_days: number | null;
          allow_partner_booking: boolean;
          allow_prime_time_booking: boolean;
          allow_recurring: boolean | null;
          allow_weekend_booking: boolean;
          allowed_time_slots: Json | null;
          applies_to_role: string | null;
          blocked_time_slots: Json | null;
          cancellation_hours_before: number | null;
          club_id: string;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          max_booking_duration_minutes: number | null;
          max_bookings_per_day: number | null;
          max_bookings_per_week: number | null;
          max_concurrent_bookings: number;
          min_advance_booking_hours: number;
          min_booking_duration_minutes: number | null;
          name: string;
          prime_time_end: string | null;
          prime_time_start: string | null;
          priority: number;
          require_approval: boolean;
          require_payment: boolean;
          role: string | null;
          season_end_date: string | null;
          season_start_date: string | null;
          updated_at: string | null;
          weekend_advance_days: number;
        };
        Insert: {
          advance_booking_days?: number | null;
          allow_partner_booking?: boolean;
          allow_prime_time_booking?: boolean;
          allow_recurring?: boolean | null;
          allow_weekend_booking?: boolean;
          allowed_time_slots?: Json | null;
          applies_to_role?: string | null;
          blocked_time_slots?: Json | null;
          cancellation_hours_before?: number | null;
          club_id: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_booking_duration_minutes?: number | null;
          max_bookings_per_day?: number | null;
          max_bookings_per_week?: number | null;
          max_concurrent_bookings?: number;
          min_advance_booking_hours?: number;
          min_booking_duration_minutes?: number | null;
          name?: string;
          prime_time_end?: string | null;
          prime_time_start?: string | null;
          priority?: number;
          require_approval?: boolean;
          require_payment?: boolean;
          role?: string | null;
          season_end_date?: string | null;
          season_start_date?: string | null;
          updated_at?: string | null;
          weekend_advance_days?: number;
        };
        Update: {
          advance_booking_days?: number | null;
          allow_partner_booking?: boolean;
          allow_prime_time_booking?: boolean;
          allow_recurring?: boolean | null;
          allow_weekend_booking?: boolean;
          allowed_time_slots?: Json | null;
          applies_to_role?: string | null;
          blocked_time_slots?: Json | null;
          cancellation_hours_before?: number | null;
          club_id?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_booking_duration_minutes?: number | null;
          max_bookings_per_day?: number | null;
          max_bookings_per_week?: number | null;
          max_concurrent_bookings?: number;
          min_advance_booking_hours?: number;
          min_booking_duration_minutes?: number | null;
          name?: string;
          prime_time_end?: string | null;
          prime_time_start?: string | null;
          priority?: number;
          require_approval?: boolean;
          require_payment?: boolean;
          role?: string | null;
          season_end_date?: string | null;
          season_start_date?: string | null;
          updated_at?: string | null;
          weekend_advance_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_rules_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          booked_at: string;
          booking_number: string | null;
          booking_type: string | null;
          cancellation_notes: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          club_id: string;
          court_id: string;
          end_time: string | null;
          id: string;
          is_recurring: boolean | null;
          member_id: string;
          notes: string | null;
          payment_status: string | null;
          schedule_id: string;
          session_id: string;
          session_start_time: string;
          start_time: string | null;
          status: string;
        };
        Insert: {
          booked_at?: string;
          booking_number?: string | null;
          booking_type?: string | null;
          cancellation_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          club_id: string;
          court_id: string;
          end_time?: string | null;
          id?: string;
          is_recurring?: boolean | null;
          member_id: string;
          notes?: string | null;
          payment_status?: string | null;
          schedule_id: string;
          session_id: string;
          session_start_time: string;
          start_time?: string | null;
          status?: string;
        };
        Update: {
          booked_at?: string;
          booking_number?: string | null;
          booking_type?: string | null;
          cancellation_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          club_id?: string;
          court_id?: string;
          end_time?: string | null;
          id?: string;
          is_recurring?: boolean | null;
          member_id?: string;
          notes?: string | null;
          payment_status?: string | null;
          schedule_id?: string;
          session_id?: string;
          session_start_time?: string;
          start_time?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_schedule_id_schedules_id_fk';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_session_id_sessions_id_fk';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      club_access_requests: {
        Row: {
          club_name: string | null;
          created_at: string;
          email: string;
          id: string;
          message: string | null;
          name: string;
          status: string;
        };
        Insert: {
          club_name?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          message?: string | null;
          name: string;
          status?: string;
        };
        Update: {
          club_name?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string | null;
          name?: string;
          status?: string;
        };
        Relationships: [];
      };
      club_documents: {
        Row: {
          category: string;
          club_id: string;
          created_at: string;
          file_path: string;
          file_size_bytes: number | null;
          file_url: string;
          id: string;
          mime_type: string | null;
          name: string;
          uploaded_by: string | null;
        };
        Insert: {
          category?: string;
          club_id: string;
          created_at?: string;
          file_path: string;
          file_size_bytes?: number | null;
          file_url: string;
          id?: string;
          mime_type?: string | null;
          name: string;
          uploaded_by?: string | null;
        };
        Update: {
          category?: string;
          club_id?: string;
          created_at?: string;
          file_path?: string;
          file_size_bytes?: number | null;
          file_url?: string;
          id?: string;
          mime_type?: string | null;
          name?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'club_documents_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      clubs: {
        Row: {
          accent_color: string | null;
          address: string | null;
          billing_unit_minutes: number;
          bundesland: string | null;
          city: string | null;
          created_at: string;
          custom_domain: string | null;
          dashboard_bg_url: string | null;
          datev_creditor_number: string | null;
          default_hourly_rate: number | null;
          default_payment_method: string;
          default_revenue_account: string;
          default_session_duration_minutes: number | null;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          description: string | null;
          email: string | null;
          favicon_url: string | null;
          features: Json;
          founding_date: string | null;
          hourly_rate: number | null;
          id: string;
          invoice_number_prefix: string;
          legal_info: Json;
          logo_dark_url: string | null;
          logo_light_url: string | null;
          logo_url: string | null;
          max_members: number;
          name: string;
          next_member_number: number;
          nuliga_club_url: string | null;
          opening_hours: Json;
          phone: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          setup_completed_at: string | null;
          slug: string | null;
          status: string;
          tax_rate: number;
          tennisde_verband: string | null;
          tennisde_verein_nr: string | null;
          timezone: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          accent_color?: string | null;
          address?: string | null;
          billing_unit_minutes?: number;
          bundesland?: string | null;
          city?: string | null;
          created_at?: string;
          custom_domain?: string | null;
          dashboard_bg_url?: string | null;
          datev_creditor_number?: string | null;
          default_hourly_rate?: number | null;
          default_payment_method?: string;
          default_revenue_account?: string;
          default_session_duration_minutes?: number | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          email?: string | null;
          favicon_url?: string | null;
          features?: Json;
          founding_date?: string | null;
          hourly_rate?: number | null;
          id?: string;
          invoice_number_prefix?: string;
          legal_info?: Json;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          logo_url?: string | null;
          max_members?: number;
          name: string;
          next_member_number?: number;
          nuliga_club_url?: string | null;
          opening_hours: Json;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          setup_completed_at?: string | null;
          slug?: string | null;
          status?: string;
          tax_rate?: number;
          tennisde_verband?: string | null;
          tennisde_verein_nr?: string | null;
          timezone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          accent_color?: string | null;
          address?: string | null;
          billing_unit_minutes?: number;
          bundesland?: string | null;
          city?: string | null;
          created_at?: string;
          custom_domain?: string | null;
          dashboard_bg_url?: string | null;
          datev_creditor_number?: string | null;
          default_hourly_rate?: number | null;
          default_payment_method?: string;
          default_revenue_account?: string;
          default_session_duration_minutes?: number | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          email?: string | null;
          favicon_url?: string | null;
          features?: Json;
          founding_date?: string | null;
          hourly_rate?: number | null;
          id?: string;
          invoice_number_prefix?: string;
          legal_info?: Json;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          logo_url?: string | null;
          max_members?: number;
          name?: string;
          next_member_number?: number;
          nuliga_club_url?: string | null;
          opening_hours?: Json;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          setup_completed_at?: string | null;
          slug?: string | null;
          status?: string;
          tax_rate?: number;
          tennisde_verband?: string | null;
          tennisde_verein_nr?: string | null;
          timezone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clubs_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_requests: {
        Row: {
          club_name: string | null;
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          message: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          club_name?: string | null;
          created_at?: string;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          message: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          club_name?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          message?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to_id: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to_id?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to_id?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_messages_reply_to_id_fkey';
            columns: ['reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'conversation_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          joined_at: string;
          last_read_at: string;
          muted: boolean;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string;
          muted?: boolean;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string;
          muted?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          club_id: string;
          created_at: string;
          created_by: string;
          direct_key: string | null;
          id: string;
          kind: string;
          last_message_at: string;
          last_message_preview: string | null;
          title: string | null;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          created_by: string;
          direct_key?: string | null;
          id?: string;
          kind: string;
          last_message_at?: string;
          last_message_preview?: string | null;
          title?: string | null;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          created_by?: string;
          direct_key?: string | null;
          id?: string;
          kind?: string;
          last_message_at?: string;
          last_message_preview?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      coupons: {
        Row: {
          club_id: string | null;
          code: string;
          created_at: string | null;
          created_by: string | null;
          discount_type: string;
          discount_value: number;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          max_uses: number | null;
          min_amount: number | null;
          used_count: number | null;
        };
        Insert: {
          club_id?: string | null;
          code: string;
          created_at?: string | null;
          created_by?: string | null;
          discount_type: string;
          discount_value: number;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_uses?: number | null;
          min_amount?: number | null;
          used_count?: number | null;
        };
        Update: {
          club_id?: string | null;
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          discount_type?: string;
          discount_value?: number;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_uses?: number | null;
          min_amount?: number | null;
          used_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'coupons_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupons_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      court_availability: {
        Row: {
          court_id: string;
          created_at: string | null;
          day_of_week: number;
          end_time: string;
          id: string;
          is_available: boolean | null;
          start_time: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          court_id: string;
          created_at?: string | null;
          day_of_week: number;
          end_time: string;
          id?: string;
          is_available?: boolean | null;
          start_time: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          court_id?: string;
          created_at?: string | null;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          is_available?: boolean | null;
          start_time?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'court_availability_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
        ];
      };
      court_closures: {
        Row: {
          auto_generated: boolean;
          club_id: string;
          court_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          is_active: boolean;
          match_day_id: string | null;
          reason: string;
          start_date: string;
          updated_at: string;
          weather_condition: string | null;
        };
        Insert: {
          auto_generated?: boolean;
          club_id: string;
          court_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          match_day_id?: string | null;
          reason: string;
          start_date: string;
          updated_at?: string;
          weather_condition?: string | null;
        };
        Update: {
          auto_generated?: boolean;
          club_id?: string;
          court_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          match_day_id?: string | null;
          reason?: string;
          start_date?: string;
          updated_at?: string;
          weather_condition?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'court_closures_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'court_closures_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'court_closures_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'court_closures_match_day_id_fkey';
            columns: ['match_day_id'];
            isOneToOne: false;
            referencedRelation: 'match_days';
            referencedColumns: ['id'];
          },
        ];
      };
      court_maintenance: {
        Row: {
          club_id: string;
          court_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_date: string;
          id: string;
          start_date: string;
          status: string;
          title: string;
        };
        Insert: {
          club_id: string;
          court_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date: string;
          id?: string;
          start_date: string;
          status?: string;
          title: string;
        };
        Update: {
          club_id?: string;
          court_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date?: string;
          id?: string;
          start_date?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'court_maintenance_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'court_maintenance_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
        ];
      };
      court_types: {
        Row: {
          club_id: string | null;
          created_at: string | null;
          description: string | null;
          hourly_rate: number | null;
          id: string;
          is_active: boolean | null;
          is_indoor: boolean | null;
          is_outdoor: boolean | null;
          max_players: number | null;
          name: string;
          requires_lighting: boolean | null;
          surface_type: string | null;
          updated_at: string | null;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_indoor?: boolean | null;
          is_outdoor?: boolean | null;
          max_players?: number | null;
          name: string;
          requires_lighting?: boolean | null;
          surface_type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          club_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean | null;
          is_indoor?: boolean | null;
          is_outdoor?: boolean | null;
          max_players?: number | null;
          name?: string;
          requires_lighting?: boolean | null;
          surface_type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'court_types_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      courts: {
        Row: {
          club_id: string;
          court_type_id: string | null;
          created_at: string;
          description: string | null;
          has_indoor: boolean;
          has_lighting: boolean | null;
          id: string;
          is_active: boolean;
          location: string | null;
          name: string;
          number: number | null;
          status: string | null;
          surface: string;
          updated_at: string | null;
          usable_for_training: boolean;
        };
        Insert: {
          club_id: string;
          court_type_id?: string | null;
          created_at?: string;
          description?: string | null;
          has_indoor?: boolean;
          has_lighting?: boolean | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name: string;
          number?: number | null;
          status?: string | null;
          surface?: string;
          updated_at?: string | null;
          usable_for_training?: boolean;
        };
        Update: {
          club_id?: string;
          court_type_id?: string | null;
          created_at?: string;
          description?: string | null;
          has_indoor?: boolean;
          has_lighting?: boolean | null;
          id?: string;
          is_active?: boolean;
          location?: string | null;
          name?: string;
          number?: number | null;
          status?: string | null;
          surface?: string;
          updated_at?: string | null;
          usable_for_training?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'courts_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'courts_court_type_id_fkey';
            columns: ['court_type_id'];
            isOneToOne: false;
            referencedRelation: 'court_types';
            referencedColumns: ['id'];
          },
        ];
      };
      decision_changes: {
        Row: {
          action: Database['public']['Enums']['decision_change_action'];
          actor_id: string | null;
          actor_label_snapshot: string | null;
          created_at: string;
          decision_id: string;
          details: Json | null;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
        };
        Insert: {
          action: Database['public']['Enums']['decision_change_action'];
          actor_id?: string | null;
          actor_label_snapshot?: string | null;
          created_at?: string;
          decision_id: string;
          details?: Json | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Update: {
          action?: Database['public']['Enums']['decision_change_action'];
          actor_id?: string | null;
          actor_label_snapshot?: string | null;
          created_at?: string;
          decision_id?: string;
          details?: Json | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'decision_changes_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decision_changes_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: false;
            referencedRelation: 'board_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
      decision_votes: {
        Row: {
          choice: Database['public']['Enums']['vote_choice'];
          decision_id: string;
          id: string;
          voted_at: string;
          voter_id: string;
        };
        Insert: {
          choice: Database['public']['Enums']['vote_choice'];
          decision_id: string;
          id?: string;
          voted_at?: string;
          voter_id: string;
        };
        Update: {
          choice?: Database['public']['Enums']['vote_choice'];
          decision_id?: string;
          id?: string;
          voted_at?: string;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'decision_votes_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: false;
            referencedRelation: 'board_decisions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'decision_votes_voter_id_fkey';
            columns: ['voter_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      dunning_records: {
        Row: {
          base_rate_applied: number;
          cancelled_at: string | null;
          club_id: string;
          created_at: string | null;
          due_date: string | null;
          escalated_at: string | null;
          fee_amount: number | null;
          id: string;
          interest_amount: number;
          interest_days: number;
          invoice_id: string;
          is_b2b: boolean;
          legal_basis: string | null;
          level: number | null;
          member_id: string | null;
          notes: string | null;
          original_amount: number;
          paid_at: string | null;
          sent_at: string | null;
          status: string | null;
          total_amount: number;
          total_due: number;
          updated_at: string | null;
        };
        Insert: {
          base_rate_applied?: number;
          cancelled_at?: string | null;
          club_id: string;
          created_at?: string | null;
          due_date?: string | null;
          escalated_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          interest_amount?: number;
          interest_days?: number;
          invoice_id: string;
          is_b2b?: boolean;
          legal_basis?: string | null;
          level?: number | null;
          member_id?: string | null;
          notes?: string | null;
          original_amount?: number;
          paid_at?: string | null;
          sent_at?: string | null;
          status?: string | null;
          total_amount?: number;
          total_due?: number;
          updated_at?: string | null;
        };
        Update: {
          base_rate_applied?: number;
          cancelled_at?: string | null;
          club_id?: string;
          created_at?: string | null;
          due_date?: string | null;
          escalated_at?: string | null;
          fee_amount?: number | null;
          id?: string;
          interest_amount?: number;
          interest_days?: number;
          invoice_id?: string;
          is_b2b?: boolean;
          legal_basis?: string | null;
          level?: number | null;
          member_id?: string | null;
          notes?: string | null;
          original_amount?: number;
          paid_at?: string | null;
          sent_at?: string | null;
          status?: string | null;
          total_amount?: number;
          total_due?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dunning_records_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dunning_records_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dunning_records_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      email_campaigns: {
        Row: {
          body: string;
          club_id: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          recipient_count: number | null;
          scheduled_at: string | null;
          status: string | null;
          subject: string;
          target_group: string | null;
        };
        Insert: {
          body: string;
          club_id: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          recipient_count?: number | null;
          scheduled_at?: string | null;
          status?: string | null;
          subject: string;
          target_group?: string | null;
        };
        Update: {
          body?: string;
          club_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          recipient_count?: number | null;
          scheduled_at?: string | null;
          status?: string | null;
          subject?: string;
          target_group?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'email_campaigns_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      email_queue: {
        Row: {
          body: string;
          campaign_id: string | null;
          club_id: string | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          recipient_email: string;
          recipient_name: string | null;
          sent_at: string | null;
          status: string | null;
          subject: string;
        };
        Insert: {
          body: string;
          campaign_id?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_email: string;
          recipient_name?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subject: string;
        };
        Update: {
          body?: string;
          campaign_id?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_email?: string;
          recipient_name?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_queue_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'email_campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_queue_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      family_accounts: {
        Row: {
          created_at: string | null;
          family_group_id: string;
          id: string;
          parent_pin_hash: string | null;
          relationship: string | null;
          role: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          family_group_id: string;
          id?: string;
          parent_pin_hash?: string | null;
          relationship?: string | null;
          role?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          family_group_id?: string;
          id?: string;
          parent_pin_hash?: string | null;
          relationship?: string | null;
          role?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'family_accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      family_invites: {
        Row: {
          code: string;
          created_at: string | null;
          created_by: string | null;
          expires_at: string | null;
          family_group_id: string;
          id: string;
          is_used: boolean | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          family_group_id: string;
          id?: string;
          is_used?: boolean | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          family_group_id?: string;
          id?: string;
          is_used?: boolean | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'family_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_invites_used_by_fkey';
            columns: ['used_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      fee_configurations: {
        Row: {
          amount: number;
          billing_cycle: string;
          billing_unit_count: number;
          club_id: string;
          conditions: Json | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          type: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          amount: number;
          billing_cycle: string;
          billing_unit_count?: number;
          club_id: string;
          conditions?: Json | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          type: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          amount?: number;
          billing_cycle?: string;
          billing_unit_count?: number;
          club_id?: string;
          conditions?: Json | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          type?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fee_configurations_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      gamification_badges: {
        Row: {
          description: string | null;
          earned_at: string | null;
          icon: string | null;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          description?: string | null;
          earned_at?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          description?: string | null;
          earned_at?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gamification_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      gamification_points: {
        Row: {
          points: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          points?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          points?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gamification_points_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          age_group: string | null;
          club_id: string;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          level: string | null;
          max_members: number | null;
          max_size: number | null;
          member_ids: Json | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          age_group?: string | null;
          club_id: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          level?: string | null;
          max_members?: number | null;
          max_size?: number | null;
          member_ids?: Json | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          age_group?: string | null;
          club_id?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          level?: string | null;
          max_members?: number | null;
          max_size?: number | null;
          member_ids?: Json | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      hourly_rate_tiers: {
        Row: {
          base_rate: number;
          club_id: string;
          created_at: string;
          description: string | null;
          experience_level: string;
          id: string;
          is_active: boolean;
          name: string;
          training_types: Json;
          updated_at: string;
        };
        Insert: {
          base_rate: number;
          club_id: string;
          created_at?: string;
          description?: string | null;
          experience_level: string;
          id?: string;
          is_active?: boolean;
          name: string;
          training_types?: Json;
          updated_at?: string;
        };
        Update: {
          base_rate?: number;
          club_id?: string;
          created_at?: string;
          description?: string | null;
          experience_level?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          training_types?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hourly_rate_tiers_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      hours_logs: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          club_id: string | null;
          created_at: string;
          date: string;
          duration: number;
          end_time: string;
          id: string;
          notes: string | null;
          rejection_reason: string | null;
          session_id: string | null;
          start_time: string;
          status: string;
          trainer_id: string;
          trainer_name: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          club_id?: string | null;
          created_at?: string;
          date: string;
          duration: number;
          end_time: string;
          id?: string;
          notes?: string | null;
          rejection_reason?: string | null;
          session_id?: string | null;
          start_time: string;
          status?: string;
          trainer_id: string;
          trainer_name: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          club_id?: string | null;
          created_at?: string;
          date?: string;
          duration?: number;
          end_time?: string;
          id?: string;
          notes?: string | null;
          rejection_reason?: string | null;
          session_id?: string | null;
          start_time?: string;
          status?: string;
          trainer_id?: string;
          trainer_name?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hours_logs_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hours_logs_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hours_logs_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_installments: {
        Row: {
          amount: number;
          created_at: string;
          due_date: string;
          id: string;
          installment_number: number;
          invoice_id: string;
          paid_at: string | null;
          payment_id: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_date: string;
          id?: string;
          installment_number: number;
          invoice_id: string;
          paid_at?: string | null;
          payment_id?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_date?: string;
          id?: string;
          installment_number?: number;
          invoice_id?: string;
          paid_at?: string | null;
          payment_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_installments_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_installments_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_items: {
        Row: {
          created_at: string | null;
          datev_account_number: string | null;
          description: string;
          id: string;
          invoice_id: string;
          item_type: string;
          quantity: number | null;
          recalc_required_at: string | null;
          reference_id: string | null;
          reference_type: string | null;
          tax_rate: number;
          total_price: number | null;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string | null;
          datev_account_number?: string | null;
          description: string;
          id?: string;
          invoice_id: string;
          item_type: string;
          quantity?: number | null;
          recalc_required_at?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          tax_rate?: number;
          total_price?: number | null;
          unit_price: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string | null;
          datev_account_number?: string | null;
          description?: string;
          id?: string;
          invoice_id?: string;
          item_type?: string;
          quantity?: number | null;
          recalc_required_at?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          tax_rate?: number;
          total_price?: number | null;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          amount: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          club_id: string;
          created_at: string | null;
          currency: string | null;
          due_date: string | null;
          id: string;
          invoice_date: string;
          invoice_number: string;
          invoice_type: string | null;
          member_id: string | null;
          notes: string | null;
          paid_amount: number;
          paid_at: string | null;
          season_id: string | null;
          sent_at: string | null;
          status: string | null;
          subtotal: number;
          tax_amount: number | null;
          trainer_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          club_id: string;
          created_at?: string | null;
          currency?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string;
          invoice_number: string;
          invoice_type?: string | null;
          member_id?: string | null;
          notes?: string | null;
          paid_amount?: number;
          paid_at?: string | null;
          season_id?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subtotal?: number;
          tax_amount?: number | null;
          trainer_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          club_id?: string;
          created_at?: string | null;
          currency?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_date?: string;
          invoice_number?: string;
          invoice_type?: string | null;
          member_id?: string | null;
          notes?: string | null;
          paid_amount?: number;
          paid_at?: string | null;
          season_id?: string | null;
          sent_at?: string | null;
          status?: string | null;
          subtotal?: number;
          tax_amount?: number | null;
          trainer_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      job_execution_log: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          execution_completed_at: string | null;
          execution_duration_ms: number | null;
          execution_started_at: string;
          id: string;
          job_id: string;
          result: Json | null;
          stack_trace: string | null;
          success: boolean;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          execution_completed_at?: string | null;
          execution_duration_ms?: number | null;
          execution_started_at?: string;
          id?: string;
          job_id: string;
          result?: Json | null;
          stack_trace?: string | null;
          success?: boolean;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          execution_completed_at?: string | null;
          execution_duration_ms?: number | null;
          execution_started_at?: string;
          id?: string;
          job_id?: string;
          result?: Json | null;
          stack_trace?: string | null;
          success?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'job_execution_log_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'background_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      league_players: {
        Row: {
          birth_year: number | null;
          club_id: string;
          created_at: string;
          dtb_id: string | null;
          id: string;
          league_id: string;
          lk: string | null;
          member_id: string | null;
          name: string;
          position_number: number | null;
          source_url: string | null;
          synced_at: string;
        };
        Insert: {
          birth_year?: number | null;
          club_id: string;
          created_at?: string;
          dtb_id?: string | null;
          id?: string;
          league_id: string;
          lk?: string | null;
          member_id?: string | null;
          name: string;
          position_number?: number | null;
          source_url?: string | null;
          synced_at?: string;
        };
        Update: {
          birth_year?: number | null;
          club_id?: string;
          created_at?: string;
          dtb_id?: string | null;
          id?: string;
          league_id?: string;
          lk?: string | null;
          member_id?: string | null;
          name?: string;
          position_number?: number | null;
          source_url?: string | null;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'league_players_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'league_players_league_id_fkey';
            columns: ['league_id'];
            isOneToOne: false;
            referencedRelation: 'leagues';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'league_players_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      leagues: {
        Row: {
          age_group: string | null;
          club_id: string;
          created_at: string;
          division: string | null;
          id: string;
          last_synced_at: string | null;
          league_type: string;
          name: string;
          notes: string | null;
          nuliga_roster_url: string | null;
          nuliga_url: string | null;
          own_team_name: string | null;
          season_year: number;
          sport: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          age_group?: string | null;
          club_id: string;
          created_at?: string;
          division?: string | null;
          id?: string;
          last_synced_at?: string | null;
          league_type?: string;
          name: string;
          notes?: string | null;
          nuliga_roster_url?: string | null;
          nuliga_url?: string | null;
          own_team_name?: string | null;
          season_year: number;
          sport?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          age_group?: string | null;
          club_id?: string;
          created_at?: string;
          division?: string | null;
          id?: string;
          last_synced_at?: string | null;
          league_type?: string;
          name?: string;
          notes?: string | null;
          nuliga_roster_url?: string | null;
          nuliga_url?: string | null;
          own_team_name?: string | null;
          season_year?: number;
          sport?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leagues_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      match_caterings: {
        Row: {
          club_id: string;
          created_at: string;
          expected_guests: number | null;
          id: string;
          match_day_id: string;
          notes: string | null;
          organizer_name: string | null;
          status: Database['public']['Enums']['catering_status'];
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          expected_guests?: number | null;
          id?: string;
          match_day_id: string;
          notes?: string | null;
          organizer_name?: string | null;
          status?: Database['public']['Enums']['catering_status'];
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          expected_guests?: number | null;
          id?: string;
          match_day_id?: string;
          notes?: string | null;
          organizer_name?: string | null;
          status?: Database['public']['Enums']['catering_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_caterings_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_caterings_match_day_id_fkey';
            columns: ['match_day_id'];
            isOneToOne: true;
            referencedRelation: 'match_days';
            referencedColumns: ['id'];
          },
        ];
      };
      match_days: {
        Row: {
          created_at: string;
          id: string;
          is_home: boolean;
          league_id: string;
          matchday_number: number;
          notes: string | null;
          nuliga_report_url: string | null;
          opponent: string;
          result: string | null;
          scheduled_date: string | null;
          score_away: number | null;
          score_home: number | null;
          status: string;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_home?: boolean;
          league_id: string;
          matchday_number: number;
          notes?: string | null;
          nuliga_report_url?: string | null;
          opponent: string;
          result?: string | null;
          scheduled_date?: string | null;
          score_away?: number | null;
          score_home?: number | null;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_home?: boolean;
          league_id?: string;
          matchday_number?: number;
          notes?: string | null;
          nuliga_report_url?: string | null;
          opponent?: string;
          result?: string | null;
          scheduled_date?: string | null;
          score_away?: number | null;
          score_home?: number | null;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'match_days_league_id_fkey';
            columns: ['league_id'];
            isOneToOne: false;
            referencedRelation: 'leagues';
            referencedColumns: ['id'];
          },
        ];
      };
      match_results: {
        Row: {
          away_player_ids: string[];
          away_sets_won: number;
          club_id: string;
          home_player_ids: string[];
          home_sets_won: number;
          id: string;
          match_day_id: string;
          notes: string | null;
          outcome: Database['public']['Enums']['match_outcome'];
          position_number: number;
          position_type: Database['public']['Enums']['match_position_type'];
          recorded_at: string;
          recorded_by: string | null;
          set_scores: Json | null;
          updated_at: string;
        };
        Insert: {
          away_player_ids: string[];
          away_sets_won?: number;
          club_id: string;
          home_player_ids: string[];
          home_sets_won?: number;
          id?: string;
          match_day_id: string;
          notes?: string | null;
          outcome?: Database['public']['Enums']['match_outcome'];
          position_number: number;
          position_type: Database['public']['Enums']['match_position_type'];
          recorded_at?: string;
          recorded_by?: string | null;
          set_scores?: Json | null;
          updated_at?: string;
        };
        Update: {
          away_player_ids?: string[];
          away_sets_won?: number;
          club_id?: string;
          home_player_ids?: string[];
          home_sets_won?: number;
          id?: string;
          match_day_id?: string;
          notes?: string | null;
          outcome?: Database['public']['Enums']['match_outcome'];
          position_number?: number;
          position_type?: Database['public']['Enums']['match_position_type'];
          recorded_at?: string;
          recorded_by?: string | null;
          set_scores?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'match_results_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_results_match_day_id_fkey';
            columns: ['match_day_id'];
            isOneToOne: false;
            referencedRelation: 'match_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'match_results_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      matchday_reminder_logs: {
        Row: {
          channel: string;
          error_message: string | null;
          id: string;
          is_succeeded: boolean;
          matchday_id: string;
          payload: Json | null;
          provider_message_id: string | null;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          channel: string;
          error_message?: string | null;
          id?: string;
          is_succeeded?: boolean;
          matchday_id: string;
          payload?: Json | null;
          provider_message_id?: string | null;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          error_message?: string | null;
          id?: string;
          is_succeeded?: boolean;
          matchday_id?: string;
          payload?: Json | null;
          provider_message_id?: string | null;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matchday_reminder_logs_matchday_id_fkey';
            columns: ['matchday_id'];
            isOneToOne: false;
            referencedRelation: 'match_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matchday_reminder_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_invitations: {
        Row: {
          decision_id: string;
          id: string;
          member_id: string;
          reminded_at: string | null;
          responded_at: string | null;
          response_note: string | null;
          sent_at: string;
          status: Database['public']['Enums']['invitation_status'];
        };
        Insert: {
          decision_id: string;
          id?: string;
          member_id: string;
          reminded_at?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          sent_at?: string;
          status?: Database['public']['Enums']['invitation_status'];
        };
        Update: {
          decision_id?: string;
          id?: string;
          member_id?: string;
          reminded_at?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          sent_at?: string;
          status?: Database['public']['Enums']['invitation_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_invitations_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: false;
            referencedRelation: 'board_decisions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_invitations_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      member_balance_entries: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          member_balance_id: string;
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_balance_id: string;
          reason: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_balance_id?: string;
          reason?: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'member_balance_entries_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_balance_entries_member_balance_id_fkey';
            columns: ['member_balance_id'];
            isOneToOne: false;
            referencedRelation: 'member_balances';
            referencedColumns: ['id'];
          },
        ];
      };
      member_balances: {
        Row: {
          balance: number;
          club_id: string;
          id: string;
          member_id: string;
          updated_at: string;
        };
        Insert: {
          balance?: number;
          club_id: string;
          id?: string;
          member_id: string;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          club_id?: string;
          id?: string;
          member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_balances_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_balances_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      member_booking_preferences: {
        Row: {
          auto_cancel_no_show: boolean;
          avoid_partners: string[] | null;
          club_id: string;
          created_at: string;
          default_booking_duration: number;
          id: string;
          notification_preferences: Json | null;
          preferred_courts: string[] | null;
          preferred_partners: string[] | null;
          preferred_time_slots: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_cancel_no_show?: boolean;
          avoid_partners?: string[] | null;
          club_id: string;
          created_at?: string;
          default_booking_duration?: number;
          id?: string;
          notification_preferences?: Json | null;
          preferred_courts?: string[] | null;
          preferred_partners?: string[] | null;
          preferred_time_slots?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_cancel_no_show?: boolean;
          avoid_partners?: string[] | null;
          club_id?: string;
          created_at?: string;
          default_booking_duration?: number;
          id?: string;
          notification_preferences?: Json | null;
          preferred_courts?: string[] | null;
          preferred_partners?: string[] | null;
          preferred_time_slots?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_booking_preferences_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_booking_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      member_meetings: {
        Row: {
          agenda: Json;
          club_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          location: string | null;
          meeting_date: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          agenda?: Json;
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          meeting_date: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          agenda?: Json;
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          meeting_date?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_meetings_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      member_schedule_preferences: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          max_sessions_per_week: number | null;
          notes: string | null;
          preferred_age_group: string | null;
          preferred_court_ids: Json | null;
          preferred_level: string | null;
          preferred_trainer_ids: Json | null;
          special_requests: string | null;
          updated_at: string;
          user_id: string;
          weekly_availability: Json;
          wish_partner_ids: Json | null;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          max_sessions_per_week?: number | null;
          notes?: string | null;
          preferred_age_group?: string | null;
          preferred_court_ids?: Json | null;
          preferred_level?: string | null;
          preferred_trainer_ids?: Json | null;
          special_requests?: string | null;
          updated_at?: string;
          user_id: string;
          weekly_availability?: Json;
          wish_partner_ids?: Json | null;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          max_sessions_per_week?: number | null;
          notes?: string | null;
          preferred_age_group?: string | null;
          preferred_court_ids?: Json | null;
          preferred_level?: string | null;
          preferred_trainer_ids?: Json | null;
          special_requests?: string | null;
          updated_at?: string;
          user_id?: string;
          weekly_availability?: Json;
          wish_partner_ids?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'member_schedule_preferences_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_schedule_preferences_user_id_users_id_fk';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      news_comments: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          is_edited: boolean | null;
          news_post_id: string | null;
          post_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          is_edited?: boolean | null;
          news_post_id?: string | null;
          post_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          is_edited?: boolean | null;
          news_post_id?: string | null;
          post_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'news_comments_news_post_id_fkey';
            columns: ['news_post_id'];
            isOneToOne: false;
            referencedRelation: 'news_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'news_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'news_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'news_comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      news_post_reads: {
        Row: {
          post_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          post_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          post_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'news_post_reads_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'news_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      news_posts: {
        Row: {
          audience: string;
          author_id: string | null;
          category: string | null;
          club_id: string;
          content: string | null;
          cover_image_url: string | null;
          created_at: string | null;
          excerpt: string | null;
          id: string;
          is_pinned: boolean | null;
          is_published: boolean | null;
          published_at: string | null;
          slug: string | null;
          status: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
          view_count: number | null;
        };
        Insert: {
          audience?: string;
          author_id?: string | null;
          category?: string | null;
          club_id: string;
          content?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          id?: string;
          is_pinned?: boolean | null;
          is_published?: boolean | null;
          published_at?: string | null;
          slug?: string | null;
          status?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Update: {
          audience?: string;
          author_id?: string | null;
          category?: string | null;
          club_id?: string;
          content?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          excerpt?: string | null;
          id?: string;
          is_pinned?: boolean | null;
          is_published?: boolean | null;
          published_at?: string | null;
          slug?: string | null;
          status?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'news_posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'news_posts_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      newsletter_campaigns: {
        Row: {
          actor_id: string | null;
          body_html: string;
          club_id: string;
          created_at: string;
          id: string;
          recipient_count: number;
          sent_at: string | null;
          subject: string;
          template: string;
        };
        Insert: {
          actor_id?: string | null;
          body_html: string;
          club_id: string;
          created_at?: string;
          id?: string;
          recipient_count?: number;
          sent_at?: string | null;
          subject: string;
          template: string;
        };
        Update: {
          actor_id?: string | null;
          body_html?: string;
          club_id?: string;
          created_at?: string;
          id?: string;
          recipient_count?: number;
          sent_at?: string | null;
          subject?: string;
          template?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_campaigns_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'newsletter_campaigns_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      newsletter_send_logs: {
        Row: {
          campaign_id: string;
          error_message: string | null;
          id: string;
          recipient_email: string;
          sent_at: string;
          status: string;
        };
        Insert: {
          campaign_id: string;
          error_message?: string | null;
          id?: string;
          recipient_email: string;
          sent_at?: string;
          status?: string;
        };
        Update: {
          campaign_id?: string;
          error_message?: string | null;
          id?: string;
          recipient_email?: string;
          sent_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_send_logs_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'newsletter_campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_consents: {
        Row: {
          channel: string;
          consent_source: string | null;
          consented_at: string | null;
          created_at: string;
          id: string;
          is_opted_in: boolean;
          privacy_policy_version: string | null;
          revoked_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel: string;
          consent_source?: string | null;
          consented_at?: string | null;
          created_at?: string;
          id?: string;
          is_opted_in?: boolean;
          privacy_policy_version?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          consent_source?: string | null;
          consented_at?: string | null;
          created_at?: string;
          id?: string;
          is_opted_in?: boolean;
          privacy_policy_version?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          action_url: string | null;
          club_id: string | null;
          created_at: string | null;
          id: string;
          is_read: boolean;
          link: string | null;
          message: string | null;
          read: boolean | null;
          read_at: string | null;
          title: string;
          type: string | null;
          user_id: string;
        };
        Insert: {
          action_url?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string | null;
          read?: boolean | null;
          read_at?: string | null;
          title: string;
          type?: string | null;
          user_id: string;
        };
        Update: {
          action_url?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string | null;
          read?: boolean | null;
          read_at?: string | null;
          title?: string;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      nuliga_sync_log: {
        Row: {
          club_id: string;
          completed_at: string;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          league_id: string;
          matches_created: number;
          matches_updated: number;
          nuliga_championship: string | null;
          nuliga_group_name: string | null;
          nuliga_url: string;
          started_at: string;
          status: string;
          teams_created: number;
          teams_updated: number;
          trigger: string;
        };
        Insert: {
          club_id: string;
          completed_at?: string;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          league_id: string;
          matches_created?: number;
          matches_updated?: number;
          nuliga_championship?: string | null;
          nuliga_group_name?: string | null;
          nuliga_url: string;
          started_at: string;
          status?: string;
          teams_created?: number;
          teams_updated?: number;
          trigger?: string;
        };
        Update: {
          club_id?: string;
          completed_at?: string;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          league_id?: string;
          matches_created?: number;
          matches_updated?: number;
          nuliga_championship?: string | null;
          nuliga_group_name?: string | null;
          nuliga_url?: string;
          started_at?: string;
          status?: string;
          teams_created?: number;
          teams_updated?: number;
          trigger?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'nuliga_sync_log_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nuliga_sync_log_league_id_fkey';
            columns: ['league_id'];
            isOneToOne: false;
            referencedRelation: 'leagues';
            referencedColumns: ['id'];
          },
        ];
      };
      open_match_participants: {
        Row: {
          id: string;
          joined_at: string;
          match_id: string;
          role: string;
          status: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          match_id: string;
          role?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          match_id?: string;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'open_match_participants_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'open_matches';
            referencedColumns: ['id'];
          },
        ];
      };
      open_matches: {
        Row: {
          club_id: string;
          court_id: string | null;
          created_at: string;
          creator_id: string;
          current_players: number;
          description: string | null;
          end_time: string;
          id: string;
          is_public: boolean;
          match_date: string;
          match_type: string;
          max_players: number;
          skill_level: string;
          start_time: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          court_id?: string | null;
          created_at?: string;
          creator_id: string;
          current_players?: number;
          description?: string | null;
          end_time: string;
          id?: string;
          is_public?: boolean;
          match_date: string;
          match_type?: string;
          max_players?: number;
          skill_level?: string;
          start_time: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          court_id?: string | null;
          created_at?: string;
          creator_id?: string;
          current_players?: number;
          description?: string | null;
          end_time?: string;
          id?: string;
          is_public?: boolean;
          match_date?: string;
          match_type?: string;
          max_players?: number;
          skill_level?: string;
          start_time?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'open_matches_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'open_matches_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
        ];
      };
      ops_heartbeats: {
        Row: {
          detail: Json | null;
          last_seen_at: string;
          name: string;
        };
        Insert: {
          detail?: Json | null;
          last_seen_at?: string;
          name: string;
        };
        Update: {
          detail?: Json | null;
          last_seen_at?: string;
          name?: string;
        };
        Relationships: [];
      };
      payment_settings: {
        Row: {
          club_id: string;
          config: Json;
          created_at: string;
          fees: Json | null;
          gateway: string;
          gateway_name: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          max_amount: number | null;
          min_amount: number | null;
          supported_currencies: string[];
          supported_methods: string[];
          updated_at: string;
        };
        Insert: {
          club_id: string;
          config?: Json;
          created_at?: string;
          fees?: Json | null;
          gateway: string;
          gateway_name: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          supported_currencies: string[];
          supported_methods: string[];
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          config?: Json;
          created_at?: string;
          fees?: Json | null;
          gateway?: string;
          gateway_name?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          supported_currencies?: string[];
          supported_methods?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_settings_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string | null;
          currency: string | null;
          external_id: string | null;
          id: string;
          invoice_id: string;
          paid_at: string | null;
          payment_method: string | null;
          status: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          currency?: string | null;
          external_id?: string | null;
          id?: string;
          invoice_id: string;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          currency?: string | null;
          external_id?: string | null;
          id?: string;
          invoice_id?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      planning_conflicts: {
        Row: {
          affected_court_id: string | null;
          affected_group_ids: Json | null;
          affected_plan_entry_ids: Json;
          affected_trainer_id: string | null;
          affected_user_ids: Json | null;
          club_id: string;
          conflict_time_slot: Json | null;
          conflict_type: string;
          created_at: string;
          description: string;
          detected_at: string;
          detection_source: string | null;
          id: string;
          resolution_action: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          season_id: string;
          severity: string;
          status: string;
          suggested_resolution: string | null;
          updated_at: string;
        };
        Insert: {
          affected_court_id?: string | null;
          affected_group_ids?: Json | null;
          affected_plan_entry_ids?: Json;
          affected_trainer_id?: string | null;
          affected_user_ids?: Json | null;
          club_id: string;
          conflict_time_slot?: Json | null;
          conflict_type: string;
          created_at?: string;
          description: string;
          detected_at?: string;
          detection_source?: string | null;
          id?: string;
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          season_id: string;
          severity?: string;
          status?: string;
          suggested_resolution?: string | null;
          updated_at?: string;
        };
        Update: {
          affected_court_id?: string | null;
          affected_group_ids?: Json | null;
          affected_plan_entry_ids?: Json;
          affected_trainer_id?: string | null;
          affected_user_ids?: Json | null;
          club_id?: string;
          conflict_time_slot?: Json | null;
          conflict_type?: string;
          created_at?: string;
          description?: string;
          detected_at?: string;
          detection_source?: string | null;
          id?: string;
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          season_id?: string;
          severity?: string;
          status?: string;
          suggested_resolution?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planning_conflicts_affected_court_id_fkey';
            columns: ['affected_court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_conflicts_affected_trainer_id_fkey';
            columns: ['affected_trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_conflicts_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_conflicts_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_conflicts_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      players: {
        Row: {
          created_at: string;
          elo_rating: number;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          elo_rating?: number;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          elo_rating?: number;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          advance_booking_days: number | null;
          applies_to: string | null;
          applies_to_groups: Json | null;
          applies_to_member_types: Json | null;
          club_id: string;
          court_id: string | null;
          created_at: string | null;
          days_of_week: number[] | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          max_booking_hours: number | null;
          min_booking_hours: number | null;
          name: string;
          price_per_hour: number | null;
          priority: number;
          rule_type: string | null;
          season_id: string | null;
          time_ranges: Json | null;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          advance_booking_days?: number | null;
          applies_to?: string | null;
          applies_to_groups?: Json | null;
          applies_to_member_types?: Json | null;
          club_id: string;
          court_id?: string | null;
          created_at?: string | null;
          days_of_week?: number[] | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_booking_hours?: number | null;
          min_booking_hours?: number | null;
          name: string;
          price_per_hour?: number | null;
          priority?: number;
          rule_type?: string | null;
          season_id?: string | null;
          time_ranges?: Json | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          advance_booking_days?: number | null;
          applies_to?: string | null;
          applies_to_groups?: Json | null;
          applies_to_member_types?: Json | null;
          club_id?: string;
          court_id?: string | null;
          created_at?: string | null;
          days_of_week?: number[] | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_booking_hours?: number | null;
          min_booking_hours?: number | null;
          name?: string;
          price_per_hour?: number | null;
          priority?: number;
          rule_type?: string | null;
          season_id?: string | null;
          time_ranges?: Json | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'pricing_rules_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_rules_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pricing_rules_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          club_id: string;
          created_at: string;
          endpoint: string;
          id: string;
          is_active: boolean;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          club_id: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          is_active?: boolean;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          club_id?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          is_active?: boolean;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      qr_checkins: {
        Row: {
          booking_id: string | null;
          checked_in_at: string | null;
          id: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          checked_in_at?: string | null;
          id?: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          checked_in_at?: string | null;
          id?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'qr_checkins_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'qr_checkins_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'qr_checkins_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_history: {
        Row: {
          changed_at: string;
          changed_by: string;
          club_id: string;
          id: string;
          new_rate: number;
          old_rate: number;
          reason: string | null;
          trainer_id: string;
          trainer_name: string;
        };
        Insert: {
          changed_at?: string;
          changed_by: string;
          club_id: string;
          id?: string;
          new_rate: number;
          old_rate: number;
          reason?: string | null;
          trainer_id: string;
          trainer_name: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string;
          club_id?: string;
          id?: string;
          new_rate?: number;
          old_rate?: number;
          reason?: string | null;
          trainer_id?: string;
          trainer_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rate_history_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rate_history_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      registration_requests: {
        Row: {
          city: string | null;
          club_id: string | null;
          created_at: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          motivation: string | null;
          phone: string | null;
          playing_level: string | null;
          postal_code: string | null;
          previous_club: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string | null;
          street: string | null;
          wants_trial_training: boolean | null;
        };
        Insert: {
          city?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          motivation?: string | null;
          phone?: string | null;
          playing_level?: string | null;
          postal_code?: string | null;
          previous_club?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string | null;
          street?: string | null;
          wants_trial_training?: boolean | null;
        };
        Update: {
          city?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          motivation?: string | null;
          phone?: string | null;
          playing_level?: string | null;
          postal_code?: string | null;
          previous_club?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string | null;
          street?: string | null;
          wants_trial_training?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'registration_requests_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'registration_requests_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      schedules: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          season_end_date: string;
          season_start_date: string;
          season_type: string;
          season_year: number;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          season_end_date: string;
          season_start_date: string;
          season_type: string;
          season_year: number;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          season_end_date?: string;
          season_start_date?: string;
          season_type?: string;
          season_year?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedules_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      schema_migrations: {
        Row: {
          applied_at: string;
          applied_by: string;
          baselined: boolean;
          checksum: string;
          filename: string;
        };
        Insert: {
          applied_at?: string;
          applied_by?: string;
          baselined?: boolean;
          checksum: string;
          filename: string;
        };
        Update: {
          applied_at?: string;
          applied_by?: string;
          baselined?: boolean;
          checksum?: string;
          filename?: string;
        };
        Relationships: [];
      };
      school_holidays: {
        Row: {
          bundesland: string;
          end_date: string;
          id: string;
          kind: string;
          name: string;
          start_date: string;
          year: number;
        };
        Insert: {
          bundesland: string;
          end_date: string;
          id?: string;
          kind?: string;
          name: string;
          start_date: string;
          year: number;
        };
        Update: {
          bundesland?: string;
          end_date?: string;
          id?: string;
          kind?: string;
          name?: string;
          start_date?: string;
          year?: number;
        };
        Relationships: [];
      };
      season_billing_configs: {
        Row: {
          additional_fees: Json | null;
          billing_model: string;
          club_id: string;
          cost_split_method: string;
          created_at: string;
          id: string;
          include_membership_fee: boolean;
          invoice_notes: string | null;
          membership_fee_amount: number | null;
          membership_fee_type: string | null;
          payment_terms_days: number;
          season_id: string;
          tax_rate: number;
          trainer_hourly_rate: number;
          updated_at: string;
          use_trainer_profile_rate: boolean;
        };
        Insert: {
          additional_fees?: Json | null;
          billing_model?: string;
          club_id: string;
          cost_split_method?: string;
          created_at?: string;
          id?: string;
          include_membership_fee?: boolean;
          invoice_notes?: string | null;
          membership_fee_amount?: number | null;
          membership_fee_type?: string | null;
          payment_terms_days?: number;
          season_id: string;
          tax_rate?: number;
          trainer_hourly_rate?: number;
          updated_at?: string;
          use_trainer_profile_rate?: boolean;
        };
        Update: {
          additional_fees?: Json | null;
          billing_model?: string;
          club_id?: string;
          cost_split_method?: string;
          created_at?: string;
          id?: string;
          include_membership_fee?: boolean;
          invoice_notes?: string | null;
          membership_fee_amount?: number | null;
          membership_fee_type?: string | null;
          payment_terms_days?: number;
          season_id?: string;
          tax_rate?: number;
          trainer_hourly_rate?: number;
          updated_at?: string;
          use_trainer_profile_rate?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'season_billing_configs_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_billing_configs_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: true;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_group_weeks: {
        Row: {
          club_id: string;
          created_at: string;
          group_id: string;
          id: string;
          is_active: boolean;
          reason: string | null;
          season_id: string;
          updated_at: string;
          week_monday: string;
          week_number: number;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          group_id: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          season_id: string;
          updated_at?: string;
          week_monday: string;
          week_number: number;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          season_id?: string;
          updated_at?: string;
          week_monday?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'season_group_weeks_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_group_weeks_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_group_weeks_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_plan_entries: {
        Row: {
          admin_notes: string | null;
          club_id: string;
          conflict_score: number | null;
          court_id: string | null;
          created_at: string;
          day_of_week: number;
          day_of_week_2: number | null;
          duration_minutes: number;
          end_time: string;
          ends_at_week: number | null;
          entry_type: string;
          expected_participants: Json | null;
          group_id: string | null;
          id: string;
          max_participants: number;
          notes: string | null;
          optimization_score: number | null;
          planning_source: string;
          preference_match_score: number | null;
          published_at: string | null;
          published_session_id: string | null;
          season_id: string;
          sessions_per_week: number;
          start_time: string;
          starts_from_week: number;
          status: string;
          substitute_from_week: number | null;
          substitute_to_week: number | null;
          substitute_trainer_id: string | null;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          club_id: string;
          conflict_score?: number | null;
          court_id?: string | null;
          created_at?: string;
          day_of_week: number;
          day_of_week_2?: number | null;
          duration_minutes: number;
          end_time: string;
          ends_at_week?: number | null;
          entry_type?: string;
          expected_participants?: Json | null;
          group_id?: string | null;
          id?: string;
          max_participants?: number;
          notes?: string | null;
          optimization_score?: number | null;
          planning_source?: string;
          preference_match_score?: number | null;
          published_at?: string | null;
          published_session_id?: string | null;
          season_id: string;
          sessions_per_week?: number;
          start_time: string;
          starts_from_week?: number;
          status?: string;
          substitute_from_week?: number | null;
          substitute_to_week?: number | null;
          substitute_trainer_id?: string | null;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          club_id?: string;
          conflict_score?: number | null;
          court_id?: string | null;
          created_at?: string;
          day_of_week?: number;
          day_of_week_2?: number | null;
          duration_minutes?: number;
          end_time?: string;
          ends_at_week?: number | null;
          entry_type?: string;
          expected_participants?: Json | null;
          group_id?: string | null;
          id?: string;
          max_participants?: number;
          notes?: string | null;
          optimization_score?: number | null;
          planning_source?: string;
          preference_match_score?: number | null;
          published_at?: string | null;
          published_session_id?: string | null;
          season_id?: string;
          sessions_per_week?: number;
          start_time?: string;
          starts_from_week?: number;
          status?: string;
          substitute_from_week?: number | null;
          substitute_to_week?: number | null;
          substitute_trainer_id?: string | null;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'season_plan_entries_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_group_id_groups_id_fk';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_published_session_id_fkey';
            columns: ['published_session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_substitute_trainer_id_fkey';
            columns: ['substitute_trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_entries_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      season_plan_versions: {
        Row: {
          club_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          season_id: string;
          slots: Json;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          season_id: string;
          slots?: Json;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          season_id?: string;
          slots?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'season_plan_versions_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_plan_versions_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_planning_configs: {
        Row: {
          ai_clustering_enabled: boolean;
          avoid_high_failure_slots: boolean;
          backtrack_depth: number;
          club_id: string;
          created_at: string;
          group_max_size: number;
          group_min_size: number;
          id: string;
          kids_group_max_size: number;
          kids_group_min_size: number;
          max_niveau_level_steps: number;
          max_niveau_span_advanced_months: number;
          max_niveau_span_beginner_months: number;
          prefer_historic_groups: boolean;
          proven_group_attendance_threshold_pct: number;
          season_id: string | null;
          slot_duration_minutes: number;
          slot_failure_rate_threshold_pct: number;
          trainer_utilization_max_pct: number;
          treat_high_failure_as_hard: boolean;
          unassigned_rate_threshold: number;
          updated_at: string;
          waitlist_priority_rule: string;
        };
        Insert: {
          ai_clustering_enabled?: boolean;
          avoid_high_failure_slots?: boolean;
          backtrack_depth?: number;
          club_id: string;
          created_at?: string;
          group_max_size?: number;
          group_min_size?: number;
          id?: string;
          kids_group_max_size?: number;
          kids_group_min_size?: number;
          max_niveau_level_steps?: number;
          max_niveau_span_advanced_months?: number;
          max_niveau_span_beginner_months?: number;
          prefer_historic_groups?: boolean;
          proven_group_attendance_threshold_pct?: number;
          season_id?: string | null;
          slot_duration_minutes?: number;
          slot_failure_rate_threshold_pct?: number;
          trainer_utilization_max_pct?: number;
          treat_high_failure_as_hard?: boolean;
          unassigned_rate_threshold?: number;
          updated_at?: string;
          waitlist_priority_rule?: string;
        };
        Update: {
          ai_clustering_enabled?: boolean;
          avoid_high_failure_slots?: boolean;
          backtrack_depth?: number;
          club_id?: string;
          created_at?: string;
          group_max_size?: number;
          group_min_size?: number;
          id?: string;
          kids_group_max_size?: number;
          kids_group_min_size?: number;
          max_niveau_level_steps?: number;
          max_niveau_span_advanced_months?: number;
          max_niveau_span_beginner_months?: number;
          prefer_historic_groups?: boolean;
          proven_group_attendance_threshold_pct?: number;
          season_id?: string | null;
          slot_duration_minutes?: number;
          slot_failure_rate_threshold_pct?: number;
          trainer_utilization_max_pct?: number;
          treat_high_failure_as_hard?: boolean;
          unassigned_rate_threshold?: number;
          updated_at?: string;
          waitlist_priority_rule?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'season_planning_configs_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_planning_configs_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_planning_history: {
        Row: {
          action_type: string;
          actor_id: string | null;
          actor_role: string | null;
          algorithm_metrics: Json | null;
          changed_by: string | null;
          changed_by_role: string | null;
          changes: Json | null;
          club_id: string;
          conflicts_created: number | null;
          conflicts_resolved: number | null;
          created_at: string;
          details: Json | null;
          entity_id: string | null;
          entity_type: string | null;
          entries_affected: number | null;
          id: string;
          notes: string | null;
          season_id: string;
        };
        Insert: {
          action_type: string;
          actor_id?: string | null;
          actor_role?: string | null;
          algorithm_metrics?: Json | null;
          changed_by?: string | null;
          changed_by_role?: string | null;
          changes?: Json | null;
          club_id: string;
          conflicts_created?: number | null;
          conflicts_resolved?: number | null;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          entries_affected?: number | null;
          id?: string;
          notes?: string | null;
          season_id: string;
        };
        Update: {
          action_type?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          algorithm_metrics?: Json | null;
          changed_by?: string | null;
          changed_by_role?: string | null;
          changes?: Json | null;
          club_id?: string;
          conflicts_created?: number | null;
          conflicts_resolved?: number | null;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          entries_affected?: number | null;
          id?: string;
          notes?: string | null;
          season_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'season_planning_history_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_planning_history_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_planning_history_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_statistics: {
        Row: {
          attendance_by_group: Json | null;
          attendance_by_trainer: Json | null;
          avg_group_size: number | null;
          avg_niveau_span_months: number | null;
          avg_waitlist_duration_days: number | null;
          club_id: string;
          computed_at: string;
          conflicts_resolved: number;
          created_at: string;
          critical_conflicts: number;
          groups_below_min_size: number;
          id: string;
          level_upgrades_applied: number;
          level_upgrades_recommended: number;
          niveau_span_violations: number;
          overall_attendance_quote: number | null;
          preference_satisfaction_score: number | null;
          preferences_submitted: number;
          preferences_total: number;
          season_id: string;
          slot_failure_rates: Json | null;
          total_conflicts_detected: number;
          total_groups: number;
          total_members_planned: number;
          total_waitlist_entries: number;
          trainer_burnout_warnings: number;
          trainer_utilization_avg: number | null;
          waitlist_acceptance_rate: number | null;
          wish_partner_fulfilled: number;
          wish_partner_fulfillment_rate: number | null;
          wish_partner_requests: number;
        };
        Insert: {
          attendance_by_group?: Json | null;
          attendance_by_trainer?: Json | null;
          avg_group_size?: number | null;
          avg_niveau_span_months?: number | null;
          avg_waitlist_duration_days?: number | null;
          club_id: string;
          computed_at?: string;
          conflicts_resolved?: number;
          created_at?: string;
          critical_conflicts?: number;
          groups_below_min_size?: number;
          id?: string;
          level_upgrades_applied?: number;
          level_upgrades_recommended?: number;
          niveau_span_violations?: number;
          overall_attendance_quote?: number | null;
          preference_satisfaction_score?: number | null;
          preferences_submitted?: number;
          preferences_total?: number;
          season_id: string;
          slot_failure_rates?: Json | null;
          total_conflicts_detected?: number;
          total_groups?: number;
          total_members_planned?: number;
          total_waitlist_entries?: number;
          trainer_burnout_warnings?: number;
          trainer_utilization_avg?: number | null;
          waitlist_acceptance_rate?: number | null;
          wish_partner_fulfilled?: number;
          wish_partner_fulfillment_rate?: number | null;
          wish_partner_requests?: number;
        };
        Update: {
          attendance_by_group?: Json | null;
          attendance_by_trainer?: Json | null;
          avg_group_size?: number | null;
          avg_niveau_span_months?: number | null;
          avg_waitlist_duration_days?: number | null;
          club_id?: string;
          computed_at?: string;
          conflicts_resolved?: number;
          created_at?: string;
          critical_conflicts?: number;
          groups_below_min_size?: number;
          id?: string;
          level_upgrades_applied?: number;
          level_upgrades_recommended?: number;
          niveau_span_violations?: number;
          overall_attendance_quote?: number | null;
          preference_satisfaction_score?: number | null;
          preferences_submitted?: number;
          preferences_total?: number;
          season_id?: string;
          slot_failure_rates?: Json | null;
          total_conflicts_detected?: number;
          total_groups?: number;
          total_members_planned?: number;
          total_waitlist_entries?: number;
          trainer_burnout_warnings?: number;
          trainer_utilization_avg?: number | null;
          waitlist_acceptance_rate?: number | null;
          wish_partner_fulfilled?: number;
          wish_partner_fulfillment_rate?: number | null;
          wish_partner_requests?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'season_statistics_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_statistics_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      season_waitlists: {
        Row: {
          accepted_at: string | null;
          alternative_assigned_at: string | null;
          alternative_group_id: string | null;
          club_id: string;
          created_at: string;
          group_id: string;
          id: string;
          member_id: string;
          notes: string | null;
          notified_at: string | null;
          position: number;
          priority: number;
          priority_reason: string | null;
          registered_at: string;
          season_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          alternative_assigned_at?: string | null;
          alternative_group_id?: string | null;
          club_id: string;
          created_at?: string;
          group_id: string;
          id?: string;
          member_id: string;
          notes?: string | null;
          notified_at?: string | null;
          position: number;
          priority?: number;
          priority_reason?: string | null;
          registered_at?: string;
          season_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          alternative_assigned_at?: string | null;
          alternative_group_id?: string | null;
          club_id?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          member_id?: string;
          notes?: string | null;
          notified_at?: string | null;
          position?: number;
          priority?: number;
          priority_reason?: string | null;
          registered_at?: string;
          season_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'season_waitlists_alternative_group_id_fkey';
            columns: ['alternative_group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_waitlists_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_waitlists_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_waitlists_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'season_waitlists_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      seasons: {
        Row: {
          auto_plan_config: Json | null;
          auto_plan_enabled: boolean;
          club_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_date: string;
          id: string;
          is_active: boolean;
          last_planned_at: string | null;
          name: string;
          notes: string | null;
          planning_status: string;
          preferences_deadline: string | null;
          preferences_open: boolean;
          published_at: string | null;
          season_type: string;
          start_date: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          auto_plan_config?: Json | null;
          auto_plan_enabled?: boolean;
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date: string;
          id?: string;
          is_active?: boolean;
          last_planned_at?: string | null;
          name: string;
          notes?: string | null;
          planning_status?: string;
          preferences_deadline?: string | null;
          preferences_open?: boolean;
          published_at?: string | null;
          season_type: string;
          start_date: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          auto_plan_config?: Json | null;
          auto_plan_enabled?: boolean;
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          last_planned_at?: string | null;
          name?: string;
          notes?: string | null;
          planning_status?: string;
          preferences_deadline?: string | null;
          preferences_open?: boolean;
          published_at?: string | null;
          season_type?: string;
          start_date?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'seasons_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'seasons_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      sepa_mandates: {
        Row: {
          account_holder: string;
          address: Json;
          bank_name: string;
          bic: string;
          club_id: string | null;
          created_at: string;
          creditor_id: string;
          iban: string;
          id: string;
          is_active: boolean;
          mandate_reference: string;
          member_id: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          signature_date: string;
        };
        Insert: {
          account_holder: string;
          address: Json;
          bank_name: string;
          bic: string;
          club_id?: string | null;
          created_at?: string;
          creditor_id?: string;
          iban: string;
          id?: string;
          is_active?: boolean;
          mandate_reference: string;
          member_id: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          signature_date: string;
        };
        Update: {
          account_holder?: string;
          address?: Json;
          bank_name?: string;
          bic?: string;
          club_id?: string | null;
          created_at?: string;
          creditor_id?: string;
          iban?: string;
          id?: string;
          is_active?: boolean;
          mandate_reference?: string;
          member_id?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          signature_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sepa_mandates_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      session_rsvps: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          member_id: string;
          notes: string | null;
          reminded_at: string | null;
          responded_at: string | null;
          session_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
          notes?: string | null;
          reminded_at?: string | null;
          responded_at?: string | null;
          session_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
          notes?: string | null;
          reminded_at?: string | null;
          responded_at?: string | null;
          session_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_rsvps_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_rsvps_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_rsvps_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      session_waitlist: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          member_id: string;
          notified_at: string | null;
          position: number;
          session_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
          notified_at?: string | null;
          position: number;
          session_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
          notified_at?: string | null;
          position?: number;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_waitlist_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          court_id: string | null;
          created_at: string;
          group_ids: Json;
          id: string;
          max_participants: number;
          notes: string | null;
          plan_entry_id: string | null;
          schedule_id: string;
          session_type: string;
          status: string;
          timeslot_end: string;
          timeslot_start: string;
          trainer_id: string | null;
          updated_at: string;
          week_number: number;
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          court_id?: string | null;
          created_at?: string;
          group_ids: Json;
          id?: string;
          max_participants?: number;
          notes?: string | null;
          plan_entry_id?: string | null;
          schedule_id: string;
          session_type?: string;
          status?: string;
          timeslot_end: string;
          timeslot_start: string;
          trainer_id?: string | null;
          updated_at?: string;
          week_number: number;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          court_id?: string | null;
          created_at?: string;
          group_ids?: Json;
          id?: string;
          max_participants?: number;
          notes?: string | null;
          plan_entry_id?: string | null;
          schedule_id?: string;
          session_type?: string;
          status?: string;
          timeslot_end?: string;
          timeslot_start?: string;
          trainer_id?: string | null;
          updated_at?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_court_id_courts_id_fk';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_plan_entry_id_fkey';
            columns: ['plan_entry_id'];
            isOneToOne: false;
            referencedRelation: 'season_plan_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_schedule_id_schedules_id_fk';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_trainer_id_trainers_id_fk';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      shop_orders: {
        Row: {
          created_at: string | null;
          id: string;
          items: Json | null;
          payment_status: string | null;
          status: string | null;
          total_amount: number;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          items?: Json | null;
          payment_status?: string | null;
          status?: string | null;
          total_amount: number;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          items?: Json | null;
          payment_status?: string | null;
          status?: string | null;
          total_amount?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shop_orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      shop_products: {
        Row: {
          category: string | null;
          club_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean | null;
          name: string;
          price: number;
          stock: number | null;
        };
        Insert: {
          category?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          name: string;
          price: number;
          stock?: number | null;
        };
        Update: {
          category?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean | null;
          name?: string;
          price?: number;
          stock?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shop_products_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      special_event_registrations: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          notes: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          notes?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          notes?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'special_event_registrations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'special_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'special_event_registrations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      special_events: {
        Row: {
          age_groups: string[] | null;
          club_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_date: string;
          end_time: string | null;
          event_type: Database['public']['Enums']['special_event_type'];
          id: string;
          location: string | null;
          max_participants: number;
          name: string;
          notes: string | null;
          price_per_person: number;
          skill_levels: string[] | null;
          start_date: string;
          start_time: string | null;
          status: Database['public']['Enums']['special_event_status'];
          trainer_id: string | null;
          updated_at: string;
        };
        Insert: {
          age_groups?: string[] | null;
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date: string;
          end_time?: string | null;
          event_type?: Database['public']['Enums']['special_event_type'];
          id?: string;
          location?: string | null;
          max_participants?: number;
          name: string;
          notes?: string | null;
          price_per_person?: number;
          skill_levels?: string[] | null;
          start_date: string;
          start_time?: string | null;
          status?: Database['public']['Enums']['special_event_status'];
          trainer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          age_groups?: string[] | null;
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_date?: string;
          end_time?: string | null;
          event_type?: Database['public']['Enums']['special_event_type'];
          id?: string;
          location?: string | null;
          max_participants?: number;
          name?: string;
          notes?: string | null;
          price_per_person?: number;
          skill_levels?: string[] | null;
          start_date?: string;
          start_time?: string | null;
          status?: Database['public']['Enums']['special_event_status'];
          trainer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'special_events_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'special_events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'special_events_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          processed_at: string;
          stripe_event_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          processed_at?: string;
          stripe_event_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          processed_at?: string;
          stripe_event_id?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          category: string;
          club_id: string | null;
          description: string | null;
          id: string;
          is_public: boolean;
          is_required: boolean;
          key: string;
          type: string;
          updated_at: string;
          updated_by: string | null;
          validation: Json | null;
          value: string;
        };
        Insert: {
          category: string;
          club_id?: string | null;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          is_required?: boolean;
          key: string;
          type: string;
          updated_at?: string;
          updated_by?: string | null;
          validation?: Json | null;
          value: string;
        };
        Update: {
          category?: string;
          club_id?: string | null;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          is_required?: boolean;
          key?: string;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
          validation?: Json | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'system_settings_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'system_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          member_id: string;
          position_number: number | null;
          role: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          member_id: string;
          position_number?: number | null;
          role?: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          member_id?: string;
          position_number?: number | null;
          role?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          captain_id: string | null;
          club_id: string;
          created_at: string;
          id: string;
          league_id: string;
          matches_drawn: number;
          matches_lost: number;
          matches_played: number;
          matches_won: number;
          name: string;
          notes: string | null;
          points: number;
          position: number | null;
          updated_at: string;
        };
        Insert: {
          captain_id?: string | null;
          club_id: string;
          created_at?: string;
          id?: string;
          league_id: string;
          matches_drawn?: number;
          matches_lost?: number;
          matches_played?: number;
          matches_won?: number;
          name: string;
          notes?: string | null;
          points?: number;
          position?: number | null;
          updated_at?: string;
        };
        Update: {
          captain_id?: string | null;
          club_id?: string;
          created_at?: string;
          id?: string;
          league_id?: string;
          matches_drawn?: number;
          matches_lost?: number;
          matches_played?: number;
          matches_won?: number;
          name?: string;
          notes?: string | null;
          points?: number;
          position?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'teams_league_id_fkey';
            columns: ['league_id'];
            isOneToOne: false;
            referencedRelation: 'leagues';
            referencedColumns: ['id'];
          },
        ];
      };
      tournament_matches: {
        Row: {
          court_id: string | null;
          created_at: string | null;
          id: string;
          match_number: number;
          player1_id: string | null;
          player2_id: string | null;
          round: number;
          scheduled_at: string | null;
          score: string | null;
          status: string | null;
          tournament_id: string;
          winner_id: string | null;
        };
        Insert: {
          court_id?: string | null;
          created_at?: string | null;
          id?: string;
          match_number: number;
          player1_id?: string | null;
          player2_id?: string | null;
          round: number;
          scheduled_at?: string | null;
          score?: string | null;
          status?: string | null;
          tournament_id: string;
          winner_id?: string | null;
        };
        Update: {
          court_id?: string | null;
          created_at?: string | null;
          id?: string;
          match_number?: number;
          player1_id?: string | null;
          player2_id?: string | null;
          round?: number;
          scheduled_at?: string | null;
          score?: string | null;
          status?: string | null;
          tournament_id?: string;
          winner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_matches_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_matches_player1_id_fkey';
            columns: ['player1_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_matches_player2_id_fkey';
            columns: ['player2_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_matches_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_matches_winner_id_fkey';
            columns: ['winner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      tournament_registrations: {
        Row: {
          id: string;
          notes: string | null;
          partner_id: string | null;
          payment_status: string | null;
          registration_date: string | null;
          seed: number | null;
          status: string | null;
          tournament_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          notes?: string | null;
          partner_id?: string | null;
          payment_status?: string | null;
          registration_date?: string | null;
          seed?: number | null;
          status?: string | null;
          tournament_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          notes?: string | null;
          partner_id?: string | null;
          payment_status?: string | null;
          registration_date?: string | null;
          seed?: number | null;
          status?: string | null;
          tournament_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tournament_registrations_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_registrations_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournament_registrations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      tournaments: {
        Row: {
          category: string | null;
          club_id: string;
          created_at: string | null;
          description: string | null;
          end_date: string | null;
          entry_fee: number | null;
          format: string | null;
          id: string;
          max_participants: number | null;
          name: string;
          organizer_id: string | null;
          prize_info: string | null;
          registration_deadline: string | null;
          start_date: string;
          status: string | null;
          surface: string | null;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          club_id: string;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          entry_fee?: number | null;
          format?: string | null;
          id?: string;
          max_participants?: number | null;
          name: string;
          organizer_id?: string | null;
          prize_info?: string | null;
          registration_deadline?: string | null;
          start_date: string;
          status?: string | null;
          surface?: string | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          club_id?: string;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          entry_fee?: number | null;
          format?: string | null;
          id?: string;
          max_participants?: number | null;
          name?: string;
          organizer_id?: string | null;
          prize_info?: string | null;
          registration_deadline?: string | null;
          start_date?: string;
          status?: string | null;
          surface?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tournaments_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tournaments_organizer_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_absences: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          club_id: string;
          created_at: string;
          end_date: string;
          id: string;
          notes: string | null;
          reason: string | null;
          start_date: string;
          status: string;
          substitute_trainer_id: string | null;
          trainer_id: string;
          trainer_name: string;
          type: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          club_id: string;
          created_at?: string;
          end_date: string;
          id?: string;
          notes?: string | null;
          reason?: string | null;
          start_date: string;
          status?: string;
          substitute_trainer_id?: string | null;
          trainer_id: string;
          trainer_name: string;
          type: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          club_id?: string;
          created_at?: string;
          end_date?: string;
          id?: string;
          notes?: string | null;
          reason?: string | null;
          start_date?: string;
          status?: string;
          substitute_trainer_id?: string | null;
          trainer_id?: string;
          trainer_name?: string;
          type?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_absences_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_absences_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_absences_substitute_trainer_id_fkey';
            columns: ['substitute_trainer_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_absences_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_absences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_assignments: {
        Row: {
          bio: string | null;
          club_id: string;
          created_at: string;
          end_date: string | null;
          hourly_rate: number | null;
          id: string;
          is_active: boolean;
          languages: string[] | null;
          max_students_per_session: number | null;
          qualifications: string[] | null;
          specialization: string[] | null;
          start_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio?: string | null;
          club_id: string;
          created_at?: string;
          end_date?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean;
          languages?: string[] | null;
          max_students_per_session?: number | null;
          qualifications?: string[] | null;
          specialization?: string[] | null;
          start_date?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string | null;
          club_id?: string;
          created_at?: string;
          end_date?: string | null;
          hourly_rate?: number | null;
          id?: string;
          is_active?: boolean;
          languages?: string[] | null;
          max_students_per_session?: number | null;
          qualifications?: string[] | null;
          specialization?: string[] | null;
          start_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_assignments_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_assignments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_availabilities: {
        Row: {
          created_at: string;
          date: string;
          end_time: string;
          id: string;
          notes: string | null;
          recurring_pattern: Json | null;
          start_time: string;
          status: string;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          end_time: string;
          id?: string;
          notes?: string | null;
          recurring_pattern?: Json | null;
          start_time: string;
          status?: string;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          end_time?: string;
          id?: string;
          notes?: string | null;
          recurring_pattern?: Json | null;
          start_time?: string;
          status?: string;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_availabilities_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_billings: {
        Row: {
          billing_period_id: string;
          created_at: string;
          due_date: string | null;
          hourly_rate: number;
          id: string;
          invoice_id: string | null;
          invoice_number: string | null;
          notes: string | null;
          paid_at: string | null;
          status: string;
          tax_free_amount: number;
          taxable_amount: number;
          total_amount: number;
          total_hours: number;
          trainer_id: string;
          trainer_name: string;
          updated_at: string;
        };
        Insert: {
          billing_period_id: string;
          created_at?: string;
          due_date?: string | null;
          hourly_rate: number;
          id?: string;
          invoice_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          status?: string;
          tax_free_amount?: number;
          taxable_amount?: number;
          total_amount: number;
          total_hours: number;
          trainer_id: string;
          trainer_name: string;
          updated_at?: string;
        };
        Update: {
          billing_period_id?: string;
          created_at?: string;
          due_date?: string | null;
          hourly_rate?: number;
          id?: string;
          invoice_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          status?: string;
          tax_free_amount?: number;
          taxable_amount?: number;
          total_amount?: number;
          total_hours?: number;
          trainer_id?: string;
          trainer_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_billings_billing_period_id_fkey';
            columns: ['billing_period_id'];
            isOneToOne: false;
            referencedRelation: 'billing_periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_billings_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_club: {
        Row: {
          club_id: string;
          created_at: string;
          trainer_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          trainer_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_club_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_club_trainer_id_trainers_id_fk';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_feedback: {
        Row: {
          areas_for_improvement: Json | null;
          attendance_quote: number | null;
          club_id: string;
          comment: string | null;
          communication: number | null;
          created_at: string | null;
          flagged_reason: string | null;
          group_id: string | null;
          id: string;
          is_flagged: boolean | null;
          is_submitted: boolean;
          is_visible: boolean | null;
          member_id: string;
          moderated_at: string | null;
          moderated_by: string | null;
          motivation: number | null;
          notes: string | null;
          performance_rating: number | null;
          punctuality: number | null;
          rating: number;
          ready_for_next_level: string | null;
          recommended_level: string | null;
          season_id: string | null;
          session_id: string | null;
          strengths: Json | null;
          submitted_at: string | null;
          teaching_quality: number | null;
          trainer_id: string;
          updated_at: string | null;
        };
        Insert: {
          areas_for_improvement?: Json | null;
          attendance_quote?: number | null;
          club_id: string;
          comment?: string | null;
          communication?: number | null;
          created_at?: string | null;
          flagged_reason?: string | null;
          group_id?: string | null;
          id?: string;
          is_flagged?: boolean | null;
          is_submitted?: boolean;
          is_visible?: boolean | null;
          member_id: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          motivation?: number | null;
          notes?: string | null;
          performance_rating?: number | null;
          punctuality?: number | null;
          rating: number;
          ready_for_next_level?: string | null;
          recommended_level?: string | null;
          season_id?: string | null;
          session_id?: string | null;
          strengths?: Json | null;
          submitted_at?: string | null;
          teaching_quality?: number | null;
          trainer_id: string;
          updated_at?: string | null;
        };
        Update: {
          areas_for_improvement?: Json | null;
          attendance_quote?: number | null;
          club_id?: string;
          comment?: string | null;
          communication?: number | null;
          created_at?: string | null;
          flagged_reason?: string | null;
          group_id?: string | null;
          id?: string;
          is_flagged?: boolean | null;
          is_submitted?: boolean;
          is_visible?: boolean | null;
          member_id?: string;
          moderated_at?: string | null;
          moderated_by?: string | null;
          motivation?: number | null;
          notes?: string | null;
          performance_rating?: number | null;
          punctuality?: number | null;
          rating?: number;
          ready_for_next_level?: string | null;
          recommended_level?: string | null;
          season_id?: string | null;
          session_id?: string | null;
          strengths?: Json | null;
          submitted_at?: string | null;
          teaching_quality?: number | null;
          trainer_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_feedback_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_feedback_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_hourly_rates: {
        Row: {
          base_rate: number;
          club_id: string;
          created_at: string;
          effective_rate: number;
          id: string;
          override_rate: number | null;
          reason: string | null;
          trainer_id: string;
          trainer_name: string;
          updated_at: string;
          valid_from: string;
          valid_until: string | null;
        };
        Insert: {
          base_rate: number;
          club_id: string;
          created_at?: string;
          effective_rate: number;
          id?: string;
          override_rate?: number | null;
          reason?: string | null;
          trainer_id: string;
          trainer_name: string;
          updated_at?: string;
          valid_from: string;
          valid_until?: string | null;
        };
        Update: {
          base_rate?: number;
          club_id?: string;
          created_at?: string;
          effective_rate?: number;
          id?: string;
          override_rate?: number | null;
          reason?: string | null;
          trainer_id?: string;
          trainer_name?: string;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_hourly_rates_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_hourly_rates_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_member_notes: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          member_id: string;
          note: string;
          trainer_id: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
          note: string;
          trainer_id: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
          note?: string;
          trainer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_member_notes_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_member_notes_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_profiles: {
        Row: {
          availability: Json;
          bio: string | null;
          club_id: string;
          contracted_hourly_rate: number | null;
          created_at: string;
          date_of_birth: string;
          email: string;
          emergency_contact: Json;
          experience: Json;
          extra_hours_rate: number | null;
          first_name: string;
          hourly_rate: number | null;
          id: string;
          languages: Json;
          last_name: string;
          phone: string;
          preferred_time_slots: Json;
          profile_image_url: string | null;
          qualifications: Json;
          specializations: Json;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          availability?: Json;
          bio?: string | null;
          club_id: string;
          contracted_hourly_rate?: number | null;
          created_at?: string;
          date_of_birth: string;
          email: string;
          emergency_contact?: Json;
          experience?: Json;
          extra_hours_rate?: number | null;
          first_name: string;
          hourly_rate?: number | null;
          id?: string;
          languages?: Json;
          last_name: string;
          phone: string;
          preferred_time_slots?: Json;
          profile_image_url?: string | null;
          qualifications?: Json;
          specializations?: Json;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          availability?: Json;
          bio?: string | null;
          club_id?: string;
          contracted_hourly_rate?: number | null;
          created_at?: string;
          date_of_birth?: string;
          email?: string;
          emergency_contact?: Json;
          experience?: Json;
          extra_hours_rate?: number | null;
          first_name?: string;
          hourly_rate?: number | null;
          id?: string;
          languages?: Json;
          last_name?: string;
          phone?: string;
          preferred_time_slots?: Json;
          profile_image_url?: string | null;
          qualifications?: Json;
          specializations?: Json;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_profiles_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_rating_summary: {
        Row: {
          average_rating: number | null;
          avg_communication: number | null;
          avg_motivation: number | null;
          avg_punctuality: number | null;
          avg_teaching_quality: number | null;
          club_id: string;
          last_updated: string | null;
          rating_1_count: number | null;
          rating_2_count: number | null;
          rating_3_count: number | null;
          rating_4_count: number | null;
          rating_5_count: number | null;
          total_ratings: number | null;
          trainer_id: string;
        };
        Insert: {
          average_rating?: number | null;
          avg_communication?: number | null;
          avg_motivation?: number | null;
          avg_punctuality?: number | null;
          avg_teaching_quality?: number | null;
          club_id: string;
          last_updated?: string | null;
          rating_1_count?: number | null;
          rating_2_count?: number | null;
          rating_3_count?: number | null;
          rating_4_count?: number | null;
          rating_5_count?: number | null;
          total_ratings?: number | null;
          trainer_id: string;
        };
        Update: {
          average_rating?: number | null;
          avg_communication?: number | null;
          avg_motivation?: number | null;
          avg_punctuality?: number | null;
          avg_teaching_quality?: number | null;
          club_id?: string;
          last_updated?: string | null;
          rating_1_count?: number | null;
          rating_2_count?: number | null;
          rating_3_count?: number | null;
          rating_4_count?: number | null;
          rating_5_count?: number | null;
          total_ratings?: number | null;
          trainer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_rating_summary_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trainer_rating_summary_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trainer_slot_waitlist: {
        Row: {
          created_at: string;
          id: string;
          slot_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          slot_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          slot_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trainer_slot_waitlist_slot_id_fkey';
            columns: ['slot_id'];
            isOneToOne: false;
            referencedRelation: 'trainer_availabilities';
            referencedColumns: ['id'];
          },
        ];
      };
      trainers: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_active: boolean;
          max_hours_per_week: number;
          name: string;
          specialties: Json;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          is_active?: boolean;
          max_hours_per_week?: number;
          name: string;
          specialties?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
          max_hours_per_week?: number;
          name?: string;
          specialties?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trainers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      trial_trainings: {
        Row: {
          club_id: string;
          completed_at: string | null;
          converted_to_member_id: string | null;
          court_id: string;
          court_name: string;
          created_at: string;
          duration: number;
          feedback_comments: string | null;
          feedback_rating: number | null;
          feedback_would_recommend: boolean | null;
          followup_stage: number;
          id: string;
          marketing_consent: boolean;
          marketing_consent_confirmed_at: string | null;
          marketing_consent_token: string | null;
          notes: string | null;
          participant_date_of_birth: string;
          participant_email: string;
          participant_first_name: string;
          participant_id: string;
          participant_last_name: string;
          participant_phone: string;
          scheduled_date: string;
          scheduled_time: string;
          status: string;
          trainer_id: string;
          trainer_name: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          completed_at?: string | null;
          converted_to_member_id?: string | null;
          court_id: string;
          court_name: string;
          created_at?: string;
          duration: number;
          feedback_comments?: string | null;
          feedback_rating?: number | null;
          feedback_would_recommend?: boolean | null;
          followup_stage?: number;
          id?: string;
          marketing_consent?: boolean;
          marketing_consent_confirmed_at?: string | null;
          marketing_consent_token?: string | null;
          notes?: string | null;
          participant_date_of_birth: string;
          participant_email: string;
          participant_first_name: string;
          participant_id?: string;
          participant_last_name: string;
          participant_phone: string;
          scheduled_date: string;
          scheduled_time: string;
          status?: string;
          trainer_id: string;
          trainer_name: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          completed_at?: string | null;
          converted_to_member_id?: string | null;
          court_id?: string;
          court_name?: string;
          created_at?: string;
          duration?: number;
          feedback_comments?: string | null;
          feedback_rating?: number | null;
          feedback_would_recommend?: boolean | null;
          followup_stage?: number;
          id?: string;
          marketing_consent?: boolean;
          marketing_consent_confirmed_at?: string | null;
          marketing_consent_token?: string | null;
          notes?: string | null;
          participant_date_of_birth?: string;
          participant_email?: string;
          participant_first_name?: string;
          participant_id?: string;
          participant_last_name?: string;
          participant_phone?: string;
          scheduled_date?: string;
          scheduled_time?: string;
          status?: string;
          trainer_id?: string;
          trainer_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trial_trainings_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trial_trainings_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trial_trainings_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
      user_club_memberships: {
        Row: {
          club_id: string | null;
          created_at: string;
          deactivated_at: string | null;
          deactivated_by: string | null;
          fee_configuration_id: string | null;
          honorary_since: string | null;
          id: string;
          include_in_planning: boolean;
          is_active: boolean;
          is_honorary: boolean;
          joined_at: string;
          last_reactivation_sent_at: string | null;
          member_number: number | null;
          office_flags: Json;
          reactivation_count: number;
          role: string;
          status: string | null;
          tenant_id: string | null;
          user_id: string;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          fee_configuration_id?: string | null;
          honorary_since?: string | null;
          id?: string;
          include_in_planning?: boolean;
          is_active?: boolean;
          is_honorary?: boolean;
          joined_at?: string;
          last_reactivation_sent_at?: string | null;
          member_number?: number | null;
          office_flags?: Json;
          reactivation_count?: number;
          role?: string;
          status?: string | null;
          tenant_id?: string | null;
          user_id: string;
        };
        Update: {
          club_id?: string | null;
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          fee_configuration_id?: string | null;
          honorary_since?: string | null;
          id?: string;
          include_in_planning?: boolean;
          is_active?: boolean;
          is_honorary?: boolean;
          joined_at?: string;
          last_reactivation_sent_at?: string | null;
          member_number?: number | null;
          office_flags?: Json;
          reactivation_count?: number;
          role?: string;
          status?: string | null;
          tenant_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_club_memberships_club_id_clubs_id_fk';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_club_memberships_deactivated_by_fkey';
            columns: ['deactivated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_club_memberships_fee_configuration_id_fkey';
            columns: ['fee_configuration_id'];
            isOneToOne: false;
            referencedRelation: 'fee_configurations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_club_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_dashboard_preferences: {
        Row: {
          club_id: string | null;
          created_at: string;
          dashboard_type: string;
          id: string;
          layout: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string;
          dashboard_type: string;
          id?: string;
          layout?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          club_id?: string | null;
          created_at?: string;
          dashboard_type?: string;
          id?: string;
          layout?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_dashboard_preferences_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      user_training_preferences: {
        Row: {
          avoid_member_ids: Json | null;
          can_teach_groups: Json | null;
          club_id: string;
          created_at: string;
          id: string;
          is_submitted: boolean;
          last_modified_at: string | null;
          max_sessions_per_week: number | null;
          notes: string | null;
          preferred_age_group: string | null;
          preferred_court_ids: Json | null;
          preferred_group_ids: Json | null;
          preferred_level: string | null;
          priority: number;
          season_id: string;
          self_assessed_level: string | null;
          special_requests: string | null;
          submitted_at: string | null;
          unavailable_dates: Json | null;
          updated_at: string;
          user_id: string;
          user_role: string;
          weekly_availability: Json;
          wish_partner_ids: Json | null;
        };
        Insert: {
          avoid_member_ids?: Json | null;
          can_teach_groups?: Json | null;
          club_id: string;
          created_at?: string;
          id?: string;
          is_submitted?: boolean;
          last_modified_at?: string | null;
          max_sessions_per_week?: number | null;
          notes?: string | null;
          preferred_age_group?: string | null;
          preferred_court_ids?: Json | null;
          preferred_group_ids?: Json | null;
          preferred_level?: string | null;
          priority?: number;
          season_id: string;
          self_assessed_level?: string | null;
          special_requests?: string | null;
          submitted_at?: string | null;
          unavailable_dates?: Json | null;
          updated_at?: string;
          user_id: string;
          user_role: string;
          weekly_availability?: Json;
          wish_partner_ids?: Json | null;
        };
        Update: {
          avoid_member_ids?: Json | null;
          can_teach_groups?: Json | null;
          club_id?: string;
          created_at?: string;
          id?: string;
          is_submitted?: boolean;
          last_modified_at?: string | null;
          max_sessions_per_week?: number | null;
          notes?: string | null;
          preferred_age_group?: string | null;
          preferred_court_ids?: Json | null;
          preferred_group_ids?: Json | null;
          preferred_level?: string | null;
          priority?: number;
          season_id?: string;
          self_assessed_level?: string | null;
          special_requests?: string | null;
          submitted_at?: string | null;
          unavailable_dates?: Json | null;
          updated_at?: string;
          user_id?: string;
          user_role?: string;
          weekly_availability?: Json;
          wish_partner_ids?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_training_preferences_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_training_preferences_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_training_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          address: string | null;
          avatar_url: string | null;
          billing_email: string | null;
          bio: string | null;
          city: string | null;
          created_at: string;
          current_period_end: string | null;
          date_of_birth: string | null;
          dtb_id: string | null;
          email: string;
          emergency_contact: string | null;
          emergency_phone: string | null;
          experience_months: number | null;
          full_name: string | null;
          id: string;
          lk_rating: number | null;
          owner_setup_completed_at: string | null;
          phone: string | null;
          postal_code: string | null;
          skill_level: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_quantity_synced: number | null;
          stripe_subscription_quantity_synced_at: string | null;
          subscription_status: string | null;
          subscription_tier: string | null;
          superadmin_setup_completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          avatar_url?: string | null;
          billing_email?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          date_of_birth?: string | null;
          dtb_id?: string | null;
          email: string;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          experience_months?: number | null;
          full_name?: string | null;
          id?: string;
          lk_rating?: number | null;
          owner_setup_completed_at?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          skill_level?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_quantity_synced?: number | null;
          stripe_subscription_quantity_synced_at?: string | null;
          subscription_status?: string | null;
          subscription_tier?: string | null;
          superadmin_setup_completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          avatar_url?: string | null;
          billing_email?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          date_of_birth?: string | null;
          dtb_id?: string | null;
          email?: string;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          experience_months?: number | null;
          full_name?: string | null;
          id?: string;
          lk_rating?: number | null;
          owner_setup_completed_at?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          skill_level?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_quantity_synced?: number | null;
          stripe_subscription_quantity_synced_at?: string | null;
          subscription_status?: string | null;
          subscription_tier?: string | null;
          superadmin_setup_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          club_id: string;
          court_id: string | null;
          created_at: string | null;
          end_time: string;
          id: string;
          priority: number | null;
          start_time: string;
          status: string | null;
          user_id: string;
        };
        Insert: {
          club_id: string;
          court_id?: string | null;
          created_at?: string | null;
          end_time: string;
          id?: string;
          priority?: number | null;
          start_time: string;
          status?: string | null;
          user_id: string;
        };
        Update: {
          club_id?: string;
          court_id?: string | null;
          created_at?: string | null;
          end_time?: string;
          id?: string;
          priority?: number | null;
          start_time?: string;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'waitlist_entries_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'waitlist_entries_court_id_fkey';
            columns: ['court_id'];
            isOneToOne: false;
            referencedRelation: 'courts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'waitlist_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      work_duties: {
        Row: {
          assigned_to: string | null;
          club_id: string;
          created_at: string;
          description: string | null;
          duty_type: string;
          end_time: string | null;
          id: string;
          max_participants: number | null;
          notes: string | null;
          priority: string;
          scheduled_date: string | null;
          season_year: number | null;
          start_time: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          club_id: string;
          created_at?: string;
          description?: string | null;
          duty_type: string;
          end_time?: string | null;
          id?: string;
          max_participants?: number | null;
          notes?: string | null;
          priority?: string;
          scheduled_date?: string | null;
          season_year?: number | null;
          start_time?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          club_id?: string;
          created_at?: string;
          description?: string | null;
          duty_type?: string;
          end_time?: string | null;
          id?: string;
          max_participants?: number | null;
          notes?: string | null;
          priority?: string;
          scheduled_date?: string | null;
          season_year?: number | null;
          start_time?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_duties_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      work_duty_assignments: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duty_id: string;
          id: string;
          member_id: string;
          notes: string | null;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duty_id: string;
          id?: string;
          member_id: string;
          notes?: string | null;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duty_id?: string;
          id?: string;
          member_id?: string;
          notes?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_duty_assignments_duty_id_fkey';
            columns: ['duty_id'];
            isOneToOne: false;
            referencedRelation: 'work_duties';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      attendance_hours_summary: {
        Row: {
          attendance_rate: number | null;
          attended_sessions: number | null;
          disputed_count: number | null;
          excused_sessions: number | null;
          late_sessions: number | null;
          member_confirmed_count: number | null;
          member_id: string | null;
          member_name: string | null;
          missed_sessions: number | null;
          pending_confirmation_count: number | null;
          total_attended_minutes: number | null;
          total_scheduled_minutes: number | null;
          total_sessions: number | null;
          trainer_confirmed_count: number | null;
          trainer_id: string | null;
          trainer_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_records_trainer_id_fkey';
            columns: ['trainer_id'];
            isOneToOne: false;
            referencedRelation: 'trainers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      add_balance_entry_atomic: {
        Args: {
          p_amount: number;
          p_balance_id: string;
          p_created_by?: string;
          p_reason: string;
          p_reference_id?: string;
          p_reference_type?: string;
        };
        Returns: {
          amount: number;
          created_at: string;
          created_by: string;
          id: string;
          member_balance_id: string;
          reason: string;
          reference_id: string;
          reference_type: string;
        }[];
      };
      calculate_dunning_level: {
        Args: { p_invoice_id: string };
        Returns: number;
      };
      calculate_member_fees: {
        Args: {
          p_club_id: string;
          p_member_age: number;
          p_member_type: string;
          p_training_group?: string;
        };
        Returns: {
          amount: number;
          billing_cycle: string;
          billing_unit_count: number;
          club_id: string;
          conditions: Json | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          type: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'fee_configurations';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      calculate_payment_fee: {
        Args: { p_amount: number; p_payment_settings_id: string };
        Returns: number;
      };
      calculate_season_weeks: {
        Args: { season_end: string; season_start: string };
        Returns: number;
      };
      chat_unread_total: { Args: never; Returns: number };
      check_and_record_stripe_event: {
        Args: { p_event_id: string; p_event_type: string };
        Returns: boolean;
      };
      check_availability_overlap: {
        Args: {
          p_date: string;
          p_end_time: string;
          p_exclude_id?: string;
          p_start_time: string;
          p_trainer_id: string;
        };
        Returns: {
          end_time: string;
          id: string;
          start_time: string;
          status: string;
        }[];
      };
      claim_background_job: {
        Args: {
          p_job_name: string;
          p_job_type: string;
          p_payload: Json;
          p_stale_after?: string;
        };
        Returns: {
          id: string;
          max_retries: number;
          retry_count: number;
        }[];
      };
      complete_job: {
        Args: { p_job_id: string; p_result?: Json };
        Returns: boolean;
      };
      create_booking_safe: {
        Args: {
          p_club_id: string;
          p_member_id: string;
          p_schedule_id: string;
          p_session_id: string;
        };
        Returns: string;
      };
      create_group_conversation: {
        Args: {
          p_audience?: string;
          p_club_id: string;
          p_title: string;
          p_user_ids?: string[];
        };
        Returns: string;
      };
      create_invoice_with_items: {
        Args: { p_invoice: Json; p_items: Json[] };
        Returns: string;
      };
      enqueue_job: {
        Args: {
          p_job_name: string;
          p_job_type: string;
          p_payload?: Json;
          p_priority?: number;
          p_schedule_expression?: string;
          p_scheduled_at?: string;
        };
        Returns: string;
      };
      fail_job: {
        Args: {
          p_error_message: string;
          p_job_id: string;
          p_stack_trace?: string;
        };
        Returns: boolean;
      };
      generate_invoice_number: { Args: { p_club_id: string }; Returns: string };
      generate_season_invoices_atomic: {
        Args: { p_club_id: string; p_invoices: Json; p_season_id: string };
        Returns: Json;
      };
      generate_slug: {
        Args: { p_club_id: string; p_title: string };
        Returns: string;
      };
      generate_weekly_club_reports: {
        Args: { week_ago: string };
        Returns: {
          club_id: string;
          club_name: string;
          new_members_week: number;
          open_invoices: number;
          overdue_total: number;
          pending_approvals: number;
          rsvps_week: number;
          sessions_week: number;
          total_members: number;
          trial_requests_week: number;
        }[];
      };
      get_active_rate_tiers: {
        Args: { p_club_id: string };
        Returns: {
          base_rate: number;
          club_id: string;
          created_at: string;
          description: string | null;
          experience_level: string;
          id: string;
          is_active: boolean;
          name: string;
          training_types: Json;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'hourly_rate_tiers';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_active_sepa_mandate: {
        Args: { p_member_id: string };
        Returns: {
          account_holder: string;
          address: Json;
          bank_name: string;
          bic: string;
          club_id: string | null;
          created_at: string;
          creditor_id: string;
          iban: string;
          id: string;
          is_active: boolean;
          mandate_reference: string;
          member_id: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          signature_date: string;
        };
        SetofOptions: {
          from: '*';
          to: 'sepa_mandates';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_active_trainers: {
        Args: { p_club_id: string };
        Returns: {
          availability: Json;
          bio: string | null;
          club_id: string;
          contracted_hourly_rate: number | null;
          created_at: string;
          date_of_birth: string;
          email: string;
          emergency_contact: Json;
          experience: Json;
          extra_hours_rate: number | null;
          first_name: string;
          hourly_rate: number | null;
          id: string;
          languages: Json;
          last_name: string;
          phone: string;
          preferred_time_slots: Json;
          profile_image_url: string | null;
          qualifications: Json;
          specializations: Json;
          status: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'trainer_profiles';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_available_trainers: {
        Args: { p_club_id: string; p_datetime: string };
        Returns: {
          full_name: string;
          hourly_rate: number;
          specialization: string[];
          user_id: string;
        }[];
      };
      get_cron_failures: {
        Args: { hours_back?: number };
        Returns: {
          error_message: string;
          job_id: number;
          job_name: string;
          run_time: string;
        }[];
      };
      get_current_trainer_rate: {
        Args: { p_trainer_id: string };
        Returns: number;
      };
      get_my_trainer_id: { Args: never; Returns: string };
      get_pending_jobs: {
        Args: { p_limit?: number };
        Returns: {
          job_id: string;
          job_name: string;
          job_type: string;
          payload: Json;
          priority: number;
        }[];
      };
      get_session_end_time: { Args: { p_session_id: string }; Returns: string };
      get_setting_value: {
        Args: { p_club_id?: string; p_key: string };
        Returns: string;
      };
      get_settings_as_object: {
        Args: {
          p_category?: string;
          p_club_id?: string;
          p_public_only?: boolean;
        };
        Returns: Json;
      };
      get_trainer_full_name: { Args: { p_trainer_id: string }; Returns: string };
      get_trial_training_stats: {
        Args: { p_club_id: string; p_end_date?: string; p_start_date?: string };
        Returns: {
          cancelled: number;
          completed: number;
          conversion_rate: number;
          converted: number;
          no_show: number;
          scheduled: number;
          total: number;
        }[];
      };
      get_upcoming_trial_trainings: {
        Args: { p_club_id: string; p_days?: number };
        Returns: {
          club_id: string;
          completed_at: string | null;
          converted_to_member_id: string | null;
          court_id: string;
          court_name: string;
          created_at: string;
          duration: number;
          feedback_comments: string | null;
          feedback_rating: number | null;
          feedback_would_recommend: boolean | null;
          followup_stage: number;
          id: string;
          marketing_consent: boolean;
          marketing_consent_confirmed_at: string | null;
          marketing_consent_token: string | null;
          notes: string | null;
          participant_date_of_birth: string;
          participant_email: string;
          participant_first_name: string;
          participant_id: string;
          participant_last_name: string;
          participant_phone: string;
          scheduled_date: string;
          scheduled_time: string;
          status: string;
          trainer_id: string;
          trainer_name: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'trial_trainings';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_club_ids: { Args: never; Returns: string[] };
      get_valid_fee_configurations: {
        Args: { p_club_id: string; p_date?: string };
        Returns: {
          amount: number;
          billing_cycle: string;
          billing_unit_count: number;
          club_id: string;
          conditions: Json | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          type: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'fee_configurations';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      has_active_sepa_mandate: {
        Args: { p_member_id: string };
        Returns: boolean;
      };
      increment_member_balance: {
        Args: { p_amount: number; p_balance_id: string };
        Returns: undefined;
      };
      increment_news_view_count: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      is_admin_of_user: { Args: { target_user_id: string }; Returns: boolean };
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean };
      is_club_member: { Args: { p_club_id: string }; Returns: boolean };
      is_club_trainer: { Args: { p_club_id: string }; Returns: boolean };
      is_conversation_participant: {
        Args: { p_conv: string };
        Returns: boolean;
      };
      is_owner: { Args: never; Returns: boolean };
      is_staff_of_user: { Args: { target_user_id: string }; Returns: boolean };
      is_superadmin: { Args: never; Returns: boolean };
      is_superadmin_of: { Args: { p_club_id: string }; Returns: boolean };
      is_trainer_available: {
        Args: { p_club_id: string; p_datetime: string; p_user_id: string };
        Returns: boolean;
      };
      list_my_conversations: {
        Args: { p_club_id?: string };
        Returns: {
          club_id: string;
          id: string;
          kind: string;
          last_message_at: string;
          last_message_preview: string;
          last_read_at: string;
          muted: boolean;
          participant_count: number;
          participants: Json;
          title: string;
          unread_count: number;
        }[];
      };
      mark_overdue_invoices: {
        Args: never;
        Returns: {
          club_id: string;
          invoice_count: number;
        }[];
      };
      news_audience_matches: {
        Args: { p_audience: string; p_club_id: string };
        Returns: boolean;
      };
      news_read_stats: {
        Args: { p_club_id: string };
        Returns: {
          audience_count: number;
          post_id: string;
          read_count: number;
        }[];
      };
      process_shop_order_payment: {
        Args: { p_order_id: string; p_paid: boolean };
        Returns: Json;
      };
      prune_audit_logs: {
        Args: never;
        Returns: {
          deleted_read: number;
          deleted_security: number;
        }[];
      };
      publish_season_plan: {
        Args: {
          p_bookings: Json;
          p_conflicts: Json;
          p_entry_updates: Json;
          p_history: Json;
          p_now: string;
          p_republish: boolean;
          p_schedule: Json;
          p_season_id: string;
          p_sessions: Json;
        };
        Returns: Json;
      };
      save_season_clustering: {
        Args: {
          p_conflicts?: Json;
          p_entries: Json;
          p_groups: Json;
          p_history?: Json;
          p_now: string;
          p_season_id: string;
          p_waitlist: Json;
        };
        Returns: Json;
      };
      shares_active_club_with: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      shift_session_waitlist_positions: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      soft_delete_club: {
        Args: { p_club_id: string; p_reason?: string };
        Returns: number;
      };
      start_direct_conversation: {
        Args: { p_club_id: string; p_other: string };
        Returns: string;
      };
      start_job: { Args: { p_job_id: string }; Returns: boolean };
      timeslots_overlap: {
        Args: {
          day1: number;
          day2: number;
          end1: string;
          end2: string;
          start1: string;
          start2: string;
        };
        Returns: boolean;
      };
      user_available_at: {
        Args: {
          p_day_of_week: number;
          p_end_time: string;
          p_season_id: string;
          p_specific_date?: string;
          p_start_time: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      validate_booking_rules: {
        Args: {
          p_booking_id?: string;
          p_club_id: string;
          p_court_id: string;
          p_end_time: string;
          p_start_time: string;
          p_user_id: string;
        };
        Returns: {
          error_code: string;
          error_message: string;
          is_valid: boolean;
        }[];
      };
    };
    Enums: {
      catering_status: 'not_planned' | 'planned' | 'ready';
      decision_change_action:
        | 'created'
        | 'updated'
        | 'status_changed'
        | 'finalized'
        | 'cancelled'
        | 'invitation_sent'
        | 'invitation_response'
        | 'vote_cast';
      decision_outcome: 'approved' | 'rejected' | 'deferred' | 'withdrawn';
      decision_status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      decision_type:
        'vorstandsbeschluss' | 'mitgliederversammlung' | 'ausschuss' | 'sonderbeschluss';
      invitation_status: 'pending' | 'accepted' | 'declined' | 'tentative';
      match_outcome: 'home_won' | 'away_won' | 'not_played' | 'walkover';
      match_position_type: 'singles' | 'doubles';
      special_event_status: 'draft' | 'open' | 'full' | 'cancelled' | 'completed';
      special_event_type:
        'sommercamp' | 'intensivkurs' | 'schnupperkurs' | 'turnier' | 'social' | 'sonstiges';
      vote_choice: 'for' | 'against' | 'abstain';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_namespaces_catalog_id_fkey';
            columns: ['catalog_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id: string | null;
          shard_id: string | null;
          shard_key: string | null;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_tables_catalog_id_fkey';
            columns: ['catalog_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'iceberg_tables_namespace_id_fkey';
            columns: ['namespace_id'];
            isOneToOne: false;
            referencedRelation: 'iceberg_namespaces';
            referencedColumns: ['id'];
          },
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vector_indexes_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_vectors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: 'STANDARD' | 'ANALYTICS' | 'VECTOR';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      catering_status: ['not_planned', 'planned', 'ready'],
      decision_change_action: [
        'created',
        'updated',
        'status_changed',
        'finalized',
        'cancelled',
        'invitation_sent',
        'invitation_response',
        'vote_cast',
      ],
      decision_outcome: ['approved', 'rejected', 'deferred', 'withdrawn'],
      decision_status: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'],
      decision_type: [
        'vorstandsbeschluss',
        'mitgliederversammlung',
        'ausschuss',
        'sonderbeschluss',
      ],
      invitation_status: ['pending', 'accepted', 'declined', 'tentative'],
      match_outcome: ['home_won', 'away_won', 'not_played', 'walkover'],
      match_position_type: ['singles', 'doubles'],
      special_event_status: ['draft', 'open', 'full', 'cancelled', 'completed'],
      special_event_type: [
        'sommercamp',
        'intensivkurs',
        'schnupperkurs',
        'turnier',
        'social',
        'sonstiges',
      ],
      vote_choice: ['for', 'against', 'abstain'],
    },
  },
  storage: {
    Enums: {
      buckettype: ['STANDARD', 'ANALYTICS', 'VECTOR'],
    },
  },
} as const;
