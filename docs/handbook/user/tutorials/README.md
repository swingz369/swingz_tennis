# SwingZ · Schritt-für-Schritt-Tutorials

> **Code-grounded Walkthroughs.** Jedes Tutorial listet 1:1 die realen Eingabefelder, Buttons und Validierungen aus den Client-Komponenten. Stand: Schema + Components, kein generischer Fließtext.

## Rollen-Übersicht

| Rolle                                      | Tutorials                                                                                                                                                                                                            | Haupt-Einstieg                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Probetraining-Interessent** (kein Login) | [`public-trial-booking.md`](./public-trial-booking.md)                                                                                                                                                               | `https://<dein-club>.vercel.app/trial-training?club=<id>` |
| **Mitglied**                               | [`member-getting-started.md`](./member-getting-started.md), [`member-bookings-and-attendance.md`](./member-bookings-and-attendance.md), [`member-profile-security-billing.md`](./member-profile-security-billing.md) | `/member` nach Login                                      |
| **Trainer**                                | [`trainer-availability.md`](./trainer-availability.md), [`trainer-sessions-and-checkin.md`](./trainer-sessions-and-checkin.md)                                                                                       | `/trainer` nach Login                                     |
| **Admin**                                  | [`admin-trial-approvals.md`](./admin-trial-approvals.md), [`admin-members-and-courts.md`](./admin-members-and-courts.md), [`admin-billing.md`](./admin-billing.md), [`admin-mahnwesen.md`](./admin-mahnwesen.md)     | `/admin` nach Login (mit gesetztem `ADMIN_CLUB_COOKIE`)   |

## Konventionen in diesen Tutorials

- **Klick-Pfad** = wie er tatsächlich in der UI steht (verbatim Label aus `components/...`).
- **Erwartung** = was das System macht / welche API gerufen wird.
- **Edge-Cases** = was schiefgehen kann + wie man es behebt.

## Quelldateien (für tiefe Code-Details)

- `components/public-trial-booking.tsx` — Probetraining-Formular
- `components/admin-trial-approvals.tsx` — Admin-Genehmigungen
- `components/member-profile.tsx` — Profil/2FA/SEPA-Tab-Logik
- `components/member-court-bookings.tsx` — Court-Bookings-Liste
- `components/attendance-history.tsx` — Anwesenheitshistorie
- `components/trainer-availability-manager.tsx` — Wochenplan-Editor
- `components/trainer-rsvp-list.tsx` — Session-Teilnehmer-Check-in
- `lib/billing/dunning.service.ts` — `calculateDunningLevel()` Stufen 0→1→2→3 (Trigger `calculate_dunning_level` auf `dunning_records`)
- `lib/billing/verzugszins.ts` — Verzugszins-Berechnung (Basiszinssatz + 9 Punkte über Basis, §288 BGB)
- `supabase/migrations/20260608_deploy_billing_triggers.sql` — GoBD-konformer Trigger-Deploy (REMINDER_SENT, ACCOUNT_FROZEN)
- `app/(protected)/*/layout.tsx` — Role-Guard-Logik (Redirects)
- `app/api/...` — REST-Endpunkte (Pfade in den jeweiligen Tutorials)
