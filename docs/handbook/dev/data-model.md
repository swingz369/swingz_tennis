# Datenmodell — alle Tabellen, ER-Diagramm, Migrations-Chronologie

> ⚠️ **Dieser Inhalt wird automatisch generiert** durch `npm run docs:autogen` (Skript: [`scripts/docs-autogen.ts`](../../scripts/docs-autogen.ts)).
> Quelle: `src/infrastructure/persistence/schema/`.
> Manuelle Edits NUR außerhalb der `<!-- AUTOGEN:-->`-Marker.

## 🗄 Schema-Übersicht (≈90 Tabellen, 137 Migrations)

Die Datenbank ist multitenancy-fähig (`club_id` auf den meisten Tabellen) und nutzt `auth.users` (Supabase) als User-Stamm. RLS-Policies in `supabase/migrations/*_rls_*.sql` isolieren Daten pro Club.

### Domänen-Cluster

```
┌── AUTH & USER ───────────────────────────────────────────┐
│ auth.users (Supabase)                                     │
│ user_club_memberships (user × club × role + office_flags) │
│ trainer_profiles                                            │
│ members (member-Domain-Entity, 1:1 zu auth.users)         │
└───────────────────────────────────────────────────────────┘

┌── CLUB & INFRASTRUKTUR ──────────────────────────────────┐
│ clubs                                                       │
│ court_types (Sandplatz, Halle, …)                          │
│ courts (1 court = 1 row, owned by club)                    │
│ club_branding (logo, primary/secondary color)              │
│ club_features JSONB (siehe feature-flags.md)               │
│ club_access_requests (Switch-Request Owner↔Admin)          │
└───────────────────────────────────────────────────────────┘

┌── TERMINE, SESSIONS, BOOKINGS ────────────────────────────┐
│ schedules (Wochen-Templates)                               │
│ sessions (konkretes Datum × Uhrzeit × court)               │
│ bookings (member×session)                                  │
│ attendance_records (QR-Checkin)                            │
│ session_rsvps (RSVP-Status)                                │
│ season_waitlists                                           │
│ trainer_absence_tracking                                    │
│ trainer_availabilities / trainer_availability              │
└───────────────────────────────────────────────────────────┘

┌── SAISONPLANUNG ──────────────────────────────────────────┐
│ seasons + season_history                                   │
│ training_groups + season_plan_entries                      │
│ season_billing_configs                                     │
│ seasonal_planning_history                                  │
│ seasonal_planning_conflicts                                 │
└───────────────────────────────────────────────────────────┘

┌── FINANCE ────────────────────────────────────────────────┐
│ invoices + invoice_line_items                              │
│ fee_configurations                                          │
│ payment_settings                                            │
│ season_billing (per-club)                                   │
│ dunning_records / mahnwesen_verzugszins                    │
│ stripe_events (Idempotenz-Webhook-Log)                     │
│ sepa_mandates (Lastschrift)                                │
│ trainer_billing + billing_line_items                       │
│ hours_logs + uebungsleiter_pauschale                       │
│ billing_training_system (NEW 2026-05-19)                   │
└───────────────────────────────────────────────────────────┘

┌── SPIELBETRIEB ───────────────────────────────────────────┐
│ tournaments + tournament_participants                       │
│ leagues + league_matchdays                                 │
│ match_results (ELO-tracked)                                 │
│ match_caterings                                             │
│ open_matches (Spielpartner-Suche)                           │
│ special_events                                              │
└───────────────────────────────────────────────────────────┘

┌── ENGAGEMENT & KOMMUNIKATION ─────────────────────────────┐
│ notifications + notification_dispatch                     │
│ messaging (1:1-Chat) + messaging_broadcast                  │
│ newsletters (Mitglieder-Newsletter)                        │
│ news_posts (Vereins-Neuigkeiten)                            │
│ feedback (DSGVO-Audit)                                     │
│ decision_proposals (Mitgliederabstimmung)                  │
│ audit_logs (DSGVO-required)                                │
└───────────────────────────────────────────────────────────┘

┌── SHOP, ARBEITSDIENST, FEATURES ───────────────────────────┐
│ shop_products + shop_orders                                │
│ work_duty_assignments                                       │
│ push_subscriptions (Web-Push)                              │
│ contact_requests (Trial-Training-Website-Form)             │
│ trial_trainings (Anmeldungen öffentlich)                   │
│ background_jobs (Runner-Status)                            │
│ user_dashboard_preferences (Custom-Widget-Layout)          │
└───────────────────────────────────────────────────────────┘

┌── ADMINISTRATION ──────────────────────────────────────────┐
│ feature_flags (per club_im JSONB in clubs.features)      │
│ office_flags (per membership als JSONB)                   │
│ nuliga_sync_log + nuliga_url                               │
│ dtb_id_fields                                               │
└───────────────────────────────────────────────────────────┘
```

<!-- AUTOGEN:BEGIN data-model — ab hier wird bei jedem docs:autogen überschrieben -->

## Gelistete Tabellen (Top-Down via Schema)

> Vollständige Liste wird beim nächsten Auto-Gen-Run erzeugt. Aktuell: ~90 Tabellen, alphabetisch grob geordnet:

| Tabelle                       | Domain       |  Club-Scope?   | Soft-Delete? |
| ----------------------------- | ------------ | :------------: | :----------: |
| attendance_records            | Booking      |       ✅       |      ❌      |
| audit_decision_changes        | Audit        |       ✅       |      ❌      |
| audit_logs                    | Audit        |       ✅       |      ❌      |
| background_jobs               | System       |       ❌       |      ❌      |
| billing_line_items            | Billing      |       ✅       |      ❌      |
| booking_line_items            | Booking      |       ✅       |      ❌      |
| bookings                      | Booking      |       ✅       |      ❌      |
| caterings_caterings           | Match        |       ✅       |      ❌      |
| clubs                         | Club         |     (root)     |      ❌      |
| club_access_requests          | Club         |       ✅       |      ❌      |
| club_branding                 | Branding     |       ✅       |      ❌      |
| club_members (legacy)         | Club         |       ✅       |      ❌      |
| contact_requests              | Public       |       ❌       |      ❌      |
| court_types                   | Club         |       ✅       |      ❌      |
| courts                        | Club         |       ✅       |      ❌      |
| decision_proposals            | Engagement   |       ✅       |      ❌      |
| dtb_id_field                  | Member       |       ✅       |      ❌      |
| dunning_records               | Billing      |       ✅       |      ❌      |
| elo_history                   | Match        |       ✅       |      ❌      |
| feedback                      | DSGVO        |       ✅       |      ❌      |
| fee_configurations            | Billing      |       ✅       |      ❌      |
| hourly_rate_configs           | Billing      |       ✅       |      ❌      |
| hours_logs                    | Trainer      |       ✅       |      ❌      |
| invoice_line_items            | Billing      |       ✅       |      ❌      |
| invoices                      | Billing      |       ✅       |      ❌      |
| league_matchdays              | Liga         |       ✅       |      ❌      |
| leagues                       | Liga         |       ✅       |      ❌      |
| mahnwesen_verzugszins         | Billing      |       ✅       |      ❌      |
| match_results                 | Match        |       ✅       |      ❌      |
| members                       | Member       |       ✅       |      ❌      |
| messaging                     | Engagement   |   ✅ (pair)    |      ❌      |
| messaging_broadcast           | Engagement   |       ✅       |      ❌      |
| news_posts                    | News         |       ✅       |      ❌      |
| newsletters                   | Newsletter   |       ✅       |      ❌      |
| notification_dispatch         | Notification |       ✅       |      ❌      |
| notifications                 | Notification |       ✅       |      ❌      |
| nuliga_sync_log               | nuLiga       |       ✅       |      ❌      |
| nuliga_url                    | nuLiga       |       ✅       |      ❌      |
| office_flags                  | Membership   |       ✅       |      ❌      |
| open_matches                  | Matchmaking  |       ✅       |      ❌      |
| payment_settings              | Billing      | ❌ (singleton) |      ❌      |
| pricing_rules                 | Pricing      |       ✅       |      ❌      |
| push_subscriptions            | Push         | ✅ (per-user)  |      ❌      |
| scheduled_exports             | Export       |       ❌       |      ❌      |
| schedules                     | Schedule     |       ✅       |      ❌      |
| season_billing                | Billing      |       ✅       |      ❌      |
| season_billing_configs        | Billing      |       ✅       |      ❌      |
| season_history                | Season       |       ✅       |      ❌      |
| season_plan_entries           | Season       |       ✅       |      ❌      |
| season_waitlists              | Booking      |       ✅       |      ❌      |
| seasonal_planning_conflicts   | Season       |       ✅       |      ❌      |
| seasonal_planning_history     | Season       |       ✅       |      ❌      |
| seasons                       | Season       |       ✅       |      ❌      |
| sepa_mandates                 | Billing      | ✅ (per-user)  |      ❌      |
| sessions                      | Booking      |       ✅       |      ❌      |
| session_rsvps                 | Booking      |       ✅       |      ❌      |
| shop_orders                   | Shop         |       ✅       |      ❌      |
| shop_products                 | Shop         |       ✅       |      ❌      |
| special_events                | Match        |       ✅       |      ❌      |
| stripe_events                 | Billing      |       ❌       |      ❌      |
| subscription_tiers            | Plan         |  ❌ (global)   |      ❌      |
| system_settings               | System       | ❌ (singleton) |      ❌      |
| trainer_absence_tracking      | Trainer      |       ✅       |      ❌      |
| trainer_availabilities (neu)  | Trainer      |       ✅       |      ❌      |
| trainer_availability (legacy) | Trainer      |       ✅       |      ❌      |
| trainer_billing               | Trainer      |       ✅       |      ❌      |
| trainer_member_notes          | Trainer      |       ✅       |      ❌      |
| trainer_profiles              | Trainer      |       ✅       |      ❌      |
| trainers                      | Trainer      |       ✅       |      ❌      |
| training_group_weeks          | Season       |       ✅       |      ❌      |
| training_groups               | Season       |       ✅       |      ❌      |
| trial_trainings               | Public       |       ❌       |      ❌      |
| tournament_participants       | Tournament   |       ✅       |      ❌      |
| tournaments                   | Tournament   |       ✅       |      ❌      |
| uebungsleiter_pauschale       | Trainer      |       ✅       |      ❌      |
| user_club_memberships         | Auth         |     (root)     |      ❌      |
| user_dashboard_preferences    | UI           |   (per-user)   |      ❌      |
| walk_in_sessions              | Match        |       ✅       |      ❌      |
| weather_alerts                | Weather      |       ✅       |      ❌      |
| work_duty_assignments         | Work         |       ✅       |      ❌      |

<!-- AUTOGEN:END -->

## 🗓 Migrations-Chronologie (137 Dateien, 2025-04-28 → 2026-07-29)

```
2025-04-28  001-004   RLS-Policies (4 Dateien)
2026-05-02–06   billing-system, court-booking, hourly-rate, security-fixes, …
2026-05-06    feedback, RLS-Helpers, GIST-Booking-Constraint, Trainer-Billing,
              Hours-Log, Trainer-Availability, Trainer-Absences, Fee-Configs,
              Payment-Settings, System-Settings, Trial-Trainings,
              Trainer-Profiles, Hourly-Rate-Tables, SEPA-Mandates,
              Background-Jobs, Enhanced-Booking-Rules, Season-Planning-Groups,
              News-System, Trainer-Availability
2026-05-07    schema_consolidation (BIG — das ist zentral), Tournament-System
2026-05-13    messaging_notifications, performance-indexes, phase25 (RLS + tables)
2026-05-14    court_id auf bookings
2026-05-16    user_profile_fields, performance_indices
2026-05-18    fix_trainer_availability_day_mapping
2026-05-19    billing_training_system (NEU), billing_helpers, invoices-generated-status,
              fix_season_planning_history_trigger (SECURITY DEFINER)
2026-05-20    fix_planning_status_check_constraint
2026-06-01–05  club_id auf training_groups, member_schedule_preferences,
              missing_planning_columns, ensure_trainers_records,
              session_rsvps, user_club_unique, drop_legacy_trainer_tables,
              season_billing_configs
2026-06-07    dunning_RLS, dunning_RLS_null_member, extend_invoices_status_check,
              fix_gobd_trigger, sync_dunning_records, sync_invoices_drizzle
2026-06-08    missing_billing_columns, backfill Dunning/Invoices membre_id,
              deploy_billing_triggers
2026-06-10    trainer_dual_rate, unassigned_rate_threshold, club_features_jsonb
2026-06-11    fix_trial_trainings_status_check, test_negation
2026-06-12    family_roles, attendance_confirmation, contact_requests,
              messaging_broadcast
2026-06-13    branding_and_avatar, user_dashboard_preferences
2026-06-20    absence_tracking, niveau_level_steps, session_cancellation,
              session_waitlist, trainer_member_notes, trainer_slot_waitlist
2026-06-21    add_owner_role (P0), season_waitlists, extend_trainer_feedback
2026-06-22    club_access_requests, overdue_invoice_cron
2026-06-23    stripe_events_idempotency, vereins_features
2026-06-24    hours_logs_rejection_reason, audit_decision_changes,
              fix_auth_users_FKs, fix_RLS_auth_users_policies,
              fix_trainer_profiles_user_FK, mahnwesen_verzugszins_decisions,
              match_results
2026-06-25    fix_RLS_club_members_references, office_flags, uebungsleiter_pauschale
2026-06-26    audit_logs_DSGVO_idx, walk_in_sessions
2026-06-27    season_group_weeks
2026-06-28    stripe_quantity_sync, atomic_invoices_RPC
2026-06-29    club_features (Cleanup), season_planning_config_optimizations
2026-06-30    missing_FK_indexes, reactivation_tracking, updated_at_triggers,
              elo_trigger, fix_gobd_trigger_total_amount, match_caterings,
              newsletter, recorrect_season_plan_entries_group_FK,
              RLS_member_schedule_preferences, season_billing_configs_billing_model,
              season_plan_entries_sessions_per_week,
              season_plan_entries_substitute_trainer, widen_planning_status_varchar
2026-07-01    fix_planning_conflicts_severity_check,
              widen_season_planning_history_action_type_check
2026-07-15    dtb_id_field, new_feature_tables, nuliga_sync_log, nuliga_url,
              open_matches, push_subscriptions
2026-07-16    add_require_payment
2026-07-23    special_events
2026-07-24    fix_RLS_missing_tables, subscription_tiers
2026-07-25    dynamic_pricing_rules, fix_planning_conflicts_type_check
2026-07-26    add_court_usable_for_training
2026-07-27    fix_trainer_availabilities_RLS
2026-07-28    fix_background_jobs_locking
2026-07-29    nuliga_import_unique_constraints
```

Vollständige Liste mit Datum + Beschreibung: Skript `scripts/docs-autogen.ts`.

## 🔗 Wichtige Cross-Table-Beziehungen

```
auth.users ──── 1:1 ──── user_club_memberships ──── n:1 ──── clubs
       │                (mit role, club_id, office_flags, is_active)
       ├─── 1:1 ──── members (member-Domain-Entity)
       ├─── 1:1 ──── trainer_profiles ──── 1:n ──── trainers
       ├─── 1:n ──── trainer_member_notes
       ├─── 1:n ──── bookings ──── n:1 ──── sessions ──── n:1 ──── courts
       ├─── 1:n ──── invoices ──── 1:n ──── invoice_line_items
       ├─── 1:n ──── sepa_mandates
       └─── 1:1 ──── push_subscriptions

clubs ──── 1:n ──── courts ──── n:1 ──── court_types
   ├─── 1:1 ──── club_branding
   ├─── 1:1 ──── club_features JSONB
   ├─── 1:n ──── seasons ──── 1:n ──── season_plan_entries ──── n:1 ──── training_groups
   ├─── 1:n ──── bookings, invoices, fees, …
   └─── 1:n ──── audit_logs (action="club.created", …)
```

## 🧪 Wie arbeite ich mit dem Schema?

1. **Schema-Quelle:** `src/infrastructure/persistence/schema.ts` (Drizzle).
2. **Drizzle-Kit:** `drizzle.config.ts` — generiert Migrations aus Schema (nur für Staging sinnvoll, in Prod manuell).
3. **Manuelle Migrations:** `supabase/migrations/*.sql` — verbindlich. Jeden Commit mit Schema-Änderung MUSS eine Migration mitliefern.
4. **Test:** `src/__tests__/db/schema.test.ts` — prüft, dass alle Tabellen vorhanden sind (Stand `2026-07-01` ist erwartet).

## 📚 Verwandte Kapitel

- [`drizzle-orm.md`](./drizzle-orm.md) — wie du eine neue Tabelle anlegst
- [`supabase-setup.md`](./supabase-setup.md) — wie du eine RLS-Policy ergänzt
- [`feature-flags.md`](./feature-flags.md) — JSONB-Spalte `clubs.features` als Toggle-Registry
