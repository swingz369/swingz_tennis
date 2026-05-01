import { describe, it, expect } from 'vitest';
import { sendRemindersSchema } from '@/application/validation/schemas/reminders.schema';

describe('sendRemindersSchema', () => {
  it('should accept valid dryRun=false', () => {
    const result = sendRemindersSchema.parse({ dryRun: false });
    expect(result.dryRun).toBe(false);
  });

  it('should accept valid dryRun=true', () => {
    const result = sendRemindersSchema.parse({ dryRun: true });
    expect(result.dryRun).toBe(true);
  });

  it('should accept empty object (default dryRun=false)', () => {
    const result = sendRemindersSchema.parse({});
    expect(result.dryRun).toBe(false);
  });

  it('should reject invalid types', () => {
    // TypeScript correctly infers error for string instead of boolean
    // @ts-expect-error testing invalid type coercion
    expect(() => sendRemindersSchema.parse({ dryRun: 'yes' })).toThrow();
  });
});
