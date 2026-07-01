import { createHash } from 'crypto';

/**
 * Deterministic pseudonym for DSGVO anonymization.
 * SHA-256 of the input — stable across runs, not reversible.
 */
export function hashIdentifier(value: string, _scope?: string, _length?: number): string {
  return createHash('sha256').update(value).digest('hex');
}
