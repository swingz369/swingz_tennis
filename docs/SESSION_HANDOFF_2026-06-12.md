# Session Handoff — 2026-06-12

> **Zweck:** Übersicht aller Änderungen dieser Session für sauberen Abschluss in einer frischen Session.

---

## 1. Zusammenfassung der Änderungen

### Feature: Messaging-System (komplett neu)

| Datei                                                  | Änderung                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/20260612_messaging_broadcast.sql` | `broadcast_type` Spalte + Indexes auf `messages`                                                             |
| `app/api/messages/route.ts`                            | POST: Direkt + Broadcast (Admin-only, Service Client). GET: `?countOnly=true` für lightweight unread polling |
| `app/(protected)/messages/page.tsx`                    | **NEU** — Komplette Messaging-UI: Inbox/Sent, Suche, Detail, Compose mit Empfänger-Auswahl                   |
| `components/layout/sidebar.tsx`                        | "Nachrichten"-Link für alle Rollen (MessageSquare)                                                           |
| `components/layout/notification-bell.tsx`              | Kombinierter Unread-Count (Notifications + Messages via `?countOnly=true`)                                   |

### Feature: Training-Tab in Buchungsseite

| Datei                                        | Änderung                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `app/(protected)/bookings/page.tsx`          | 3. Tab "Training" mit `MemberTrainingSchedule`. Default: Platz-Kalender. Reihenfolge: Platz-Kalender → Training → Meine Buchungen |
| `app/(protected)/training-schedule/page.tsx` | Redirect zu `/bookings?tab=training` (war Duplikat)                                                                               |

### Feature: Rechnungen löschen

| Datei                                              | Änderung                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/api/billing/invoices/[id]/route.ts`           | DELETE-Endpoint: Admin/Superadmin-Check, Schutz bezahlter Rechnungen, Cascade-Delete via Service Client |
| `app/(protected)/admin/billing/billing-client.tsx` | Löschen-Button (Trash2) + Bestätigungsdialog mit Warnung bei versendeten Rechnungen                     |

### Feature: Live-Suche für Rechnungserstellung

| Datei                                          | Änderung                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `components/billing/create-invoice-dialog.tsx` | Select-Dropdown → Live-Suche mit Rollen-Badges (Trainer/Member)     |
| `app/(protected)/admin/billing/page.tsx`       | Query inkl. Trainer + Rollen (`.in('role', ['member', 'trainer'])`) |

### Cleanup: Subscription-Feature entfernt

| Datei                                                   | Änderung                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `app/(protected)/admin/billing/billing-client.tsx`      | Entfernt: Abonnement-Tab, "Abonnement zuweisen" Button/Dialog, Subscription-Type |
| `app/(protected)/admin/billing/page.tsx`                | Vereinfachte Members-Query                                                       |
| `app/(protected)/admin/clubs/[clubId]/billing/page.tsx` | Entfernt: Subscription-Import, initialSubscriptions prop                         |

### Feature: Platz-Kalender Verbesserungen

| Datei                                   | Änderung                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/sessions/route.ts`             | `bookerNames` im Response via Booking→Users-Join (`bookings_member_id_fkey`)                                                                                                                                                         |
| `hooks/use-sessions.ts`                 | `bookerNames?: string[]` zum Session-Interface                                                                                                                                                                                       |
| `components/unified-court-calendar.tsx` | Tooltip mit Buchungsperson-Namen + Belegungsquote, Booking Count Badge (amber), Null-Sessions-Warnung mit Link zu `/admin/seasons` (für Admins + Members), Mobile Swipe: ref-basiertes DOM-Feedback, niedrigere Schwelle (40px/1.2x) |

### DB Seed

- 4 neue Buchungen auf bisher ungebuchten Sessions erstellt (gesamt: 7 Buchungen auf 7 Sessions)

---

## 2. Offene Tasks (für nächste Session)

### Sub-Task 2/4 abschließen (Dual Rate)

- `src/infrastructure/persistence/schema.ts` — Drizzle-Schema: `contracted_hourly_rate` + `extra_hours_rate` ergänzen
- `supabase-types.ts` + `types/supabase.ts` — Row/Insert/Update-Typen ergänzen
- Commit nach Sektion 2 im SESSION_HANDOFF_2026-06-10.md

### Sub-Task 3a/3b (Dual Rate UI)

- Admin-only Input für `contracted_hourly_rate` in `trainer-detail-client.tsx` (Lock-Icon + disabled für non-admin)
- Trainer-editable Input für `extra_hours_rate` (immer sichtbar + Hint)

### API-Role-Check

- `app/api/trainer-profiles/[id]/route.ts` PATCH: Admin-only für `contracted_hourly_rate`, beide Rollen für `extra_hours_rate`

---

## 3. Validierung

```bash
cd /home/aeugeln/SwingZ

# TypeScript
npx tsc --noEmit 2>&1 | grep -iE 'messages|billing|calendar|sessions|notification-bell|sidebar' | head -30

# ESLint
npx eslint --max-warnings=10 \
  'app/api/messages/route.ts' \
  'app/(protected)/messages/page.tsx' \
  'components/layout/notification-bell.tsx' \
  'components/unified-court-calendar.tsx' \
  'app/(protected)/admin/billing/billing-client.tsx' \
  'app/api/billing/invoices/[id]/route.ts' \
  'components/billing/create-invoice-dialog.tsx' \
  2>&1 | tail -10

# Unit Tests
npx vitest run src/__tests__/lib/load-config.test.ts --reporter=default
```

---

_Erstellt am 2026-06-12. Alle Änderungen im Working Tree, noch nicht committed._
