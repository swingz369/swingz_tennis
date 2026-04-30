import { describe, it, expect } from 'vitest';
import { ValidationService } from '@/domain/services/validation.service';

describe('ValidationService', () => {
  const defaultOpeningHours = {
    monday: { open: '08:00', close: '20:00' },
    tuesday: { open: '08:00', close: '20:00' },
    wednesday: { open: '08:00', close: '20:00' },
    thursday: { open: '08:00', close: '20:00' },
    friday: { open: '08:00', close: '20:00' },
    saturday: { open: '09:00', close: '18:00' },
    sunday: { open: '10:00', close: '16:00' },
  };

  describe('validateClubCreation', () => {
    it('should pass with valid data', () => {
      expect(() =>
        ValidationService.validateClubCreation('My Club', 500, defaultOpeningHours)
      ).not.toThrow();
    });

    it('should throw if name is empty', () => {
      expect(() =>
        ValidationService.validateClubCreation('', 500, defaultOpeningHours)
      ).toThrow('Club name is required');
    });

    it('should throw if name exceeds 200 characters', () => {
      const longName = 'a'.repeat(201);
      expect(() =>
        ValidationService.validateClubCreation(longName, 500, defaultOpeningHours)
      ).toThrow('Club name cannot exceed 200 characters');
    });

    it('should throw if maxMembers is not positive', () => {
      expect(() =>
        ValidationService.validateClubCreation('Club', 0, defaultOpeningHours)
      ).toThrow('Max members must be positive');
    });

    it('should throw if maxMembers exceeds 10000', () => {
      expect(() =>
        ValidationService.validateClubCreation('Club', 10001, defaultOpeningHours)
      ).toThrow('Max members cannot exceed 10000');
    });
  });

  describe('validateOpeningHours', () => {
    it('should pass with valid hours', () => {
      expect(ValidationService.validateOpeningHours(defaultOpeningHours)).toBe(true);
    });

    it('should throw if monday hours are missing', () => {
      const { monday, ...rest } = defaultOpeningHours;
      expect(() => ValidationService.validateOpeningHours(rest as any)).toThrow('Opening hours for monday are required');
    });

    it('should throw if closing time is before opening', () => {
      const invalidHours = { ...defaultOpeningHours, monday: { open: '10:00', close: '09:00' } };
      expect(() => ValidationService.validateOpeningHours(invalidHours)).toThrow('Closing time must be after opening time on monday');
    });
  });

  describe('validateTrainer', () => {
    it('should pass with valid data', () => {
      expect(() =>
        ValidationService.validateTrainer('John Doe', 'john@example.com', ['beginner'], 30)
      ).not.toThrow();
    });

    it('should throw if name is empty', () => {
      expect(() =>
        ValidationService.validateTrainer('', 'john@example.com', ['beginner'], 30)
      ).toThrow('Trainer name is required');
    });

    it('should throw if email is invalid', () => {
      expect(() =>
        ValidationService.validateTrainer('John', 'invalid-email', ['beginner'], 30)
      ).toThrow('Valid email is required');
    });

    it('should throw if specialties is empty', () => {
      expect(() =>
        ValidationService.validateTrainer('John', 'john@example.com', [], 30)
      ).toThrow('At least one specialty is required');
    });

    it('should throw if maxHoursPerWeek is out of range', () => {
      expect(() =>
        ValidationService.validateTrainer('John', 'john@example.com', ['beginner'], 0)
      ).toThrow('Max hours per week must be between 1 and 50');
    });
  });
});
