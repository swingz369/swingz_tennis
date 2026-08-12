# E-Mail-Versand (Resend)

> Zuletzt verifiziert: 13. August 2026
>
> Lebendes Dokument. Wer an Versandwegen, Absenderadressen oder Templates etwas ändert,
> aktualisiert diese Datei im selben Zug (siehe `AGENTS.md`).

## ⚠️ Aktueller Zustand: Es geht keine einzige E-Mail raus

Resend lehnt jeden Versand ab:

```
The swingz.cloud domain is not verified.
Please, add and verify your domain on https://resend.com/domains
```

`EMAIL_FROM` steht auf `SwingZ <noreply@swingz.cloud>`, und **diese Absenderdomain ist im
Resend-Konto nicht verifiziert**. Betroffen ist damit alles, was das Produkt verschickt:

| Weg                                               | Route / Dienst                                             | Folge heute                                |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| Admin-Einladung durch den Owner                   | `POST /api/owner/invite-admin`                             | fällt auf den Einladungslink zurück (s.u.) |
| Mitglieder-/Trainer-Einladung                     | `POST /api/members/invite`                                 | fällt auf den Einladungslink zurück (s.u.) |
| Rechnungsversand                                  | `POST /api/billing/invoices/[id]/send-email`               | **HTTP 500**, Rechnung bleibt `draft`      |
| Mahnwesen                                         | `app/api/billing/dunning` (Cron)                           | keine Mahnung erreicht jemanden            |
| Saisonbestätigung mit ICS                         | `lib/season-planning/season-confirmation-email.service.ts` | Teilnehmer erfahren nichts                 |
| Supabase-Auth-Mails (Passwort-Reset, Bestätigung) | GoTrue-SMTP auf dem VPS                                    | scheitert an derselben Domain              |

Die Diagnose führte lange in die Irre, weil GoTrue den Fehler als
`Error sending invite email` weiterreicht — das liest sich wie ein Problem mit der
**Empfänger**adresse, ist aber eines mit der **Absender**domain.

## Was zu tun ist

Eine der beiden Optionen genügt:

1. **Domain verifizieren** (der saubere Weg): In Resend unter _Domains_ `swingz.cloud`
   hinzufügen und die angezeigten DNS-Einträge setzen (SPF, DKIM, in der Regel auch ein
   Return-Path-CNAME). Danach ist `noreply@swingz.cloud` sofort nutzbar, `EMAIL_FROM` bleibt
   unverändert.
2. **Absender umstellen**: `EMAIL_FROM` auf eine bereits verifizierte Domain setzen — lokal in
   `.env.local`, in Produktion in den Vercel-Umgebungsvariablen.

Der Test-Absender `onboarding@resend.dev` funktioniert ohne Verifikation, darf aber
**ausschließlich an die eigene Konto-Adresse** zustellen. Für einen einzelnen Testlauf
brauchbar, für den Betrieb nicht.

Zusätzlich zur App muss der **self-hosted GoTrue** dieselbe verifizierte Domain nutzen. In
`/home/deploy/swingz-supabase/.env` steht dafür:

```
SMTP_HOST=smtp.resend.com
SMTP_ADMIN_EMAIL=noreply@swingz.cloud
SMTP_SENDER_NAME=SwingZ
```

Nach einer Änderung: `docker compose up -d auth` im selben Verzeichnis.

## Verifizieren, dass es wieder läuft

```bash
# 1. Absenderdomain akzeptiert? (verschickt eine echte Mail an die eigene Adresse)
npx tsx scripts/send-test-email.ts <eigene-adresse>

# 2. Rechnungsversand über die App — setzt die Rechnung auf `sent`
#    (als Admin eingeloggt, Rechnungs-ID aus /admin/billing)
```

Nach erfolgreichem Versand steht die Rechnung auf `sent` und erscheint beim Mitglied unter
`/billing`. Solange sie `draft` ist, bleibt sie für Mitglieder bewusst unsichtbar
(siehe `lib/billing/invoice-visibility.ts`).

## Ausweichlösung, die eingebaut bleibt

Damit ein nicht zustellbarer Versand keinen Verein aussperrt, weichen beide Einladungswege bei
einem Mailfehler auf einen **Einladungslink** aus: Der Nutzer wird per `admin/generate_link`
ohne Mailversand angelegt, die Antwort trägt `mailSent: false` und `inviteLink`, und die
Oberfläche zeigt den Link dauerhaft mit „Link kopieren" an (`lib/invite-feedback.ts`).

Das ist ein Sicherheitsnetz, kein Ersatz: Es hält das Onboarding offen, ersetzt aber weder
Rechnungsversand noch Mahnwesen. Sobald die Domain verifiziert ist, greift wieder der reguläre
Weg — am Code ist dafür nichts zu ändern.

## Absenderadressen

- `noreply@swingz.cloud` — automatische Mails (Einladungen, Rechnungen, Benachrichtigungen)
- `info@swingz.cloud` — Antwortadresse für Menschen
- Keine `@mail.swingz.cloud`-Adressen: Diese Subdomain ist nicht konfiguriert.
