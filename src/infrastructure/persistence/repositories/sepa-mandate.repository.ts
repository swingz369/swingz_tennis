import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { sepaMandates } from '../schema';
import type {
  SEPAMandate,
  CreateSEPAMandateInput,
  UpdateSEPAMandateInput,
  ISEPAMandateRepository,
} from '../../../domain/repositories/sepa-mandate-repository.interface';

export class SEPAMandateRepository implements ISEPAMandateRepository {
  async create(input: CreateSEPAMandateInput): Promise<SEPAMandate> {
    try {
      const now = new Date();
      const [mandate] = await db
        .insert(sepaMandates)
        .values({
          clubId: input.clubId,
          memberId: input.memberId,
          accountHolder: input.accountHolder,
          iban: input.iban.replace(/\s/g, '').toUpperCase(),
          bic: input.bic.replace(/\s/g, '').toUpperCase(),
          bankName: input.bankName,
          address: {
            street: input.street,
            houseNumber: input.houseNumber,
            postalCode: input.postalCode,
            city: input.city,
          },
          mandateReference: input.mandateReference || `M-${Date.now()}`,
          creditorId: 'DE98ZZZ00000000000',
          signatureDate: input.signatureDate,
          isActive: true,
          createdAt: now.toISOString(),
        })
        .returning();

      if (!mandate) throw new Error('Failed to create SEPA mandate');
      return this.mapToEntity(mandate);
    } catch (error) {
      console.error('Error creating SEPA mandate:', error);
      throw new Error(
        `Failed to create mandate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findById(id: string): Promise<SEPAMandate | null> {
    try {
      const [mandate] = await db
        .select()
        .from(sepaMandates)
        .where(eq(sepaMandates.id, id))
        .limit(1);
      return mandate ? this.mapToEntity(mandate) : null;
    } catch (error) {
      console.error('Error finding SEPA mandate:', error);
      throw new Error(
        `Failed to find mandate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findActiveMandateByMemberId(memberId: string): Promise<SEPAMandate | null> {
    try {
      const [mandate] = await db
        .select()
        .from(sepaMandates)
        .where(and(eq(sepaMandates.memberId, memberId), eq(sepaMandates.isActive, true)))
        .limit(1);
      return mandate ? this.mapToEntity(mandate) : null;
    } catch (error) {
      console.error('Error finding active mandate:', error);
      throw new Error(
        `Failed to find active mandate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByMemberId(memberId: string): Promise<SEPAMandate[]> {
    try {
      const mandates = await db
        .select()
        .from(sepaMandates)
        .where(eq(sepaMandates.memberId, memberId))
        .orderBy(desc(sepaMandates.createdAt));
      return mandates.map((m) => this.mapToEntity(m));
    } catch (error) {
      console.error('Error finding mandates by member:', error);
      throw new Error(
        `Failed to find mandates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async findByClubId(clubId: string): Promise<SEPAMandate[]> {
    try {
      const mandates = await db
        .select()
        .from(sepaMandates)
        .where(eq(sepaMandates.clubId, clubId))
        .orderBy(desc(sepaMandates.createdAt));
      return mandates.map((m) => this.mapToEntity(m));
    } catch (error) {
      console.error('Error finding mandates by club:', error);
      throw new Error(
        `Failed to find mandates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async update(id: string, input: UpdateSEPAMandateInput): Promise<SEPAMandate | null> {
    try {
      const updateData: Partial<typeof sepaMandates.$inferInsert> = {};
      if (input.accountHolder !== undefined) updateData.accountHolder = input.accountHolder;
      if (input.iban !== undefined) updateData.iban = input.iban.replace(/\s/g, '').toUpperCase();
      if (input.bic !== undefined) updateData.bic = input.bic.replace(/\s/g, '').toUpperCase();
      if (input.bankName !== undefined) updateData.bankName = input.bankName;

      // Handle address updates
      const existing = await this.findById(id);
      if (!existing) return null;

      if (input.street || input.houseNumber || input.postalCode || input.city) {
        updateData.address = {
          street: input.street ?? existing.address.street,
          houseNumber: input.houseNumber ?? existing.address.houseNumber,
          postalCode: input.postalCode ?? existing.address.postalCode,
          city: input.city ?? existing.address.city,
        };
      }

      const [updated] = await db
        .update(sepaMandates)
        .set(updateData)
        .where(eq(sepaMandates.id, id))
        .returning();

      return updated ? this.mapToEntity(updated) : null;
    } catch (error) {
      console.error('Error updating SEPA mandate:', error);
      throw new Error(
        `Failed to update mandate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async revoke(id: string, reason: string): Promise<SEPAMandate | null> {
    try {
      const [revoked] = await db
        .update(sepaMandates)
        .set({
          isActive: false,
          revokedAt: new Date().toISOString(),
          revokeReason: reason,
        })
        .where(eq(sepaMandates.id, id))
        .returning();

      return revoked ? this.mapToEntity(revoked) : null;
    } catch (error) {
      console.error('Error revoking SEPA mandate:', error);
      throw new Error(
        `Failed to revoke mandate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async hasActiveMandate(memberId: string): Promise<boolean> {
    const mandate = await this.findActiveMandateByMemberId(memberId);
    return mandate !== null;
  }

  private mapToEntity(row: typeof sepaMandates.$inferSelect): SEPAMandate {
    return {
      id: row.id,
      clubId: row.clubId ?? undefined,
      memberId: row.memberId,
      accountHolder: row.accountHolder,
      iban: row.iban,
      bic: row.bic,
      bankName: row.bankName,
      address: row.address as SEPAMandate['address'],
      mandateReference: row.mandateReference,
      creditorId: row.creditorId,
      signatureDate: new Date(row.signatureDate),
      createdAt: new Date(row.createdAt),
      isActive: row.isActive,
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : undefined,
      revokeReason: row.revokeReason ?? undefined,
    };
  }
}
