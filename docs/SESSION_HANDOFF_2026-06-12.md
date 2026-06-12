# Session Handoff — 2026-06-12

> **Zweck:** Übersicht aller Änderungen dieser Session (inkl. Fortsetzung) für sauberen Abschluss in einer frischen Session.

---

## 1. Commit-Übersicht

| #   | Hash      | Typ                   | Beschreibung                                                                | Dateien |
| --- | --------- | --------------------- | --------------------------------------------------------------------------- | ------- |
| 1   | `649f537` | feat(messaging)       | Messaging-System (API, UI, Sidebar, Notification Bell, Broadcast-Migration) | 5       |
| 2   | `d2b9f38` | feat(contact)         | Kontaktformular API + Migration                                             | 3       |
| 3   | `d170929` | feat(court-calendar)  | Tooltips, Booking-Badges, Warnung, Mobile Swipe, a11y-Fixes                 | 6       |
| 4   | `0ec7b97` | feat(billing)         | Subscription entfernt, Rechnungslöschung, Live-Suche, onBlur                | 13      |
| 5   | `718496a` | feat(trainer)         | Dual-Rate, Status-Toggle, Saisonplan-Config                                 | 1       |
| 6   | `d2a5e89` | feat(bookings)        | Training-Tab in Buchungsseite integriert                                    | 2       |
| 7   | `b47675f` | chore(public-pages)   | Landing, About, Contact, Login, Register, Datenschutz                       | 13      |
| 8   | `02dc389` | feat(family-accounts) | Family Switcher, Member Groups, Migration                                   | 6       |
| 9   | `70ea1c6` | chore(admin)          | Admin Dashboard, Branding, Settings (ESLint-Fix: TDZ)                       | 4       |
| 10  | `d53c3ea` | chore(infra)          | Env, Stripe, Email, Swagger, Calendar-Export, SW, globals.css               | 15      |
| 11  | `4a55053` | docs                  | Session-Handoff-Dokument                                                    | 1       |
| 12  | `3a36ae7` | feat(ui)              | Multi-Select Rechnungen, einheitliche Detailseiten, Admin-Platzkarten       | 5       |
| 13  | `766fa74` | feat(billing)         | Rechnungs-Vorschau-Modal mit Mitgliederauswahl                              | 2       |
| 14  | `a07140b` | refactor(billing)     | Shared Helper für GET/POST Invoice-Preview-Logik                            | 1       |

---

## 2. Feature-Details

### Feature: Messaging-System (komplett neu)

| Datei                                                  | Änderung                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20260612_messaging_broadcast.sql` | `broadcast_type` Spalte + Indexes auf `messages`                                                             |
| `app/api/messages/route.ts`                            | POST: Direkt + Broadcast (Admin-only, Service Client). GET: `?countOnly=true` für lightweight unread polling |
| `app/(protected)/messages/page.tsx`                    | **NEU** — Komplette Messaging-UI: Inbox/Sent, Suche, Detail, Compose mit Empfänger-Auswahl                   |
| `components/layout/sidebar.tsx`                        | "Nachrichten"-Link für alle Rollen (MessageSquare)                                                           |
| `components/layout/notification-bell.tsx`              | Kombinierter Unread-Count (Notifications + Messages via `?countOnly=true`)                                   |

### Feature: Rechnungen — Multi-Select & Bulk Delete

| Datei                                              | Änderung                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(protected)/admin/billing/billing-client.tsx` | Checkbox-Spalte mit Select-All (Indeterminate), Floating Action Bar, Bulk-Delete-Confirm-Dialog, Auswahl wird bei Filterwechsel zurückgesetzt |
| `app/(protected)/admin/billing/billing-client.tsx` | Bezahlte Rechnungen können nicht ausgewählt werden                                                                                            |

### Feature: Rechnungs-Vorschau-Modal

| Datei                                              | Änderung                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(protected)/admin/billing/billing-client.tsx` | "Rechnungen generieren" zeigt jetzt Vorschau-Modal: Gebühr, Mitgliederliste mit Checkboxen, Auswählen/Abwählen, laufender Gesamtbetrag |
| `app/api/billing/generate-invoices/route.ts`       | GET-Endpoint für Vorschau (erstellt keine Rechnungen). POST akzeptiert `excludeMemberIds` Array                                        |

### Refactor: Shared Invoice Preview Helper

| Datei                                        | Änderung                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/billing/generate-invoices/route.ts` | `resolveClubId()` — dedupliziert Club-ID-Auflösung. `getInvoicePreviewData()` — gemeinsamer Helper für GET + POST (~60 Zeilen Duplikation eliminiert). Neue Interfaces: `PreviewMember`, `AlreadyBilledMember`, `InvoicePreviewData` |

### Feature: Einheitliche Detailseiten (Hybrid Layout)

| Datei                                                          | Änderung                                                                                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(protected)/admin/members/[id]/members-detail-client.tsx` | **Komplett rewritten** — Breadcrumb + Gradient-Header + Tabs (Profil, Präferenzen, Rechnungen, Buchungen) + Bestätigungs-Dialoge für Deaktivierung + Rollenwechsel zu Admin |
| `app/(protected)/trainer/profile/page.tsx`                     | **Komplett rewritten** — Selbes Hybrid-Layout für Trainer-Eigenprofil (Breadcrumb + Gradient-Header + Tabs)                                                                 |
| `components/member-profile.tsx`                                | **Komplett rewritten** — Selbes Hybrid-Layout für Member-Eigenprofil (Breadcrumb + Gradient-Header + Tabs)                                                                  |

**Einheitliches Pattern (alle 4 Detailseiten):**

- Breadcrumb: `← Liste > Name`
- Rounded-2xl Container mit Gradient-Header (Avatar, Name, E-Mail, Status-Badges, Edit-Button)
- Tabs mit Underline-Style Active Indicator
- `Card variant="bordered"` + Design-System-Badges konsistent
- Footer mit Aktivieren/Deaktivieren + Speichern/Abbrechen
- Bearbeitungsmodus-Banner mit Abbrechen-Button

### Feature: Admin-Platzkarten

| Datei                                   | Änderung                                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/unified-court-calendar.tsx` | Admins sehen jetzt zuerst die Platz-Auswahlkarten (gleich wie Members). Heutige Belegung pro Platz (X von Y Slots frei). Rollenbasierter Subtitle. Zurück-Button für beide Rollen. Null-Sessions-Warnung (amber) bereits auf Karten-Seite vorhanden. |

### Feature: Training-Tab in Buchungsseite

| Datei                                        | Änderung                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `app/(protected)/bookings/page.tsx`          | 3. Tab "Training" mit `MemberTrainingSchedule`. Default: Platz-Kalender |
| `app/(protected)/training-schedule/page.tsx` | Redirect zu `/bookings?tab=training`                                    |

### Feature: Rechnungen löschen

| Datei                                              | Änderung                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/api/billing/invoices/[id]/route.ts`           | DELETE-Endpoint: Admin/Superadmin-Check, Schutz bezahlter Rechnungen, Cascade-Delete via Service Client |
| `app/(protected)/admin/billing/billing-client.tsx` | Löschen-Button (Trash2) + Bestätigungsdialog mit Warnung bei versendeten Rechnungen                     |

### Feature: Live-Suche für Rechnungserstellung

| Datei                                          | Änderung                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `components/billing/create-invoice-dialog.tsx` | Select-Dropdown → Live-Suche mit Rollen-Badges (Trainer/Member) |
| `app/(protected)/admin/billing/page.tsx`       | Query inkl. Trainer + Rollen                                    |

### Cleanup: Subscription-Feature entfernt

| Datei                                                   | Änderung                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `app/(protected)/admin/billing/billing-client.tsx`      | Entfernt: Abonnement-Tab, "Abonnement zuweisen" Button/Dialog, Subscription-Type |
| `app/(protected)/admin/clubs/[clubId]/billing/page.tsx` | Entfernt: Subscription-Import, initialSubscriptions prop                         |

### Feature: Trainer Dual-Rate & Status-Toggle

| Datei                                                    | Änderung                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `app/(protected)/admin/trainers/trainer.types.ts`        | `contracted_hourly_rate` + `extra_hours_rate` Felder hinzugefügt |
| `components/trainer-profile-management.tsx`              | Aktivieren/Deaktivieren Toggle (UserCheck/UserX Icons)           |
| `app/(protected)/admin/settings/season-planning-tab.tsx` | `unassigned_rate_threshold` Config mit adaptive Backtrack        |
| `app/api/seasons/[id]/planning/config/route.ts`          | API: Validierung für `unassigned_rate_threshold` (0–1)           |
| `supabase/migrations/20260610_add_trainer_dual_rate.sql` | Dual-Rate DB-Migration                                           |

### Feature: Platz-Kalender Verbesserungen

| Datei                                   | Änderung                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `app/api/sessions/route.ts`             | `bookerNames` im Response via Booking→Users-Join                                                   |
| `hooks/use-sessions.ts`                 | `bookerNames?: string[]` zum Session-Interface                                                     |
| `components/unified-court-calendar.tsx` | Tooltip mit Buchungsperson-Namen, Booking Count Badge (amber), Null-Sessions-Warnung, Mobile Swipe |
| `lib/court-calendar-utils.ts`           | Shared Calendar-Utilities                                                                          |

### Feature: Kontaktformular API

| Datei                                                      | Änderung                          |
| ---------------------------------------------------------- | --------------------------------- |
| `app/api/contact/route.ts`                                 | POST-Endpoint für Kontaktformular |
| `app/contact/contact-form-client.tsx`                      | Client-Verbesserungen             |
| `supabase/migrations/20260612_create_contact_requests.sql` | `contact_requests` Tabelle + RLS  |

### Feature: Family Accounts

| Datei                                               | Änderung                      |
| --------------------------------------------------- | ----------------------------- |
| `app/api/family-accounts/route.ts`                  | Family Account Management API |
| `app/api/user/member/groups/`                       | Member Groups Query           |
| `components/layout/family-switcher.tsx`             | Family Switcher in Sidebar    |
| `hooks/use-family-accounts.ts`                      | Family Accounts Hook          |
| `hooks/use-member-groups.ts`                        | Member Groups Hook            |
| `supabase/migrations/20260612_add_family_roles.sql` | Family Roles Migration        |

### Chore: Public Pages

| Datei                          | Änderung                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `app/landing/page.tsx`         | Copy: "Jetzt testen" statt "Kostenlos testen", "Jetzt wählen" statt "Kostenlos starten" |
| `app/about/page.tsx`           | CTA: "Mehr erfahren" statt "Kostenlos starten"                                          |
| `app/contact/page.tsx`         | Nav-Button-Text Update                                                                  |
| `app/login/page.tsx`           | UI-Polish                                                                               |
| `app/forgot-password/page.tsx` | UI-Polish + API-Route                                                                   |
| `app/privacy/page.tsx`         | Content-Updates                                                                         |
| `app/datenschutz/page.tsx`     | Content-Updates                                                                         |
| `app/terms/page.tsx`           | Content-Updates                                                                         |

### Chore: Infrastructure

| Datei                                   | Änderung                       |
| --------------------------------------- | ------------------------------ |
| `.env.example`                          | Neue Environment Variables     |
| `app/globals.css`                       | Styling-Updates                |
| `app/api/shop/checkout/route.ts`        | Stripe Checkout Updates        |
| `app/api/stripe/checkout/route.ts`      | Stripe Client Updates          |
| `components/sw-registration.tsx`        | Service Worker Updates         |
| `config/email.config.ts`                | Email-Config-Updates           |
| `lib/auth/send-password-reset-email.ts` | Password-Reset-Email           |
| `lib/calendar-export.ts`                | Calendar-Export-Verbesserungen |
| `lib/stripe/stripe-client.ts`           | Stripe-Client-Updates          |
| `lib/swagger/swagger-config.ts`         | Swagger-Config-Updates         |

### Bugfix: Settings TDZ

| Datei                                                | Änderung                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/(protected)/admin/settings/settings-client.tsx` | `fetchSettings` Temporal-Dead-Zone ESLint-Fehler behoben (Funktion vor `useEffect` verschoben) |

---

## 3. Offene Tasks (für nächste Session)

### Sub-Task 2/4 abschließen (Dual Rate Schema)

- `src/infrastructure/persistence/schema.ts` — Drizzle-Schema: `contracted_hourly_rate` + `extra_hours_rate` ergänzen
- `supabase-types.ts` + `types/supabase.ts` — Row/Insert/Update-Typen ergänzen

### Sub-Task 3a/3b (Dual Rate UI)

- Admin-only Input für `contracted_hourly_rate` in `trainer-detail-client.tsx` (Lock-Icon + disabled für non-admin)
- Trainer-editable Input für `extra_hours_rate` (immer sichtbar + Hint)

### API-Role-Check

- `app/api/trainer-profiles/[id]/route.ts` PATCH: Admin-only für `contracted_hourly_rate`, beide Rollen für `extra_hours_rate`

---

## 4. Validierung

```bash
cd /home/aeugeln/SwingZ

# TypeScript
npx tsc --noEmit 2>&1 | head -30

# ESLint
npx eslint --max-warnings=10 \
  'app/(protected)/admin/billing/billing-client.tsx' \
  'app/api/billing/generate-invoices/route.ts' \
  'app/(protected)/admin/members/[id]/members-detail-client.tsx' \
  'app/(protected)/trainer/profile/page.tsx' \
  'components/member-profile.tsx' \
  'components/unified-court-calendar.tsx' \
  2>&1 | tail -10

# Unit Tests
npx vitest run src/__tests__/lib/load-config.test.ts --reporter=default
```

---

## 5. Git-Status

- **Branch:** `main`
- **Working Tree:** sauber (alle Änderungen committed)
- **14 Commits** in dieser Session
- **Letzter Commit:** `a07140b` refactor(billing): extract shared helper for GET/POST invoice preview logic

---

_Erstellt am 2026-06-12. Aktualisiert in der Fortsetzungs-Session._
