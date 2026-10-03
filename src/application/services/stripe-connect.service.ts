import { createHmac, timingSafeEqual } from 'node:crypto';
import type Stripe from 'stripe';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { platformFeeCents } from '@/lib/plans';
import { CHECKOUT_STUDIO_PARAMS, stripe } from '@/lib/stripe/stripe-client';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { StripeConnectRepository } from '@/infrastructure/persistence/repositories/stripe-connect.repository';

/**
 * Jeder Verein mit verbundenem Konto kann selbst Checkout-Sessions mit beliebigen
 * Metadaten anlegen — und Stripe schickt deren Ereignisse signiert an uns. Ohne
 * eigene Signatur könnte ein Vereinsadmin so fremde Rechnungen als bezahlt melden.
 * Schlüssel ist der Stripe-Secret-Key: serverseitig, ohnehin vorhanden.
 */
function metadataSignature(metadata: Record<string, string>): string {
  const payload = Object.keys(metadata)
    .filter((k) => k !== 'sig')
    .sort()
    .map((k) => `${k}=${metadata[k]}`)
    .join('&');
  return createHmac('sha256', process.env.STRIPE_SECRET_KEY ?? '')
    .update(payload)
    .digest('hex');
}

export function signMetadata(metadata: Record<string, string>): Record<string, string> {
  return { ...metadata, sig: metadataSignature(metadata) };
}

export function hasValidSignature(metadata: Record<string, string> | null | undefined): boolean {
  if (!metadata?.sig) return false;
  const expected = Buffer.from(metadataSignature(metadata));
  const actual = Buffer.from(metadata.sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface ClubCheckoutInput {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  idempotencyKey?: string;
}

/**
 * Stripe Connect (ADR-008): Mitgliederzahlungen laufen als Direct Charge auf dem
 * Stripe-Konto des Vereins, die Plattformgebühr über application_fee_amount.
 * Das Abo des Vereins bei SwingZ bleibt auf dem Plattformkonto (api/stripe/subscribe).
 */
export class StripeConnectService {
  private readonly repo: StripeConnectRepository;

  constructor(auth: AuthContext) {
    this.repo = new StripeConnectRepository(getUserDb(auth));
  }

  async getStatus(clubId: string): Promise<ConnectStatus> {
    const account = await this.repo.findByClub(clubId);
    return {
      connected: !!account,
      chargesEnabled: account?.charges_enabled ?? false,
      detailsSubmitted: account?.details_submitted ?? false,
    };
  }

  /** Legt bei Bedarf das Stripe-Konto an und gibt den Einrichtungs-Link von Stripe zurück. */
  async createOnboardingLink(clubId: string, returnUrl: string): Promise<string> {
    let accountId = (await this.repo.findByClub(clubId))?.stripe_account_id;

    if (!accountId) {
      // Idempotenz-Schlüssel: Doppelklick legt bei Stripe kein zweites Konto an.
      const account = await stripe().accounts.create(
        {
          country: 'DE',
          controller: {
            fees: { payer: 'account' },
            losses: { payments: 'stripe' },
            stripe_dashboard: { type: 'full' },
          },
          metadata: { clubId },
        },
        { idempotencyKey: `connect-account-${clubId}` }
      );
      await new StripeConnectRepository(systemDb('Stripe Connect: Konto anlegen')).insert({
        club_id: clubId,
        stripe_account_id: account.id,
      });
      accountId = account.id;
    }

    const link = await stripe().accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: returnUrl,
    });
    return link.url;
  }

  /** Checkout auf dem Konto des Vereins, Plattformgebühr wird von der Auszahlung abgezogen. */
  async createCheckoutSession(clubId: string, input: ClubCheckoutInput): Promise<string> {
    const account = await this.repo.findByClub(clubId);
    if (!account?.charges_enabled) {
      throw new ApiException(
        'CONFLICT',
        'Der Verein hat die Online-Zahlung noch nicht eingerichtet.',
        { status: 409 }
      );
    }

    const totalCents = input.lineItems.reduce(
      (sum, item) => sum + (item.price_data?.unit_amount ?? 0) * (item.quantity ?? 1),
      0
    );

    const metadata = signMetadata({ ...input.metadata, clubId });
    const session = await stripe().checkout.sessions.create(
      {
        ...CHECKOUT_STUDIO_PARAMS,
        submit_type: 'auto',
        mode: 'payment',
        line_items: input.lineItems,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer_email: input.customerEmail,
        metadata,
        payment_intent_data: {
          application_fee_amount: platformFeeCents(totalCents),
          metadata,
        },
      },
      { stripeAccount: account.stripe_account_id, idempotencyKey: input.idempotencyKey }
    );
    if (!session.url) throw new Error('Stripe hat keine Checkout-URL geliefert');
    return session.url;
  }

  // ── Webhook (systemDb, ADR-005-Whitelist) ──────────────────────────────

  static async syncAccount(account: Stripe.Account): Promise<void> {
    await new StripeConnectRepository(systemDb('Stripe-Webhook: account.updated')).updateStatus(
      account.id,
      {
        charges_enabled: account.charges_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
      }
    );
  }

  static async disconnect(stripeAccountId: string): Promise<void> {
    await new StripeConnectRepository(
      systemDb('Stripe-Webhook: account.application.deauthorized')
    ).deleteByAccountId(stripeAccountId);
  }

  /**
   * Ereignis eines verbundenen Kontos vertrauenswürdig? Metadaten stammen von uns
   * (Signatur) und das Konto gehört zum Verein aus den Metadaten.
   */
  static async isTrustedConnectEvent(
    stripeAccountId: string,
    metadata: Record<string, string> | null | undefined
  ): Promise<boolean> {
    const clubId = metadata?.clubId;
    if (!clubId || !hasValidSignature(metadata)) return false;
    const account = await new StripeConnectRepository(
      systemDb('Stripe-Webhook: Konto-Zuordnung prüfen')
    ).findByAccountId(stripeAccountId);
    return account?.club_id === clubId;
  }
}
