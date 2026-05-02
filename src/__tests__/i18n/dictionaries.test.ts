import { describe, it, expect } from 'vitest';
import de from '@/i18n/dictionaries/de.json';
import en from '@/i18n/dictionaries/en.json';

describe('i18n Dictionaries', () => {
  describe('German Dictionary', () => {
    it('should have required navigation keys', () => {
      expect(de).toHaveProperty('layout');
      expect(de.layout).toHaveProperty('header');
      expect(de.layout.header).toHaveProperty('dashboard');
      expect(de.layout.header).toHaveProperty('bookings');
      expect(de.layout.header).toHaveProperty('scheduler');
    });

    it('should have required auth keys', () => {
      expect(de.layout.header).toHaveProperty('login');
      expect(de.layout.header).toHaveProperty('logout');
    });

    it('should have required common keys', () => {
      expect(de).toHaveProperty('common');
      expect(de.common).toHaveProperty('save');
      expect(de.common).toHaveProperty('cancel');
      expect(de.common).toHaveProperty('delete');
      expect(de.common).toHaveProperty('edit');
    });
  });

  describe('English Dictionary', () => {
    it('should have required navigation keys', () => {
      expect(en).toHaveProperty('layout');
      expect(en.layout).toHaveProperty('header');
      expect(en.layout.header).toHaveProperty('dashboard');
      expect(en.layout.header).toHaveProperty('bookings');
      expect(en.layout.header).toHaveProperty('scheduler');
    });

    it('should have required auth keys', () => {
      expect(en.layout.header).toHaveProperty('login');
      expect(en.layout.header).toHaveProperty('logout');
    });

    it('should have required common keys', () => {
      expect(en).toHaveProperty('common');
      expect(en.common).toHaveProperty('save');
      expect(en.common).toHaveProperty('cancel');
      expect(en.common).toHaveProperty('delete');
      expect(en.common).toHaveProperty('edit');
    });
  });

  describe('Dictionary Consistency', () => {
    it('should have matching keys between de and en', () => {
      const getKeys = (obj: any, prefix = ''): string[] => {
        return Object.keys(obj).reduce((acc: string[], key) => {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            return [...acc, ...getKeys(obj[key], newKey)];
          }
          return [...acc, newKey];
        }, []);
      };

      const deKeys = getKeys(de);
      const enKeys = getKeys(en);

      deKeys.forEach((key) => {
        expect(enKeys).toContain(key);
      });
    });
  });
});
