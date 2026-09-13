import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import type { Json, TablesInsert, TablesUpdate } from '@/types/supabase';
import {
  PaymentSettingsRepository,
  type PaymentSettings,
} from '@/infrastructure/persistence/repositories/payment-settings.repository';

// `config` kommt aus Zod als Record<string, unknown> herein — hier auf `Json`
// gecastet (Betreiber-Anmeldedaten wie apiKey/secretKey sind JSON-serialisierbar,
// die genaue Form ist je Gateway unterschiedlich).
export type CreatePaymentSettingsInput = Omit<
  TablesInsert<'payment_settings'>,
  'club_id' | 'id' | 'is_default' | 'config'
> & { config: Record<string, unknown> };
export type UpdatePaymentSettingsInput = Omit<
  TablesUpdate<'payment_settings'>,
  'club_id' | 'id' | 'config'
> & { config?: Record<string, unknown> };

/**
 * Vierte migrierte Domäne für ADR-005. Ein Service, ein Repository, kein
 * Adapter, keine Interfaces, keine In-Memory-Stub-Implementierung (die alte
 * `PaymentSettingsService` hielt Daten nur im Prozessspeicher — hier ist die
 * Persistenz ausschliesslich das Repository).
 */
export class PaymentSettingsService {
  private readonly repo: PaymentSettingsRepository;

  constructor(auth: AuthContext) {
    this.repo = new PaymentSettingsRepository(getUserDb(auth));
  }

  async createPaymentSettings(
    clubId: string,
    input: CreatePaymentSettingsInput
  ): Promise<PaymentSettings> {
    return this.repo.create({ ...input, club_id: clubId, config: input.config as Json });
  }

  async getPaymentSettingsById(id: string, clubId: string): Promise<PaymentSettings> {
    const settings = await this.repo.findById(id, clubId);
    if (!settings) throw new ApiException('NOT_FOUND', 'Zahlungseinstellungen nicht gefunden');
    return settings;
  }

  async getAllPaymentSettings(clubId: string): Promise<PaymentSettings[]> {
    return this.repo.findAll(clubId);
  }

  async getActivePaymentSettings(clubId: string): Promise<PaymentSettings[]> {
    return this.repo.findActive(clubId);
  }

  async getDefaultPaymentSettings(clubId: string): Promise<PaymentSettings | null> {
    return this.repo.findDefault(clubId);
  }

  async getPaymentSettingsByGateway(
    gateway: PaymentSettings['gateway'],
    clubId: string
  ): Promise<PaymentSettings[]> {
    return this.repo.findByGateway(gateway, clubId);
  }

  async updatePaymentSettings(
    id: string,
    clubId: string,
    input: UpdatePaymentSettingsInput
  ): Promise<PaymentSettings> {
    const { config, ...rest } = input;
    const updated = await this.repo.update(
      id,
      { ...rest, ...(config !== undefined && { config: config as Json }) },
      clubId
    );
    if (!updated) throw new ApiException('NOT_FOUND', 'Zahlungseinstellungen nicht gefunden');
    return updated;
  }

  async setAsDefault(id: string, clubId: string): Promise<PaymentSettings> {
    const updated = await this.repo.setAsDefault(id, clubId);
    if (!updated) throw new ApiException('NOT_FOUND', 'Zahlungseinstellungen nicht gefunden');
    return updated;
  }

  async deletePaymentSettings(id: string, clubId: string): Promise<void> {
    const deleted = await this.repo.delete(id, clubId);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Zahlungseinstellungen nicht gefunden');
  }

  /**
   * Verbindungstest fürs Gateway. Testet aktuell nur, dass der Datensatz
   * existiert — echte Gateway-Konnektivität (z. B. Stripe-Ping) ist nicht
   * angebunden; das war auch im alten Stub-Code so.
   */
  async testPaymentSettings(id: string, clubId: string): Promise<{ message: string }> {
    await this.getPaymentSettingsById(id, clubId);
    return { message: `Verbindungstest für Zahlungseinstellungen ${id} erfolgreich.` };
  }
}
