# ADR-008: Mitgliederzahlungen über Stripe Connect, 0,5 % Plattformgebühr

- **Status:** akzeptiert
- **Datum:** 3. Oktober 2026
- **Betrifft:** `src/application/services/stripe-connect.service.ts`, `app/api/stripe/connect/`,
  `app/api/stripe/checkout/`, `app/api/billing/invoices/[id]/checkout/`, `app/api/shop/checkout/`,
  `app/api/webhooks/stripe/`, Tabelle `club_stripe_accounts`, `lib/plans.ts`

## Kontext

Buchungen, Rechnungen und Shop-Bestellungen der Mitglieder liefen als Zahlung auf das
**Stripe-Konto der Plattform**. Das Geld der Vereine landete also bei SwingZ, und es gab
keinen Weg, es weiterzuleiten. Wer Gelder Dritter annimmt und weiterreicht, erbringt in
Deutschland in der Regel einen erlaubnispflichtigen Zahlungsdienst (ZAG).

Gleichzeitig soll SwingZ über eine kleine Transaktionsgebühr mitverdienen. Das Ziel ist
Verbreitung, nicht Gewinnmaximierung.

## Entscheidung

1. **Stripe Connect, Direct Charges.** Die Zahlung entsteht auf dem Stripe-Konto des Vereins
   (`stripeAccount` als Request-Option). Der Verein ist der Verkäufer (Beleg, Steuer,
   Widersprüche), Stripe ist der regulierte Zahlungsdienstleister.
2. **Konto mit Stripe-Dashboard, Stripe trägt Gebühren und Verluste:**
   `controller.fees.payer = account`, `losses.payments = stripe`, `stripe_dashboard.type = full`.
   Es gibt keine Kosten je Konto für die Plattform. Rückerstattungen und Auszahlungen erledigt
   der Verein in seinem eigenen Dashboard; SwingZ baut dafür keine Oberfläche.
3. **Plattformgebühr 0,5 %** über `application_fee_amount`, an einer Stelle definiert
   (`PLATFORM_FEE_PERCENT`). **Die Gebühr trägt der Verein**, Stripe zieht sie von der
   Auszahlung ab. Ein Aufschlag beim Zahlenden ist bei SEPA und Verbraucherkarten nach
   § 270a BGB unzulässig.
4. **Kontodaten in eigener Tabelle** `club_stripe_accounts`, nicht als Spalten an `clubs`.
   Admins dürfen `clubs` bearbeiten, Konto-ID und Freischaltung aber nicht. Geschrieben wird
   nur serverseitig.
5. **Signierte Checkout-Metadaten.** Jeder verbundene Verein kann selbst Checkout-Sessions
   anlegen, deren Ereignisse signiert bei unserem Webhook ankommen. Ohne eigene Prüfung könnte
   ein Vereinsadmin damit Rechnungen anderer Vereine als bezahlt melden. Die Metadaten tragen
   deshalb eine HMAC (Schlüssel: `STRIPE_SECRET_KEY`), und das Konto muss zum Verein aus den
   Metadaten gehören.
6. **Das Abo des Vereins bei SwingZ** bleibt auf dem Plattformkonto (`/api/stripe/subscribe`).

## Verworfen

- **Destination Charges / Separate Charges and Transfers:** Dabei wäre die Plattform der
  Verkäufer. Das wäre falsch gegenüber Mitglied und Finanzamt und brächte Widersprüche und
  Verluste zu SwingZ.
- **Express- oder Custom-Konten:** Sie kosten Gebühren je aktivem Konto, und SwingZ müsste
  Auszahlungen und Widersprüche selbst abbilden.
- **Servicegebühr für den Zahlenden:** § 270a BGB, siehe oben.

## Folgen

- Ohne freigeschaltetes Konto (`charges_enabled`) antworten alle Checkout-Routen mit 409. Die
  Online-Zahlung ist pro Verein also opt-in.
- In Stripe braucht es einen zweiten Webhook-Endpunkt für Ereignisse verbundener Konten
  (`STRIPE_CONNECT_WEBHOOK_SECRET`). Das Plattformprofil muss im Stripe-Dashboard aktiviert
  sein.
- Ein Shop-Warenkorb enthält nur Artikel eines Vereins.
