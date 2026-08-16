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

| Edge-Case                      | Was passiert?                  | Folge                                                        |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------ |
| Bekannter Member-User          | E-Mail existiert bereits       | System warnt: "Du bist schon Mitglied — logge dich ein"      |
| Admin lehnt ab                 | Status → 'cancelled' mit Grund | E-Mail an Applicant: "Leider kein Platz"                     |
| Admin bestätigt                | Status → 'scheduled'           | E-Mail: "Probetraining gebucht am DD.MM.YYYY Uhr"            |
| Admin schließt ab              | Status → 'completed'           | Nurture-Flow startet: Danke-Mail mit Feedback- + Anmeldelink |
| Interessent erscheint nicht    | Status → 'no_show'             | kein Follow-up                                               |
| Wunsch-Trainer verfügbar       | Auto-Match                     | Trainer sieht Slot in `/trainer/sessions`                    |
| Wunsch-Trainer NICHT verfügbar | Admin bekommt Hinweis          | Admin wählt Substitute                                       |

## ⚠️ Pflichten & Datenschutz

1. **DSGVO**: Public Trial ist eine **nicht-authentifizierte Daten-Erfassung** — der Verein muss Applicant-Daten nach Ablauf der Aufbewahrungsfrist löschen (typisch: 6 Monate).
2. **Spam-Schutz**: Honeypot-Feld + Rate-Limit (lib/csrf.ts).
3. **Double-Opt-In**: Aktuell **KEIN Double-Opt-In** (P2-Finding). Bestätigungs-E-Mail ist einseitig.
4. **Cookie-Usage**: Public Trial nutzt **keine Cookies** (kein Tracking für Interessenten).

## 🆙 Nach dem Probetraining (Nurture-Flow)

Sobald der Admin das Probetraining als **abgeschlossen** (`completed`) markiert, übernimmt ein automatisierter Nurture-Flow die Neukunden-Gewinnung — niemand muss darauf warten, dass der Interessent von sich aus reagiert:

1. **Danke-Mail** (sofort beim Abschluss): mit Link zur Feedback-Seite und zur direkten Anmeldung.
2. **Feedback** (`/trial-training/feedback?p=<participant_id>`): der Interessent bewertet das Training (1–5 Sterne + Kommentar + „würdest du weiterempfehlen") — ohne Login, geschützt über die nicht erratbare `participant_id`.
3. **Erinnerung** (nach 2 Tagen, via Cron `/api/cron/trial-followup`): „Noch unentschlossen? Werde Mitglied".
4. **Letzter Anstoß** (nach 7 Tagen): „Dein Platz wartet auf dich".

## 🆙 Vom Interessent zum Mitglied (Self-Service)

Statt auf einen Admin-Klick zu warten, kann sich der Interessent über den Link in der Mail **selbst** anmelden (`/trial-training/anmeldung?p=<participant_id>`):

```
1. Interessent legt selbst ein Passwort fest (min. 8 Zeichen).
2. Auth-User wird erstellt (oder ein bestehender User mit derselben E-Mail genutzt).
3. INSERT user_club_memberships { role: 'member', club_id, is_active: true }.
4. Das Probetraining wird als 'converted' markiert.
5. Willkommens-Notification an den neuen Mitglieder-Account.
```

Der klassische Admin-Weg bleibt bestehen („Zu Mitglied konvertieren", siehe [`admin-trial-approvals.md`](./tutorials/admin-trial-approvals.md)).

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
