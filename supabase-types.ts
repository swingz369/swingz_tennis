export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          participant_id: string
          participant_name: string
          session_id: string
          status: string
          trainer_id: string
          trainer_name: string
          updated_at: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          participant_id: string
          participant_name: string
          session_id: string
          status: string
          trainer_id: string
          trainer_name: string
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          participant_id?: string
          participant_name?: string
          session_id?: string
          status?: string
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id: string
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_line_items: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string
          hours: number
          id: string
          rate: number
          session_id: string | null
          trainer_billing_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description: string
          hours: number
          id?: string
          rate: number
          session_id?: string | null
          trainer_billing_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string
          hours?: number
          id?: string
          rate?: number
          session_id?: string | null
          trainer_billing_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_line_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_line_items_trainer_billing_id_fkey"
            columns: ["trainer_billing_id"]
            isOneToOne: false
            referencedRelation: "trainer_billings"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_rules: {
        Row: {
          advance_booking_days: number | null
          allow_recurring: boolean | null
          applies_to_role: string | null
          cancellation_hours_before: number | null
          club_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          max_booking_duration_minutes: number | null
          max_bookings_per_day: number | null
          max_bookings_per_week: number | null
          min_booking_duration_minutes: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          advance_booking_days?: number | null
          allow_recurring?: boolean | null
          applies_to_role?: string | null
          cancellation_hours_before?: number | null
          club_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_booking_duration_minutes?: number | null
          max_bookings_per_day?: number | null
          max_bookings_per_week?: number | null
          min_booking_duration_minutes?: number | null
          name?: string
          updated_at?: string | null
        }
        Update: {
          advance_booking_days?: number | null
          allow_recurring?: boolean | null
          applies_to_role?: string | null
          cancellation_hours_before?: number | null
          club_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_booking_duration_minutes?: number | null
          max_bookings_per_day?: number | null
          max_bookings_per_week?: number | null
          min_booking_duration_minutes?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_at: string
          booking_number: string | null
          booking_type: string | null
          cancellation_notes: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          club_id: string
          court_id: string
          end_time: string | null
          id: string
          is_recurring: boolean | null
          member_id: string
          notes: string | null
          payment_status: string | null
          schedule_id: string
          session_id: string
          session_start_time: string
          start_time: string | null
          status: string
        }
        Insert: {
          booked_at?: string
          booking_number?: string | null
          booking_type?: string | null
          cancellation_notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          club_id: string
          court_id: string
          end_time?: string | null
          id?: string
          is_recurring?: boolean | null
          member_id: string
          notes?: string | null
          payment_status?: string | null
          schedule_id: string
          session_id: string
          session_start_time: string
          start_time?: string | null
          status?: string
        }
        Update: {
          booked_at?: string
          booking_number?: string | null
          booking_type?: string | null
          cancellation_notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          club_id?: string
          court_id?: string
          end_time?: string | null
          id?: string
          is_recurring?: boolean | null
          member_id?: string
          notes?: string | null
          payment_status?: string | null
          schedule_id?: string
          session_id?: string
          session_start_time?: string
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_schedule_id_schedules_id_fk"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_sessions_id_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          join_date: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          join_date?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          join_date?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          billing_unit_minutes: number
          bundesland: string | null
          city: string | null
          created_at: string
          datev_creditor_number: string | null
          default_hourly_rate: number | null
          default_payment_method: string
          default_session_duration_minutes: number | null
          description: string | null
          email: string | null
          hourly_rate: number | null
          id: string
          invoice_number_prefix: string
          logo_url: string | null
          max_members: number
          name: string
          opening_hours: Json
          phone: string | null
          setup_completed_at: string | null
          slug: string | null
          status: string
          tax_rate: number
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_unit_minutes?: number
          bundesland?: string | null
          city?: string | null
          created_at?: string
          datev_creditor_number?: string | null
          default_hourly_rate?: number | null
          default_payment_method?: string
          default_session_duration_minutes?: number | null
          description?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_number_prefix?: string
          logo_url?: string | null
          max_members?: number
          name: string
          opening_hours: Json
          phone?: string | null
          setup_completed_at?: string | null
          slug?: string | null
          status?: string
          tax_rate?: number
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_unit_minutes?: number
          bundesland?: string | null
          city?: string | null
          created_at?: string
          datev_creditor_number?: string | null
          default_hourly_rate?: number | null
          default_payment_method?: string
          default_session_duration_minutes?: number | null
          description?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_number_prefix?: string
          logo_url?: string | null
          max_members?: number
          name?: string
          opening_hours?: Json
          phone?: string | null
          setup_completed_at?: string | null
          slug?: string | null
          status?: string
          tax_rate?: number
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          club_id: string | null
          code: string
          created_at: string | null
          created_by: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_amount: number | null
          used_count: number | null
        }
        Insert: {
          club_id?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_amount?: number | null
          used_count?: number | null
        }
        Update: {
          club_id?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_amount?: number | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      court_availability: {
        Row: {
          court_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          court_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_availability_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      court_types: {
        Row: {
          club_id: string | null
          created_at: string | null
          description: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_indoor: boolean | null
          is_outdoor: boolean | null
          max_players: number | null
          name: string
          requires_lighting: boolean | null
          surface_type: string | null
          updated_at: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          is_outdoor?: boolean | null
          max_players?: number | null
          name: string
          requires_lighting?: boolean | null
          surface_type?: string | null
          updated_at?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_indoor?: boolean | null
          is_outdoor?: boolean | null
          max_players?: number | null
          name?: string
          requires_lighting?: boolean | null
          surface_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_types_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          club_id: string
          court_type_id: string | null
          created_at: string
          description: string | null
          has_indoor: boolean
          has_lighting: boolean | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          number: number | null
          status: string | null
          surface: string
          updated_at: string | null
        }
        Insert: {
          club_id: string
          court_type_id?: string | null
          created_at?: string
          description?: string | null
          has_indoor?: boolean
          has_lighting?: boolean | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          number?: number | null
          status?: string | null
          surface?: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          court_type_id?: string | null
          created_at?: string
          description?: string | null
          has_indoor?: boolean
          has_lighting?: boolean | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          number?: number | null
          status?: string | null
          surface?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courts_court_type_id_fkey"
            columns: ["court_type_id"]
            isOneToOne: false
            referencedRelation: "court_types"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_records: {
        Row: {
          due_date: string | null
          fee_amount: number | null
          id: string
          invoice_id: string
          level: number | null
          notes: string | null
          sent_at: string | null
        }
        Insert: {
          due_date?: string | null
          fee_amount?: number | null
          id?: string
          invoice_id: string
          level?: number | null
          notes?: string | null
          sent_at?: string | null
        }
        Update: {
          due_date?: string | null
          fee_amount?: number | null
          id?: string
          invoice_id?: string
          level?: number | null
          notes?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dunning_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body: string
          club_id: string
          created_at: string | null
          created_by: string | null
          id: string
          recipient_count: number | null
          scheduled_at: string | null
          status: string | null
          subject: string
          target_group: string | null
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          subject: string
          target_group?: string | null
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          subject?: string
          target_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body: string
          campaign_id: string | null
          club_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          club_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          club_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      family_accounts: {
        Row: {
          created_at: string | null
          family_group_id: string
          id: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          family_group_id: string
          id?: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          family_group_id?: string
          id?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          family_group_id: string
          id: string
          is_used: boolean | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          family_group_id: string
          id?: string
          is_used?: boolean | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          family_group_id?: string
          id?: string
          is_used?: boolean | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_configurations: {
        Row: {
          amount: number
          billing_cycle: string
          billing_unit_count: number
          club_id: string
          conditions: Json | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          amount: number
          billing_cycle: string
          billing_unit_count?: number
          club_id: string
          conditions?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          amount?: number
          billing_cycle?: string
          billing_unit_count?: number
          club_id?: string
          conditions?: Json | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_configurations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_badges: {
        Row: {
          description: string | null
          earned_at: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_points: {
        Row: {
          points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          age_group: string | null
          club_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level: string | null
          max_members: number | null
          member_ids: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          club_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          max_members?: number | null
          member_ids?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          club_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          max_members?: number | null
          member_ids?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_rate_tiers: {
        Row: {
          base_rate: number
          club_id: string
          created_at: string
          description: string | null
          experience_level: string
          id: string
          is_active: boolean
          name: string
          training_types: Json
          updated_at: string
        }
        Insert: {
          base_rate: number
          club_id: string
          created_at?: string
          description?: string | null
          experience_level: string
          id?: string
          is_active?: boolean
          name: string
          training_types?: Json
          updated_at?: string
        }
        Update: {
          base_rate?: number
          club_id?: string
          created_at?: string
          description?: string | null
          experience_level?: string
          id?: string
          is_active?: boolean
          name?: string
          training_types?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_rate_tiers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_logs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          club_id: string | null
          created_at: string
          date: string
          duration: number
          end_time: string
          id: string
          notes: string | null
          session_id: string | null
          start_time: string
          status: string
          trainer_id: string
          trainer_name: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          club_id?: string | null
          created_at?: string
          date: string
          duration: number
          end_time: string
          id?: string
          notes?: string | null
          session_id?: string | null
          start_time: string
          status?: string
          trainer_id: string
          trainer_name: string
          type: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          club_id?: string | null
          created_at?: string
          date?: string
          duration?: number
          end_time?: string
          id?: string
          notes?: string | null
          session_id?: string | null
          start_time?: string
          status?: string
          trainer_id?: string
          trainer_name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hours_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hours_logs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          invoice_id: string
          paid_at: string | null
          payment_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          invoice_id: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          invoice_id?: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_installments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          datev_account_number: string | null
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          datev_account_number?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          datev_account_number?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          club_id: string
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: string | null
          member_id: string | null
          notes: string | null
          paid_at: string | null
          season_id: string | null
          status: string | null
          tax_amount: number | null
          trainer_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          club_id: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string | null
          member_id?: string | null
          notes?: string | null
          paid_at?: string | null
          season_id?: string | null
          status?: string | null
          tax_amount?: number | null
          trainer_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          member_id?: string | null
          notes?: string | null
          paid_at?: string | null
          season_id?: string | null
          status?: string | null
          tax_amount?: number | null
          trainer_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      member_balance_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          member_balance_id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_balance_id: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_balance_id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_balance_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_balance_entries_member_balance_id_fkey"
            columns: ["member_balance_id"]
            isOneToOne: false
            referencedRelation: "member_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      member_balances: {
        Row: {
          balance: number
          club_id: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          club_id: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          club_id?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_balances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_balances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      news_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_id: string | null
          club_id: string
          content: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_pinned: boolean | null
          is_published: boolean | null
          published_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          club_id: string
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_pinned?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          club_id?: string
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_pinned?: boolean | null
          is_published?: boolean | null
          published_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          club_id: string | null
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          club_id: string
          config: Json
          created_at: string
          fees: Json | null
          gateway: string
          gateway_name: string
          id: string
          is_active: boolean
          is_default: boolean
          max_amount: number | null
          min_amount: number | null
          supported_currencies: string[]
          supported_methods: string[]
          updated_at: string
        }
        Insert: {
          club_id: string
          config?: Json
          created_at?: string
          fees?: Json | null
          gateway: string
          gateway_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_amount?: number | null
          min_amount?: number | null
          supported_currencies: string[]
          supported_methods: string[]
          updated_at?: string
        }
        Update: {
          club_id?: string
          config?: Json
          created_at?: string
          fees?: Json | null
          gateway?: string
          gateway_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          max_amount?: number | null
          min_amount?: number | null
          supported_currencies?: string[]
          supported_methods?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          external_id: string | null
          id: string
          invoice_id: string
          paid_at: string | null
          payment_method: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          id?: string
          invoice_id: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_conflicts: {
        Row: {
          affected_court_id: string | null
          affected_group_ids: Json | null
          affected_plan_entry_ids: Json
          affected_trainer_id: string | null
          affected_user_ids: Json | null
          club_id: string
          conflict_time_slot: Json | null
          conflict_type: string
          created_at: string
          description: string
          detected_at: string
          detection_source: string | null
          id: string
          resolution_action: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          season_id: string
          severity: string
          status: string
          suggested_resolution: string | null
          updated_at: string
        }
        Insert: {
          affected_court_id?: string | null
          affected_group_ids?: Json | null
          affected_plan_entry_ids?: Json
          affected_trainer_id?: string | null
          affected_user_ids?: Json | null
          club_id: string
          conflict_time_slot?: Json | null
          conflict_type: string
          created_at?: string
          description: string
          detected_at?: string
          detection_source?: string | null
          id?: string
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          season_id: string
          severity?: string
          status?: string
          suggested_resolution?: string | null
          updated_at?: string
        }
        Update: {
          affected_court_id?: string | null
          affected_group_ids?: Json | null
          affected_plan_entry_ids?: Json
          affected_trainer_id?: string | null
          affected_user_ids?: Json | null
          club_id?: string
          conflict_time_slot?: Json | null
          conflict_type?: string
          created_at?: string
          description?: string
          detected_at?: string
          detection_source?: string | null
          id?: string
          resolution_action?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          season_id?: string
          severity?: string
          status?: string
          suggested_resolution?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_conflicts_affected_court_id_fkey"
            columns: ["affected_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_conflicts_affected_trainer_id_fkey"
            columns: ["affected_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_conflicts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_conflicts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          applies_to: string | null
          club_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          price_per_hour: number | null
          rule_type: string | null
        }
        Insert: {
          applies_to?: string | null
          club_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_per_hour?: number | null
          rule_type?: string | null
        }
        Update: {
          applies_to?: string | null
          club_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_per_hour?: number | null
          rule_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_checkins: {
        Row: {
          booking_id: string | null
          checked_in_at: string | null
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          checked_in_at?: string | null
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          checked_in_at?: string | null
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_checkins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_history: {
        Row: {
          changed_at: string
          changed_by: string
          club_id: string
          id: string
          new_rate: number
          old_rate: number
          reason: string | null
          trainer_id: string
          trainer_name: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          club_id: string
          id?: string
          new_rate: number
          old_rate: number
          reason?: string | null
          trainer_id: string
          trainer_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          club_id?: string
          id?: string
          new_rate?: number
          old_rate?: number
          reason?: string | null
          trainer_id?: string
          trainer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_history_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          city: string | null
          club_id: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          motivation: string | null
          phone: string | null
          playing_level: string | null
          postal_code: string | null
          previous_club: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          street: string | null
          wants_trial_training: boolean | null
        }
        Insert: {
          city?: string | null
          club_id?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          motivation?: string | null
          phone?: string | null
          playing_level?: string | null
          postal_code?: string | null
          previous_club?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          street?: string | null
          wants_trial_training?: boolean | null
        }
        Update: {
          city?: string | null
          club_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          motivation?: string | null
          phone?: string | null
          playing_level?: string | null
          postal_code?: string | null
          previous_club?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          street?: string | null
          wants_trial_training?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          club_id: string
          created_at: string
          id: string
          is_active: boolean
          season_end_date: string
          season_start_date: string
          season_type: string
          season_year: number
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          season_end_date: string
          season_start_date: string
          season_type: string
          season_year: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          season_end_date?: string
          season_start_date?: string
          season_type?: string
          season_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      school_holidays: {
        Row: {
          bundesland: string
          end_date: string
          id: string
          name: string
          start_date: string
          year: number
        }
        Insert: {
          bundesland: string
          end_date: string
          id?: string
          name: string
          start_date: string
          year: number
        }
        Update: {
          bundesland?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          year?: number
        }
        Relationships: []
      }
      season_plan_entries: {
        Row: {
          admin_notes: string | null
          club_id: string
          conflict_score: number | null
          court_id: string | null
          created_at: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          ends_at_week: number | null
          entry_type: string
          expected_participants: Json | null
          group_id: string | null
          id: string
          max_participants: number
          notes: string | null
          optimization_score: number | null
          planning_source: string
          preference_match_score: number | null
          published_at: string | null
          published_session_id: string | null
          season_id: string
          start_time: string
          starts_from_week: number
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          club_id: string
          conflict_score?: number | null
          court_id?: string | null
          created_at?: string
          day_of_week: number
          duration_minutes: number
          end_time: string
          ends_at_week?: number | null
          entry_type?: string
          expected_participants?: Json | null
          group_id?: string | null
          id?: string
          max_participants?: number
          notes?: string | null
          optimization_score?: number | null
          planning_source?: string
          preference_match_score?: number | null
          published_at?: string | null
          published_session_id?: string | null
          season_id: string
          start_time: string
          starts_from_week?: number
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          club_id?: string
          conflict_score?: number | null
          court_id?: string | null
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          end_time?: string
          ends_at_week?: number | null
          entry_type?: string
          expected_participants?: Json | null
          group_id?: string | null
          id?: string
          max_participants?: number
          notes?: string | null
          optimization_score?: number | null
          planning_source?: string
          preference_match_score?: number | null
          published_at?: string | null
          published_session_id?: string | null
          season_id?: string
          start_time?: string
          starts_from_week?: number
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_plan_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_plan_entries_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_plan_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_plan_entries_published_session_id_fkey"
            columns: ["published_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_plan_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_plan_entries_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      season_planning_history: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          algorithm_metrics: Json | null
          club_id: string
          conflicts_created: number | null
          conflicts_resolved: number | null
          created_at: string
          details: Json | null
          entries_affected: number | null
          id: string
          notes: string | null
          season_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          algorithm_metrics?: Json | null
          club_id: string
          conflicts_created?: number | null
          conflicts_resolved?: number | null
          created_at?: string
          details?: Json | null
          entries_affected?: number | null
          id?: string
          notes?: string | null
          season_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          algorithm_metrics?: Json | null
          club_id?: string
          conflicts_created?: number | null
          conflicts_resolved?: number | null
          created_at?: string
          details?: Json | null
          entries_affected?: number | null
          id?: string
          notes?: string | null
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_planning_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_planning_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_planning_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          auto_plan_config: Json | null
          auto_plan_enabled: boolean
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          last_planned_at: string | null
          name: string
          notes: string | null
          planning_status: string
          preferences_deadline: string | null
          preferences_open: boolean
          published_at: string | null
          season_type: string
          start_date: string
          updated_at: string
          year: number
        }
        Insert: {
          auto_plan_config?: Json | null
          auto_plan_enabled?: boolean
          club_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          last_planned_at?: string | null
          name: string
          notes?: string | null
          planning_status?: string
          preferences_deadline?: string | null
          preferences_open?: boolean
          published_at?: string | null
          season_type: string
          start_date: string
          updated_at?: string
          year: number
        }
        Update: {
          auto_plan_config?: Json | null
          auto_plan_enabled?: boolean
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          last_planned_at?: string | null
          name?: string
          notes?: string | null
          planning_status?: string
          preferences_deadline?: string | null
          preferences_open?: boolean
          published_at?: string | null
          season_type?: string
          start_date?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sepa_mandates: {
        Row: {
          account_holder: string
          address: Json
          bank_name: string
          bic: string
          club_id: string | null
          created_at: string
          creditor_id: string
          iban: string
          id: string
          is_active: boolean
          mandate_reference: string
          member_id: string
          revoke_reason: string | null
          revoked_at: string | null
          signature_date: string
        }
        Insert: {
          account_holder: string
          address: Json
          bank_name: string
          bic: string
          club_id?: string | null
          created_at?: string
          creditor_id?: string
          iban: string
          id?: string
          is_active?: boolean
          mandate_reference: string
          member_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          signature_date: string
        }
        Update: {
          account_holder?: string
          address?: Json
          bank_name?: string
          bic?: string
          club_id?: string | null
          created_at?: string
          creditor_id?: string
          iban?: string
          id?: string
          is_active?: boolean
          mandate_reference?: string
          member_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          signature_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepa_mandates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          court_id: string | null
          created_at: string
          group_ids: Json
          id: string
          max_participants: number
          notes: string | null
          schedule_id: string
          status: string
          timeslot_end: string
          timeslot_start: string
          trainer_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          court_id?: string | null
          created_at?: string
          group_ids: Json
          id?: string
          max_participants?: number
          notes?: string | null
          schedule_id: string
          status?: string
          timeslot_end: string
          timeslot_start: string
          trainer_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          court_id?: string | null
          created_at?: string
          group_ids?: Json
          id?: string
          max_participants?: number
          notes?: string | null
          schedule_id?: string
          status?: string
          timeslot_end?: string
          timeslot_start?: string
          trainer_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_court_id_courts_id_fk"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_schedule_id_schedules_id_fk"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_trainer_id_trainers_id_fk"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string | null
          id: string
          items: Json | null
          payment_status: string | null
          status: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json | null
          payment_status?: string | null
          status?: string | null
          total_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json | null
          payment_status?: string | null
          status?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          club_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          stock: number | null
        }
        Insert: {
          category?: string | null
          club_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          stock?: number | null
        }
        Update: {
          category?: string | null
          club_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          club_id: string | null
          description: string | null
          id: string
          is_public: boolean
          is_required: boolean
          key: string
          type: string
          updated_at: string
          updated_by: string | null
          validation: Json | null
          value: string
        }
        Insert: {
          category: string
          club_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          is_required?: boolean
          key: string
          type: string
          updated_at?: string
          updated_by?: string | null
          validation?: Json | null
          value: string
        }
        Update: {
          category?: string
          club_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          is_required?: boolean
          key?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          validation?: Json | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          court_id: string | null
          created_at: string | null
          id: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          round: number
          scheduled_at: string | null
          score: string | null
          status: string | null
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          court_id?: string | null
          created_at?: string | null
          id?: string
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          round: number
          scheduled_at?: string | null
          score?: string | null
          status?: string | null
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          court_id?: string | null
          created_at?: string | null
          id?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          scheduled_at?: string | null
          score?: string | null
          status?: string | null
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          id: string
          notes: string | null
          partner_id: string | null
          payment_status: string | null
          registration_date: string | null
          seed: number | null
          status: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          partner_id?: string | null
          payment_status?: string | null
          registration_date?: string | null
          seed?: number | null
          status?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          partner_id?: string | null
          payment_status?: string | null
          registration_date?: string | null
          seed?: number | null
          status?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          category: string | null
          club_id: string
          created_at: string | null
          description: string | null
          end_date: string | null
          entry_fee: number | null
          format: string | null
          id: string
          max_participants: number | null
          name: string
          organizer_id: string | null
          prize_info: string | null
          registration_deadline: string | null
          start_date: string
          status: string | null
          surface: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          club_id: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          entry_fee?: number | null
          format?: string | null
          id?: string
          max_participants?: number | null
          name: string
          organizer_id?: string | null
          prize_info?: string | null
          registration_deadline?: string | null
          start_date: string
          status?: string | null
          surface?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          club_id?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          entry_fee?: number | null
          format?: string | null
          id?: string
          max_participants?: number | null
          name?: string
          organizer_id?: string | null
          prize_info?: string | null
          registration_deadline?: string | null
          start_date?: string
          status?: string | null
          surface?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_absences: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          club_id: string
          created_at: string
          end_date: string
          id: string
          notes: string | null
          reason: string | null
          start_date: string
          status: string
          trainer_id: string
          trainer_name: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          club_id: string
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          reason?: string | null
          start_date: string
          status?: string
          trainer_id: string
          trainer_name: string
          type: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          club_id?: string
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          trainer_id?: string
          trainer_name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_absences_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_absences_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_availabilities: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          notes: string | null
          recurring_pattern: Json | null
          start_time: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          notes?: string | null
          recurring_pattern?: Json | null
          start_time: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          recurring_pattern?: Json | null
          start_time?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_availabilities_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trainer_billings: {
        Row: {
          billing_period_id: string
          created_at: string
          due_date: string | null
          hourly_rate: number
          id: string
          invoice_id: string | null
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          status: string
          total_amount: number
          total_hours: number
          trainer_id: string
          trainer_name: string
          updated_at: string
        }
        Insert: {
          billing_period_id: string
          created_at?: string
          due_date?: string | null
          hourly_rate: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: string
          total_amount: number
          total_hours: number
          trainer_id: string
          trainer_name: string
          updated_at?: string
        }
        Update: {
          billing_period_id?: string
          created_at?: string
          due_date?: string | null
          hourly_rate?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: string
          total_amount?: number
          total_hours?: number
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_billings_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_billings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_club: {
        Row: {
          club_id: string
          created_at: string
          trainer_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          trainer_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_club_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_club_trainer_id_trainers_id_fk"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_clubs: {
        Row: {
          club_id: string
          created_at: string
          trainer_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          trainer_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_clubs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_feedback: {
        Row: {
          club_id: string
          comment: string | null
          communication: number | null
          created_at: string | null
          flagged_reason: string | null
          id: string
          is_flagged: boolean | null
          is_visible: boolean | null
          member_id: string
          moderated_at: string | null
          moderated_by: string | null
          motivation: number | null
          punctuality: number | null
          rating: number
          session_id: string | null
          teaching_quality: number | null
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          club_id: string
          comment?: string | null
          communication?: number | null
          created_at?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          is_visible?: boolean | null
          member_id: string
          moderated_at?: string | null
          moderated_by?: string | null
          motivation?: number | null
          punctuality?: number | null
          rating: number
          session_id?: string | null
          teaching_quality?: number | null
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          comment?: string | null
          communication?: number | null
          created_at?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          is_visible?: boolean | null
          member_id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          motivation?: number | null
          punctuality?: number | null
          rating?: number
          session_id?: string | null
          teaching_quality?: number | null
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_feedback_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_hourly_rates: {
        Row: {
          base_rate: number
          club_id: string
          created_at: string
          effective_rate: number
          id: string
          override_rate: number | null
          reason: string | null
          trainer_id: string
          trainer_name: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          base_rate: number
          club_id: string
          created_at?: string
          effective_rate: number
          id?: string
          override_rate?: number | null
          reason?: string | null
          trainer_id: string
          trainer_name: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          base_rate?: number
          club_id?: string
          created_at?: string
          effective_rate?: number
          id?: string
          override_rate?: number | null
          reason?: string | null
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_hourly_rates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_hourly_rates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_profiles: {
        Row: {
          availability: Json
          bio: string | null
          club_id: string
          created_at: string
          date_of_birth: string
          email: string
          emergency_contact: Json
          experience: Json
          first_name: string
          hourly_rate: number | null
          id: string
          languages: Json
          last_name: string
          phone: string
          preferred_time_slots: Json
          profile_image_url: string | null
          qualifications: Json
          specializations: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: Json
          bio?: string | null
          club_id: string
          created_at?: string
          date_of_birth: string
          email: string
          emergency_contact?: Json
          experience?: Json
          first_name: string
          hourly_rate?: number | null
          id?: string
          languages?: Json
          last_name: string
          phone: string
          preferred_time_slots?: Json
          profile_image_url?: string | null
          qualifications?: Json
          specializations?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: Json
          bio?: string | null
          club_id?: string
          created_at?: string
          date_of_birth?: string
          email?: string
          emergency_contact?: Json
          experience?: Json
          first_name?: string
          hourly_rate?: number | null
          id?: string
          languages?: Json
          last_name?: string
          phone?: string
          preferred_time_slots?: Json
          profile_image_url?: string | null
          qualifications?: Json
          specializations?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_rating_summary: {
        Row: {
          average_rating: number | null
          avg_communication: number | null
          avg_motivation: number | null
          avg_punctuality: number | null
          avg_teaching_quality: number | null
          club_id: string
          last_updated: string | null
          rating_1_count: number | null
          rating_2_count: number | null
          rating_3_count: number | null
          rating_4_count: number | null
          rating_5_count: number | null
          total_ratings: number | null
          trainer_id: string
        }
        Insert: {
          average_rating?: number | null
          avg_communication?: number | null
          avg_motivation?: number | null
          avg_punctuality?: number | null
          avg_teaching_quality?: number | null
          club_id: string
          last_updated?: string | null
          rating_1_count?: number | null
          rating_2_count?: number | null
          rating_3_count?: number | null
          rating_4_count?: number | null
          rating_5_count?: number | null
          total_ratings?: number | null
          trainer_id: string
        }
        Update: {
          average_rating?: number | null
          avg_communication?: number | null
          avg_motivation?: number | null
          avg_punctuality?: number | null
          avg_teaching_quality?: number | null
          club_id?: string
          last_updated?: string | null
          rating_1_count?: number | null
          rating_2_count?: number | null
          rating_3_count?: number | null
          rating_4_count?: number | null
          rating_5_count?: number | null
          total_ratings?: number | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_rating_summary_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          max_hours_per_week: number
          name: string
          specialties: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          max_hours_per_week?: number
          name: string
          specialties?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          max_hours_per_week?: number
          name?: string
          specialties?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      training_group_memberships: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          left_at: string | null
          left_reason: string | null
          member_id: string
          training_group_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at: string
          left_at?: string | null
          left_reason?: string | null
          member_id: string
          training_group_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          left_reason?: string | null
          member_id?: string
          training_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_group_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_memberships_training_group_id_fkey"
            columns: ["training_group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_groups: {
        Row: {
          age_group: string
          club_id: string
          id: string
          is_active: boolean
          level: string
          name: string
          schedule_id: string
        }
        Insert: {
          age_group?: string
          club_id: string
          id?: string
          is_active?: boolean
          level?: string
          name: string
          schedule_id: string
        }
        Update: {
          age_group?: string
          club_id?: string
          id?: string
          is_active?: boolean
          level?: string
          name?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_groups_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_groups_schedule_id_schedules_id_fk"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_trainings: {
        Row: {
          club_id: string
          converted_to_member_id: string | null
          court_id: string
          court_name: string
          created_at: string
          duration: number
          feedback_comments: string | null
          feedback_rating: number | null
          feedback_would_recommend: boolean | null
          id: string
          notes: string | null
          participant_date_of_birth: string
          participant_email: string
          participant_first_name: string
          participant_id: string
          participant_last_name: string
          participant_phone: string
          scheduled_date: string
          scheduled_time: string
          status: string
          trainer_id: string
          trainer_name: string
          updated_at: string
        }
        Insert: {
          club_id: string
          converted_to_member_id?: string | null
          court_id: string
          court_name: string
          created_at?: string
          duration: number
          feedback_comments?: string | null
          feedback_rating?: number | null
          feedback_would_recommend?: boolean | null
          id?: string
          notes?: string | null
          participant_date_of_birth: string
          participant_email: string
          participant_first_name: string
          participant_id?: string
          participant_last_name: string
          participant_phone: string
          scheduled_date: string
          scheduled_time: string
          status?: string
          trainer_id: string
          trainer_name: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          converted_to_member_id?: string | null
          court_id?: string
          court_name?: string
          created_at?: string
          duration?: number
          feedback_comments?: string | null
          feedback_rating?: number | null
          feedback_would_recommend?: boolean | null
          id?: string
          notes?: string | null
          participant_date_of_birth?: string
          participant_email?: string
          participant_first_name?: string
          participant_id?: string
          participant_last_name?: string
          participant_phone?: string
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          trainer_id?: string
          trainer_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_trainings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_trainings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_trainings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_club_memberships: {
        Row: {
          club_id: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          fee_configuration_id: string | null
          id: string
          is_active: boolean
          joined_at: string
          role: string
          status: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          fee_configuration_id?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: string
          status?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          fee_configuration_id?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: string
          status?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_club_memberships_club_id_clubs_id_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_club_memberships_fee_configuration_id_fkey"
            columns: ["fee_configuration_id"]
            isOneToOne: false
            referencedRelation: "fee_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_training_preferences: {
        Row: {
          can_teach_groups: Json | null
          club_id: string
          created_at: string
          id: string
          is_submitted: boolean
          last_modified_at: string | null
          max_sessions_per_week: number | null
          notes: string | null
          preferred_age_group: string | null
          preferred_court_ids: Json | null
          preferred_group_ids: Json | null
          preferred_level: string | null
          priority: number
          season_id: string
          special_requests: string | null
          submitted_at: string | null
          unavailable_dates: Json | null
          updated_at: string
          user_id: string
          user_role: string
          weekly_availability: Json
        }
        Insert: {
          can_teach_groups?: Json | null
          club_id: string
          created_at?: string
          id?: string
          is_submitted?: boolean
          last_modified_at?: string | null
          max_sessions_per_week?: number | null
          notes?: string | null
          preferred_age_group?: string | null
          preferred_court_ids?: Json | null
          preferred_group_ids?: Json | null
          preferred_level?: string | null
          priority?: number
          season_id: string
          special_requests?: string | null
          submitted_at?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
          user_id: string
          user_role: string
          weekly_availability?: Json
        }
        Update: {
          can_teach_groups?: Json | null
          club_id?: string
          created_at?: string
          id?: string
          is_submitted?: boolean
          last_modified_at?: string | null
          max_sessions_per_week?: number | null
          notes?: string | null
          preferred_age_group?: string | null
          preferred_court_ids?: Json | null
          preferred_group_ids?: Json | null
          preferred_level?: string | null
          priority?: number
          season_id?: string
          special_requests?: string | null
          submitted_at?: string | null
          unavailable_dates?: Json | null
          updated_at?: string
          user_id?: string
          user_role?: string
          weekly_availability?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_training_preferences_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_training_preferences_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_training_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          avatar_url: string | null
          billing_email: string | null
          bio: string | null
          city: string | null
          created_at: string
          current_period_end: string | null
          date_of_birth: string | null
          email: string
          emergency_contact: string | null
          emergency_phone: string | null
          full_name: string | null
          id: string
          phone: string | null
          postal_code: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          billing_email?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          current_period_end?: string | null
          date_of_birth?: string | null
          email: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          billing_email?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          current_period_end?: string | null
          date_of_birth?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          club_id: string
          court_id: string | null
          created_at: string | null
          end_time: string
          id: string
          priority: number | null
          start_time: string
          status: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          court_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          priority?: number | null
          start_time: string
          status?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          court_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          priority?: number | null
          start_time?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_balance_entry_atomic: {
        Args: {
          p_amount: number
          p_balance_id: string
          p_created_by?: string
          p_reason: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: {
          amount: number
          created_at: string
          created_by: string
          id: string
          member_balance_id: string
          reason: string
          reference_id: string
          reference_type: string
        }[]
      }
      calculate_member_fees: {
        Args: {
          p_club_id: string
          p_member_age: number
          p_member_type: string
          p_training_group?: string
        }
        Returns: {
          amount: number
          billing_cycle: string
          billing_unit_count: number
          club_id: string
          conditions: Json | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "fee_configurations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      calculate_payment_fee: {
        Args: { p_amount: number; p_payment_settings_id: string }
        Returns: number
      }
      calculate_season_weeks: {
        Args: { season_end: string; season_start: string }
        Returns: number
      }
      check_availability_overlap: {
        Args: {
          p_date: string
          p_end_time: string
          p_exclude_id?: string
          p_start_time: string
          p_trainer_id: string
        }
        Returns: {
          end_time: string
          id: string
          start_time: string
          status: string
        }[]
      }
      create_booking_safe: {
        Args: {
          p_club_id: string
          p_member_id: string
          p_schedule_id: string
          p_session_id: string
        }
        Returns: string
      }
      create_invoice_with_items: {
        Args: { p_invoice: Json; p_items: Json[] }
        Returns: string
      }
      generate_invoice_number: { Args: { p_club_id: string }; Returns: string }
      get_active_rate_tiers: {
        Args: { p_club_id: string }
        Returns: {
          base_rate: number
          club_id: string
          created_at: string
          description: string | null
          experience_level: string
          id: string
          is_active: boolean
          name: string
          training_types: Json
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hourly_rate_tiers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_active_sepa_mandate: {
        Args: { p_member_id: string }
        Returns: {
          account_holder: string
          address: Json
          bank_name: string
          bic: string
          club_id: string | null
          created_at: string
          creditor_id: string
          iban: string
          id: string
          is_active: boolean
          mandate_reference: string
          member_id: string
          revoke_reason: string | null
          revoked_at: string | null
          signature_date: string
        }
        SetofOptions: {
          from: "*"
          to: "sepa_mandates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_trainers: {
        Args: { p_club_id: string }
        Returns: {
          availability: Json
          bio: string | null
          club_id: string
          created_at: string
          date_of_birth: string
          email: string
          emergency_contact: Json
          experience: Json
          first_name: string
          hourly_rate: number | null
          id: string
          languages: Json
          last_name: string
          phone: string
          preferred_time_slots: Json
          profile_image_url: string | null
          qualifications: Json
          specializations: Json
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trainer_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_current_trainer_rate: {
        Args: { p_trainer_id: string }
        Returns: number
      }
      get_my_trainer_id: { Args: never; Returns: string }
      get_setting_value: {
        Args: { p_club_id?: string; p_key: string }
        Returns: string
      }
      get_settings_as_object: {
        Args: {
          p_category?: string
          p_club_id?: string
          p_public_only?: boolean
        }
        Returns: Json
      }
      get_trainer_full_name: { Args: { p_trainer_id: string }; Returns: string }
      get_trial_training_stats: {
        Args: { p_club_id: string; p_end_date?: string; p_start_date?: string }
        Returns: {
          cancelled: number
          completed: number
          conversion_rate: number
          converted: number
          no_show: number
          scheduled: number
          total: number
        }[]
      }
      get_upcoming_trial_trainings: {
        Args: { p_club_id: string; p_days?: number }
        Returns: {
          club_id: string
          converted_to_member_id: string | null
          court_id: string
          court_name: string
          created_at: string
          duration: number
          feedback_comments: string | null
          feedback_rating: number | null
          feedback_would_recommend: boolean | null
          id: string
          notes: string | null
          participant_date_of_birth: string
          participant_email: string
          participant_first_name: string
          participant_id: string
          participant_last_name: string
          participant_phone: string
          scheduled_date: string
          scheduled_time: string
          status: string
          trainer_id: string
          trainer_name: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trial_trainings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_club_ids: { Args: never; Returns: string[] }
      get_valid_fee_configurations: {
        Args: { p_club_id: string; p_date?: string }
        Returns: {
          amount: number
          billing_cycle: string
          billing_unit_count: number
          club_id: string
          conditions: Json | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "fee_configurations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_active_sepa_mandate: {
        Args: { p_member_id: string }
        Returns: boolean
      }
      increment_member_balance: {
        Args: { p_amount: number; p_balance_id: string }
        Returns: undefined
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      is_club_trainer: { Args: { p_club_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      timeslots_overlap: {
        Args: {
          day1: number
          day2: number
          end1: string
          end2: string
          start1: string
          start2: string
        }
        Returns: boolean
      }
      user_available_at: {
        Args: {
          p_day_of_week: number
          p_end_time: string
          p_season_id: string
          p_specific_date?: string
          p_start_time: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

