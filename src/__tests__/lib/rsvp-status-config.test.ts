import { describe, it, expect } from 'vitest';
import {
  RSVP_STATUS_CONFIG,
  RSVP_ACTION_KEYS,
  type RsvpStatusConfig,
  type RsvpStatusKey,
} from '@/lib/rsvp-status';

/**
 * Vollständigkeits-Tests für die {@link RSVP_STATUS_CONFIG}-Map.
 * Garantiert dass:
 *   - Alle 5 RsvpStatusKeys eine Config haben
 *   - Jede Config die Pflichtfelder + korrekte Typen hat
 *   - Reihenfolge (order-Feld) konsistent ist
 *   - Tailwind-Klassen den erwarteten Farb-Tokens entsprechen
 *   - Action-Keys (Buttons) eine Teilmenge der Config-Keys sind
 */
describe('RSVP_STATUS_CONFIG Vollständigkeit', () => {
  // ─── Vollständigkeit der Map ───────────────────────────────────────────
  describe('Vollständigkeit', () => {
    it('enthält genau die 5 RsvpStatusKey-Werte', () => {
      const keys = Object.keys(RSVP_STATUS_CONFIG).sort();
      expect(keys).toEqual(['accepted', 'declined', 'maybe', 'pending', 'unknown'].sort());
    });

    it('jede Config hat alle Pflichtfelder', () => {
      const requiredKeys: Array<keyof RsvpStatusConfig> = [
        'key',
        'label',
        'badgeClass',
        'buttonClass',
        'buttonActiveClass',
        'iconClass',
        'icon',
        'buttonIcon',
        'order',
      ];
      for (const [statusKey, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        for (const field of requiredKeys) {
          expect(
            cfg[field],
            `Feld "${String(field)}" fehlt in Config für "${statusKey}"`
          ).toBeDefined();
        }
      }
    });

    it('jede Config.key matcht den Map-Key', () => {
      for (const [mapKey, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        expect(cfg.key, `Map-Key "${mapKey}" ≠ Config.key "${cfg.key}"`).toBe(mapKey);
      }
    });
  });

  // ─── Farb-Tokens (Tailwind-Klassen) ───────────────────────────────────
  describe('Farb-Tokens', () => {
    const expectedColors: Record<RsvpStatusKey, string> = {
      accepted: 'success',
      declined: 'error',
      maybe: 'warning',
      pending: 'info',
      unknown: 'muted',
    };

    it('jede Config verwendet die erwartete Farb-Familie in der Badge-Klasse', () => {
      for (const [key, expected] of Object.entries(expectedColors)) {
        const cfg = RSVP_STATUS_CONFIG[key as RsvpStatusKey];
        expect(
          cfg.badgeClass,
          `Badge-Klasse für "${key}" sollte "${expected}" enthalten`
        ).toContain(`bg-${expected}`);
        // "unknown" uses text-foreground (neutral) instead of text-muted-700
        const expectedTextClass = key === 'unknown' ? 'text-foreground' : `text-${expected}-700`;
        expect(cfg.badgeClass, `sollte ${expectedTextClass} haben`).toContain(expectedTextClass);
      }
    });

    it('jede Config hat einen passenden Icon-Class-Tint', () => {
      for (const [key, expected] of Object.entries(expectedColors)) {
        const cfg = RSVP_STATUS_CONFIG[key as RsvpStatusKey];
        // iconClass may use 600 instead of 700 for icons
        const familyInIconClass =
          cfg.iconClass.includes(`text-${expected}-600`) ||
          cfg.iconClass.includes(`text-${expected}-700`) ||
          cfg.iconClass === 'text-muted-foreground' ||
          cfg.iconClass.includes('muted');
        expect(
          familyInIconClass,
          `iconClass für "${key}" (${cfg.iconClass}) passt nicht zu Farb-Familie "${expected}"`
        ).toBe(true);
      }
    });
  });

  // ─── Deutsche Labels ─────────────────────────────────────────────────
  describe('Labels', () => {
    it('alle Labels sind nicht-leere Strings', () => {
      for (const [key, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        expect(typeof cfg.label, `Label für "${key}" ist kein String`).toBe('string');
        expect(cfg.label.length, `Label für "${key}" ist leer`).toBeGreaterThan(0);
      }
    });

    it('Labels sind auf Deutsch (enthalten Umlaute oder deutsche Wörter)', () => {
      const accepted = RSVP_STATUS_CONFIG.accepted.label;
      const declined = RSVP_STATUS_CONFIG.declined.label;
      const pending = RSVP_STATUS_CONFIG.pending.label;
      expect(accepted.toLowerCase()).toContain('zusage');
      expect(declined.toLowerCase()).toContain('absage');
      expect(pending.toLowerCase()).toContain('antwort');
    });

    it('Labels sind unique (keine Duplikate)', () => {
      const labels = Object.values(RSVP_STATUS_CONFIG).map((c) => c.label);
      expect(new Set(labels).size, 'Labels sind nicht unique').toBe(labels.length);
    });
  });

  // ─── Order-Feld ───────────────────────────────────────────────────────
  describe('Order-Feld', () => {
    it('jede Config hat ein numerisches order-Feld', () => {
      for (const [key, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        expect(typeof cfg.order, `order für "${key}" ist nicht number`).toBe('number');
        expect(Number.isFinite(cfg.order)).toBe(true);
      }
    });

    it('unknown hat die höchste order (99) — als Fallback ans Ende', () => {
      expect(RSVP_STATUS_CONFIG.unknown.order).toBe(99);
    });

    it('akzeptierte/declined/maybe/pending haben order 1-4 in dieser Reihenfolge', () => {
      expect(RSVP_STATUS_CONFIG.accepted.order).toBe(1);
      expect(RSVP_STATUS_CONFIG.declined.order).toBe(2);
      expect(RSVP_STATUS_CONFIG.maybe.order).toBe(3);
      expect(RSVP_STATUS_CONFIG.pending.order).toBe(4);
    });
  });

  // ─── Icons ─────────────────────────────────────────────────────────────
  describe('Icons', () => {
    it('jede Config hat ein definiertes icon und buttonIcon (Lucide)', () => {
      for (const [key, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        expect(cfg.icon, `icon für "${key}" fehlt`).toBeDefined();
        expect(cfg.buttonIcon, `buttonIcon für "${key}" fehlt`).toBeDefined();
        // Lucide icons expose at least $$typeof and render
        expect(typeof cfg.icon).toBe('object');
        expect(typeof cfg.buttonIcon).toBe('object');
      }
    });
  });

  // ─── RSVP_ACTION_KEYS-Konsistenz ──────────────────────────────────────
  describe('RSVP_ACTION_KEYS-Konsistenz', () => {
    it('alle Action-Keys haben eine Config in RSVP_STATUS_CONFIG', () => {
      for (const key of RSVP_ACTION_KEYS) {
        expect(RSVP_STATUS_CONFIG[key], `Config für Action-Key "${key}" fehlt`).toBeDefined();
      }
    });

    it('Action-Keys sind eine strikte Teilmenge der RsvpStatusKey-Werte (ohne unknown)', () => {
      const allKeys = Object.keys(RSVP_STATUS_CONFIG) as RsvpStatusKey[];
      for (const actionKey of RSVP_ACTION_KEYS) {
        expect(allKeys, `"${actionKey}" ist kein gültiger Status-Key`).toContain(actionKey);
      }
      // pending und unknown sind KEINE Action-Keys
      expect(RSVP_ACTION_KEYS).not.toContain('pending');
      expect(RSVP_ACTION_KEYS).not.toContain('unknown');
    });

    it('genau 3 Action-Keys (accepted, declined, maybe)', () => {
      expect(RSVP_ACTION_KEYS).toHaveLength(3);
      expect([...RSVP_ACTION_KEYS].sort()).toEqual(['accepted', 'declined', 'maybe']);
    });
  });

  // ─── Klassen-Syntax-Konsistenz ─────────────────────────────────────────
  describe('Klassen-Syntax', () => {
    it('alle Tailwind-Klassen sind nicht-leer und beginnen mit gültigen Tokens', () => {
      for (const [key, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        for (const classField of ['badgeClass', 'buttonClass', 'buttonActiveClass'] as const) {
          const value = cfg[classField];
          expect(value.length, `${classField} für "${key}" ist leer`).toBeGreaterThan(0);
          // Should at least contain one Tailwind utility class
          expect(value, `${classField} für "${key}" sieht nicht nach Tailwind aus`).toMatch(
            /\b(bg-|text-|border-|ring-|hover:)/i
          );
        }
      }
    });

    it('activeState hat immer einen ring-1 (visuelles Feedback)', () => {
      for (const [key, cfg] of Object.entries(RSVP_STATUS_CONFIG)) {
        expect(
          cfg.buttonActiveClass,
          `buttonActiveClass für "${key}" sollte ring-1 enthalten`
        ).toContain('ring-1');
      }
    });
  });
});
