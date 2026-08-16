# Member — Vereins-Mitglied

> Wer bist du? Du bist Mitglied in einem (oder mehreren) Vereinen. Du buchst Sessions, gibst RSVP, verwaltest dein Profil und deine SEPA-Lastschrift.

**Dashboard:** `/member` · **Rolle in Hierarchie:** Stufe 1 (niedrigste Berechtigungs-Stufe im System) · **club_id:** gesetzt (mehrere möglich)

---

## 🎯 Was kannst du?

- **Sessions buchen** (RSVP) oder **stornieren**
- **Court-Bookings** (Platz für freies Spiel) erstellen
- **Open-Matches** posten (suche Spielpartner)
- **Profil** pflegen: Foto, Spieler-Niveau (DTB-Lizenz), Präferenzen
- **SEPA-Lastschrift-Mandat** erteilen (für Beiträge)
- **Familienkonto** verwalten: Kinderkonten per Einladungscode verknüpfen und für Kinder buchen (wenn Modul aktiv)
- **Rechnungen** ansehen + per Stripe zahlen
- **Messaging** mit Trainern
- **Notifications** (Push + E-Mail) konfigurieren
- **Decisions** (Mitglieder-Abstimmungen) mitentscheiden (wenn Modul aktiv)
- **Newsletter** abonnieren/lesen

## 🖥 Dashboard — `/member`

Oben-Sektionen:

1. **Meine nächsten Sessions** — Top-3 der gebuchten Slots
2. **Quick-Actions** — "Buchen", "Platz reservieren", "RSVP heute", "Chat mit Trainer"
3. **Offene Rechnungen** — falls Pay-Pending → direkter Stripe-Link
4. **Mitglieder-News** — letzte 5 Vereins-Posts
5. **Gamification-Widget** — Streak, Level-Up (wenn aktiv)

## 🧭 Pages (Member-Bereich)

### Sessions & Buchungen

| Page                    | Zweck                                                          |
| ----------------------- | -------------------------------------------------------------- |
| `/member`               | Dashboard                                                      |
| `/member/sessions`      | Alle deiner Sessions (heute/Woche/Monat/Alle)                  |
| `/member/sessions/[id]` | Session-Detail + RSVP-Status, Stornieren-Button                |
| `/member/scheduler`     | Wochen-Kalender mit allen verfügbaren Slots                    |
| `/member/bookings`      | Court-Bookings (separate Buchungen außerhalb Sessions)         |
| `/member/open-matches`  | Offene Matches suchen/erstellen                                |
| `/member/calendar.ics`  | ICS-Subscription-URL (signed JWT) für deinen externen Kalender |

### Profil & Stammdaten

| Page                    | Zweck                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `/member/profile`       | Stammdaten, Foto, Niveau, Spezialisierung                  |
| `/member/preferences`   | Spiel-Präferenzen (Schlägerseite, Lieblings-Reihen, …)     |
| `/member/sepa`          | SEPA-Lastschrift-Mandat                                    |
| `/member/family`        | Familienkonto: Mitglieder verwalten, Einladungscode teilen |
| `/member/notifications` | Push + E-Mail-Settings                                     |

### Finanzen

| Page                           | Zweck                                |
| ------------------------------ | ------------------------------------ |
| `/member/billing`              | Deine Rechnungen + Stripe-Pay-Button |
| `/member/billing/invoice/[id]` | Rechnungs-Detail + PDF               |

### Engagement

| Page                  | Zweck                                                 |
| --------------------- | ----------------------------------------------------- |
| `/member/messages`    | Chat mit Trainern                                     |
| `/member/news`        | Vereins-News                                          |
| `/member/decisions`   | Mitglieder-Abstimmungen (Voting aktiv oder vergangen) |
| `/member/newsletters` | Newsletter-Archiv                                     |
| `/member/feedback`    | Feedback-Form (für kontinuierliche Verbesserung)      |

### Spielpartner

| Page                   | Zweck                                   |
| ---------------------- | --------------------------------------- |
| `/partner-finder`      | Spielpartner-Empfehlung (algorithmisch) |
| `/member/open-matches` | Offene Matches suchen                   |

### Persönliches

| Page                   | Zweck                                  |
| ---------------------- | -------------------------------------- |
| `/member/dsgvo-export` | DSGVO-Datenexport (ZIP)                |
| `/member/dsgvo-delete` | Lösch-Anfrage (4-Schritt-Confirmation) |
| `/member/gamification` | Streak, Achievements, Level            |

## ⚙ Häufige Aktionen

### 1. Session buchen (RSVP)

UI: `/member/scheduler` → Slot auswählen → "Buchen"-Button.

```
POST /api/bookings { session_id, member_id: auth.user.id }

Server:
- withApiAuth → verifyRole 'member'
- BookingUseCase.create() → RPC create_booking_safe
- Notification.dispatchInsert → "Buchung bestätigt"-E-Mail

Effekt:
- Session-Status: 'confirmed' für dich
- Trainer sieht dich in Anwesenheits-Liste
- ICS-Update
```

Stornieren:

```
PATCH /api/bookings/[id] { reason, notes? }
→ Status: 'cancelled'
→ Notification → "Stornierung bestätigt"
→ ggf. Rechnung-Storno falls bezahlt
```

### 2. Court-Buchung (eigener Platz für freies Spiel)

UI: `/member/bookings` → Datum + Platz + Zeit → Submit.

```
POST /api/courts/[courtId]/book { date, start_time, end_time }

Voraussetzung:
- Mitgliedsbeitrag bezahlt (current_invoice.status='paid')
- Kein Konflikt mit bestehender Buchung → GIST-Exclusion-Constraint
```

### 3. SEPA-Mandat erteilen

UI: `/member/sepa` → IBAN eingeben → "Mandat erteilen".

```
POST /api/sepa/mandates { iban, account_holder }
→ Validation: ISO-13616 + Mod-97 (lib/iban.ts)
→ INSERT sepa_mandates { user_id, iban_encrypted, mandate_date }
→ Für zukünftige Lastschrift aktiv
```

⚠️ **Wichtig**: IBAN wird verschlüsselt gespeichert. Bei DSGVO-Löschung: Mandat wird revoked (`is_active=false`).

### 4. Offene Matches posten

UI: `/member/open-matches` → "Match posten" → Datum, Zeit, Niveau, Platz.

```
POST /api/open-matches { date, start_time, end_time, level, court_id }

Andere Members können "Join" klicken → Notification
```

### 5. Spielpartner-Empfehlung

UI: `/partner-finder` (wenn `partner_finder` Modul aktiv)

```
GET /api/partner-finder

Effekt: Liste von bis zu 10 empfohlenen Spielpartnern — deterministisch
auf Basis von Niveau, Gruppen, gemeinsamen Sessions und Verfügbarkeit,
ohne KI/LLM.
```

### 6. Familienkonto verwalten

UI: `/member/family` (wenn `family_accounts` Modul aktiv).

```
POST /api/family-accounts            → Familie erstellen (Elternteil wird parent)
POST /api/family-accounts { inviteCode } → per Einladungscode beitreten
PUT  /api/family-accounts            → neuen Einladungscode erzeugen (nur Erwachsene)
```

- Minderjährige werden anhand des Geburtsdatums erkannt und sehen keine Abrechnung.
- Ein Elternteil wechselt in der Seitenleiste auf ein Kinderkonto und bucht dann
  wirklich für das Kind (der Server prüft die Familienbeziehung).
- In der Saison-Abrechnung wird eine Familie zu **einer Sammel-Rechnung an den
  Erwachsenen** zusammengefasst; die Kinderpositionen sind je Familienmitglied
  aufgeschlüsselt (`Kind: Position`).

### 7. Rechnung bezahlen

UI: `/member/billing/invoice/[id]` → "Jetzt zahlen" → Stripe-Checkout

```
POST /api/stripe/checkout { invoice_id: 'inv-123' }
→ Redirect zu Stripe-Hosted-Checkout
→ Nach Zahlung: webhook → invoice.paid → status='paid'
```

## 🤝 Zusammenspiel mit anderen Rollen

| Edge-Case                              | Was passiert?                                    | Wie handelst du?                                                  |
| -------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Trainer cancelt deine gebuchte Session | Notification + Storno                            | Du erhältst E-Mail/Push, kannst nichts tun                        |
| Admin storniert deine Mitgliedschaft   | Membership `is_active=false`                     | Login funktioniert noch, aber `/member` sagt "kein Verein"        |
| Du verlängerst SEPA-Mandat             | Re-Authorization-Lauf nach 3 Jahren (SEPA-Regel) | Erinnerungs-Mail 4 Wochen vor Ablauf                              |
| Andere Members posten Matches          | Notification                                     | Du bekommst es, kannst joinen                                     |
| DSGVO-Anfrage                          | Du klickst `/member/dsgvo-export`                | Daten als ZIP per Mail innerhalb 30 Tagen (DSGVO-Frist)           |
| Push-Berechtigung widerrufen           | Browser-Popup-Blocker                            | Du deaktivierst in Browser-Settings, dann `/member/notifications` |

## ⚠️ Pflichten & Risiken

1. **DSGVO-Daten-Export**: Fordere 1× pro Jahr an, damit du weißt was über dich gespeichert ist.
2. **SEPA-Lastschrift**: Prüfe monatlich Konto-Auszüge auf fehlerhafte Abbuchungen.
3. **Push-Benachrichtigungen**: Browser fragt 1× pro Domain — verweigert du, siehst du keine Live-Changes.
4. **Spielpartner-Suche**: Respektiere andere Levels; das Scoring bevorzugt ähnliche Stärke.

## 🧪 Tests

`tests/e2e/member-*.spec.ts`:

- RSVP → Stornieren → RSVP erneut
- Court-Buchung → Konflikt-Test (zwei parallele Buchungen)
- Stripe-Payment-Mock → Invoice paid

## 📚 Verwante Kapitel

- [`../user/trainer.md`](./trainer.md) — wie dein Trainer deine RSVP sieht
- [`../user/admin.md`](./admin.md) — wie der Admin dich verwaltet
- [`dev/auth-rbac.md`](../dev/auth-rbac.md) — deine Rolle in Auth-Layer
- [`../user/public-trial.md`](./public-trial.md) — falls du noch nicht Mitglied bist
