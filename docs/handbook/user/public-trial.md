# Public Trial — Probetraining-Anmeldung (kein Login)

> Wer bist du? Du bist **noch kein Mitglied**. Du hast vom Verein eine Empfehlung bekommen oder bist auf der Landing Page gelandet. Du willst **eine Schnupperstunde** ausprobieren.

**URL:** `/trial-training` · **Kein Login erforderlich** · **Spezial-Rolle** (kein `users`-Eintrag)

---

## 🎯 Was kannst du hier?

- Vereins-Auswahl (welcher Verein interessiert dich?)
- Kontaktdaten eingeben (Name, E-Mail, Telefon)
- Wunsch-Termin auswählen
- Niveau-Angabe (Anfänger/Fortgeschritten)
- Sonderwünsche (Einzel-Training, Gruppen-Training, spezielle Trainer)
- DSGVO-Zustimmung (Pflicht-Checkbox)

Nach Submit:

- Eintrag in `trial_trainings`-Tabelle (Migration `20260506280000_trial_trainings_table.sql`)
- Notification an Admin (Service-Client!)
- E-Mail-Bestätigung an Interessenten
- Status: `pending_review` (Admin prüft manuell)

## 🌐 Page-Walkthrough (`/trial-training`)

Sektionen (Schritt-für-Schritt-Wizard):

1. **Header:** Vereins-Name + Logo
2. **Step 1: Verein auswählen** (Dropdown — wenn Verein Subdomain hat, evtl. vorausgewählt)
3. **Step 2: Datum** (nur verfügbare Slots, AJAX-Update bei Vereins-Wechsel)
4. **Step 3: Persönliche Daten** (Name, Email, Telefon, Geburtsdatum optional)
5. **Step 4: Spiel-Niveau + Wünsche** (Anfänger/Fortgeschritten, Schlägerseite, Trainer-Präferenz)
6. **Step 5: DSGVO-Zustimmung** (Pflicht-Checkbox)
7. **Submit**

Submit-Route: `POST /api/public/trial-training` (kein Auth, IP-Rate-Limited).

## ⚙ Was passiert intern?

```
1. POST /api/public/trial-training { club_id, datetime, name, email, phone, level, notes }
2. Zod-Validation (kein Auth-Check!)
3. Rate-Limit-Check: max 5 Requests / IP / Stunde (lib/rate-limit.ts)
4. INSERT trial_trainings { club_id, requested_at, status: 'pending_review', applicant_data }
5. INSERT notifications { type: 'trial_training_request', recipient_ids: [club_admin_id] }
6. POST cron/notification-dispatch (5 min später) → Email-an-Admin (Template: trial_request_admin)
7. POST email-an-Applicant (Template: trial_request_confirmation)

⚠️ PDSGVO: applicant_data ist NICHT anonymisiert in DB.
   Bei echter DSGVO-Löschung muss via admin/owner manuell anonymisiert werden.
```

## 🤝 Zusammenspiel mit anderen Rollen

| Edge-Case                      | Was passiert?                 | Folge                                                   |
| ------------------------------ | ----------------------------- | ------------------------------------------------------- |
| Bekannter Member-User          | E-Mail existiert bereits      | System warnt: "Du bist schon Mitglied — logge dich ein" |
| Admin lehnt ab                 | Status → 'rejected' mit Grund | E-Mail an Applicant: "Leider kein Platz"                |
| Admin bestätigt                | Status → 'approved'           | E-Mail: "Probetraining gebucht am DD.MM.YYYY Uhr"       |
| Wunsch-Trainer verfügbar       | Auto-Match                    | Trainer sieht Slot in `/trainer/sessions`               |
| Wunsch-Trainer NICHT verfügbar | Admin bekommt Hinweis         | Admin wählt Substitute                                  |

## ⚠️ Pflichten & Datenschutz

1. **DSGVO**: Public Trial ist eine **nicht-authentifizierte Daten-Erfassung** — der Verein muss Applicant-Daten nach Ablauf der Aufbewahrungsfrist löschen (typisch: 6 Monate).
2. **Spam-Schutz**: Honeypot-Feld + Rate-Limit (lib/csrf.ts).
3. **Double-Opt-In**: Aktuell **KEIN Double-Opt-In** (P2-Finding). Bestätigungs-E-Mail ist einseitig.
4. **Cookie-Usage**: Public Trial nutzt **keine Cookies** (kein Tracking für Interessenten).

## 🆙 Vom Interessent zum Mitglied

```
1. Trial approved → E-Mail mit Magic-Link (optional, wenn Verein will)
2. Interessent klickt → Supabase OAuth Signup (oder direkter Password-Setup)
3. Auth-User erstellt
4. INSERT user_club_memberships { role: 'member', club_id: X, is_active: true } (oder 'pending', dann Admin manuell approve)
5. INSERT members { user_id, default_niveau, … }
6. Welcome-E-Mail mit Onboarding-Checklist (Membership-Approval Variante)
```

## 🧪 Tests

`public-trial.test.ts`, `api/public/trial-training.test.ts`:

- Submit → Status pending in DB → Admin erhält Notification
- Validation-Fail (kein DSGVO-Check) → 400
- Spam-Test (5 Requests / Min) → 429

## 📚 Verwante Kapitel

- [`dev/auth-rbac.md`](../dev/auth-rbac.md) — Public-Auth-Pattern
- [`dev/api-conventions.md`](../dev/api-conventions.md) — wie eine public Route aussieht
- [`dev/notifications.md`](../dev/notifications.md) — Service-Client-Einsatz
- [`../user/member.md`](./member.md) — wenn du jetzt Mitglied werden willst
- [`../user/admin.md`](./admin.md) — wie der Admin Trial-Anfragen bearbeitet
