import { describe, it, expect, beforeEach } from 'vitest';
import { Club } from '@/domain/entities/club';
import { ClubId } from '@/domain/value-objects';

describe('Club', () => {
  const openingHours = {
    monday: { open: '08:00', close: '20:00' },
    tuesday: { open: '08:00', close: '20:00' },
    wednesday: { open: '08:00', close: '20:00' },
    thursday: { open: '08:00', close: '20:00' },
    friday: { open: '08:00', close: '20:00' },
    saturday: { open: '09:00', close: '18:00' },
    sunday: { open: '10:00', close: '16:00' },
  };

  describe('create', () => {
    it('should create a club with valid data', () => {
      const club = Club.create('Tennis Club', 500, openingHours);

      expect(club.getName()).toBe('Tennis Club');
      expect(club.getMaxMembers()).toBe(500);
      expect(club.getStatus()).toBe('active');
      expect(club.getId()).toBeInstanceOf(ClubId);
    });

    it('should throw if name is empty', () => {
      expect(() => Club.create('', 500, openingHours)).toThrow('Club name is required');
    });

    it('should throw if maxMembers is not positive', () => {
      expect(() => Club.create('Club', 0, openingHours)).toThrow('Max members must be positive');
    });
  });

  describe('member management', () => {
    let club: Club;

    beforeEach(() => {
      club = Club.create('Test Club', 100, openingHours);
    });

    it('should add members up to capacity', () => {
      const memberIds = Array.from({ length: 50 }, () => ClubId.create());
      memberIds.forEach(id => club.addMember(id));

      expect(club.getMemberCount()).toBe(50);
    });

    it('should throw when exceeding max members', () => {
      for (let i = 0; i < 100; i++) {
        club.addMember(ClubId.create());
      }

      expect(() => club.addMember(ClubId.create())).toThrow('Club has reached maximum member capacity');
    });

    it('should remove members', () => {
      const memberId = ClubId.create();
      club.addMember(memberId);
      expect(club.isMember(memberId)).toBe(true);

      club.removeMember(memberId);
      expect(club.isMember(memberId)).toBe(false);
    });
  });

  describe('trainer management', () => {
    let club: Club;

      const mockTrainer = (id: string) => ({
        id: ClubId.fromString(id),
        email: `trainer${id}@example.com`,
        name: `Trainer ${id}`,
        specialties: ['beginner', 'advanced'] as string[],
        maxHoursPerWeek: 30,
        isActive: true,
      } as any);

    beforeEach(() => {
      club = Club.create('Test Club', 100, openingHours);
    });

    it('should add trainers', () => {
      const trainer = mockTrainer('t1');
      club.addTrainer(trainer);

      expect(club.getActiveTrainerCount()).toBe(1);
    });

    it('should throw when adding duplicate trainer', () => {
      const trainer = mockTrainer('t1');
      club.addTrainer(trainer);

      expect(() => club.addTrainer(trainer)).toThrow('Trainer already exists in club');
    });
  });
});
