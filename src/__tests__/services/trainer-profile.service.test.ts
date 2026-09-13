/**
 * Unit tests for TrainerProfileService — Trainer-Teildomäne für ADR-005.
 *
 * Mockt TrainerProfileRepository. Deckt die aus echten Produktionsfehlern
 * entstandenen Guards ab: normalizeQualifications (drei historische
 * JSON-Formen) und parseNumericField (NaN-Guard), plus die
 * Eingabevalidierung beim Anlegen eines Profils.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { TrainerProfileService } from '@/application/services/trainer-profile.service';
import {
  TrainerProfileRepository,
  normalizeQualifications,
  parseNumericField,
} from '@/infrastructure/persistence/repositories/trainer-profile.repository';
import type { TrainerProfile } from '@/domain/entities/trainer.entity';

function fakeAuth(): AuthContext {
  return {
    user: { id: 'user-1' } as AuthContext['user'],
    session: null,
    supabase: {} as AuthContext['supabase'],
    clubId: 'club-1',
    role: 'admin',
    roles: ['admin'],
    memberships: [{ club_id: 'club-1', role: 'admin' }],
  };
}

function makeProfile(overrides: Partial<TrainerProfile> = {}): TrainerProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    firstName: 'Anna',
    lastName: 'Trainer',
    email: 'anna@example.com',
    phone: '0123456789',
    dateOfBirth: '1990-01-01',
    qualifications: [],
    specializations: [],
    experience: { years: 0, previousClubs: [], achievements: [] },
    status: 'active',
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    preferredTimeSlots: [],
    languages: ['Deutsch'],
    emergencyContact: { name: '', phone: '', relationship: '' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TrainerProfile;
}

describe('normalizeQualifications', () => {
  it('lässt einen bereits korrekten Objekt-Array unverändert', () => {
    const result = normalizeQualifications([
      { id: 'q1', name: 'DTB C-Lizenz', issuer: 'DTB', issuedDate: '2020-01-01', verified: true },
    ]);
    expect(result).toEqual([
      { id: 'q1', name: 'DTB C-Lizenz', issuer: 'DTB', issuedDate: '2020-01-01', verified: true },
    ]);
  });

  it('wandelt einen String-Array (Seed-Form) in Objekte um', () => {
    const result = normalizeQualifications(['DTB C-Lizenz']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('DTB C-Lizenz');
    expect(result[0].verified).toBe(false);
    expect(result[0].id).toBeTruthy();
  });

  it('parst einen JSON-String mit einem String-Array (Legacy-Zeilen)', () => {
    const result = normalizeQualifications('["DTB C-Lizenz","DTB B-Lizenz"]');
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.name)).toEqual(['DTB C-Lizenz', 'DTB B-Lizenz']);
  });

  it('gibt ein leeres Array für null/undefined zurück', () => {
    expect(normalizeQualifications(null)).toEqual([]);
    expect(normalizeQualifications(undefined)).toEqual([]);
  });
});

describe('parseNumericField', () => {
  it('lässt gültige Zahlen durch', () => {
    expect(parseNumericField(42)).toBe(42);
    expect(parseNumericField('42.5')).toBe(42.5);
  });

  it('kollabiert NaN/Infinity und nicht-numerische Strings auf null', () => {
    expect(parseNumericField(NaN)).toBeNull();
    expect(parseNumericField(Infinity)).toBeNull();
    expect(parseNumericField('"42"')).toBeNull();
    expect(parseNumericField('kaputt')).toBeNull();
  });

  it('kollabiert null/undefined auf null', () => {
    expect(parseNumericField(null)).toBeNull();
    expect(parseNumericField(undefined)).toBeNull();
  });
});

describe('TrainerProfileService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTrainerProfile', () => {
    const validInput = {
      userId: 'user-1',
      clubId: 'club-1',
      firstName: 'Anna',
      lastName: 'Trainer',
      email: 'anna@example.com',
      phone: '0123456789',
      dateOfBirth: '1990-01-01',
    };

    it('lehnt eine zu kurze Telefonnummer ab', async () => {
      const service = new TrainerProfileService(fakeAuth());
      await expect(
        service.createTrainerProfile({ ...validInput, phone: 'N/A' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('lehnt eine ungültige E-Mail ab', async () => {
      const service = new TrainerProfileService(fakeAuth());
      await expect(
        service.createTrainerProfile({ ...validInput, email: 'not-an-email' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('legt das Profil an, wenn die Eingabe gültig ist', async () => {
      vi.spyOn(TrainerProfileRepository.prototype, 'create').mockResolvedValue(makeProfile());
      const service = new TrainerProfileService(fakeAuth());

      const result = await service.createTrainerProfile(validInput);

      expect(result.id).toBe('profile-1');
    });
  });

  describe('getTrainerProfileById', () => {
    it('wirft NOT_FOUND, wenn das Profil fehlt', async () => {
      vi.spyOn(TrainerProfileRepository.prototype, 'findById').mockResolvedValue(null);
      const service = new TrainerProfileService(fakeAuth());

      await expect(service.getTrainerProfileById('missing')).rejects.toBeInstanceOf(ApiException);
    });
  });

  describe('addQualification / verifyQualification', () => {
    it('fügt eine neue Qualifikation zur bestehenden Liste hinzu', async () => {
      vi.spyOn(TrainerProfileRepository.prototype, 'findById').mockResolvedValue(
        makeProfile({
          qualifications: [
            { id: 'q1', name: 'Alt', issuer: 'X', issuedDate: '2020-01-01', verified: true },
          ],
        })
      );
      const update = vi
        .spyOn(TrainerProfileRepository.prototype, 'update')
        .mockImplementation(async (_id, input) =>
          makeProfile({ qualifications: input.qualifications as never })
        );
      const service = new TrainerProfileService(fakeAuth());

      await service.addQualification('profile-1', {
        name: 'Neu',
        issuer: 'Y',
        issuedDate: '2026-01-01',
      });

      const [, callInput] = update.mock.calls[0];
      expect(callInput.qualifications).toHaveLength(2);
    });

    it('markiert genau die passende Qualifikation als verifiziert', async () => {
      vi.spyOn(TrainerProfileRepository.prototype, 'findById').mockResolvedValue(
        makeProfile({
          qualifications: [
            { id: 'q1', name: 'A', issuer: 'X', issuedDate: '2020-01-01', verified: false },
            { id: 'q2', name: 'B', issuer: 'X', issuedDate: '2020-01-01', verified: false },
          ],
        })
      );
      const update = vi
        .spyOn(TrainerProfileRepository.prototype, 'update')
        .mockImplementation(async (_id, input) =>
          makeProfile({ qualifications: input.qualifications as never })
        );
      const service = new TrainerProfileService(fakeAuth());

      await service.verifyQualification('profile-1', 'q2', 'admin-1');

      const [, callInput] = update.mock.calls[0];
      const quals = callInput.qualifications as unknown as Array<{ id: string; verified: boolean }>;
      expect(quals.find((q) => q.id === 'q1')?.verified).toBe(false);
      expect(quals.find((q) => q.id === 'q2')?.verified).toBe(true);
    });
  });
});
