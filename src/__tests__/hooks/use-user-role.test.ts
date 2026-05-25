/**
 * Unit tests for centralised role detection hook.
 *
 * Tests hooks/use-user-role.ts — React hook using useMemo.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserRole } from '@/hooks/use-user-role';
import type { AppRole } from '@/hooks/use-user-role';

// ════════════════════════════════════════════════════════════
// Single-role detection
// ════════════════════════════════════════════════════════════

describe('useUserRole — single role', () => {
  it('detects superadmin correctly', () => {
    const { result } = renderHook(() => useUserRole(['superadmin']));

    expect(result.current.currentRole).toBe('superadmin');
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(false);
  });

  it('detects admin correctly', () => {
    const { result } = renderHook(() => useUserRole(['admin']));

    expect(result.current.currentRole).toBe('admin');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(false);
  });

  it('detects trainer correctly', () => {
    const { result } = renderHook(() => useUserRole(['trainer']));

    expect(result.current.currentRole).toBe('trainer');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('detects member correctly', () => {
    const { result } = renderHook(() => useUserRole(['member']));

    expect(result.current.currentRole).toBe('member');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// Multiple roles — priority
// ════════════════════════════════════════════════════════════

describe('useUserRole — multiple roles (priority)', () => {
  it('superadmin wins over admin', () => {
    const { result } = renderHook(() => useUserRole(['admin', 'superadmin']));

    expect(result.current.currentRole).toBe('superadmin');
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.isAdmin).toBe(true); // still true, just not currentRole
  });

  it('superadmin wins over trainer', () => {
    const { result } = renderHook(() => useUserRole(['trainer', 'superadmin']));

    expect(result.current.currentRole).toBe('superadmin');
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.isTrainer).toBe(true);
  });

  it('superadmin wins over all three lower roles', () => {
    const { result } = renderHook(() => useUserRole(['member', 'trainer', 'admin', 'superadmin']));

    expect(result.current.currentRole).toBe('superadmin');
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('admin wins over trainer', () => {
    const { result } = renderHook(() => useUserRole(['trainer', 'admin']));

    expect(result.current.currentRole).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('admin wins over member', () => {
    const { result } = renderHook(() => useUserRole(['member', 'admin']));

    expect(result.current.currentRole).toBe('admin');
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('trainer wins over member', () => {
    const { result } = renderHook(() => useUserRole(['member', 'trainer']));

    expect(result.current.currentRole).toBe('trainer');
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
  });

  it('admin + trainer + member → admin wins', () => {
    const { result } = renderHook(() => useUserRole(['member', 'trainer', 'admin']));

    expect(result.current.currentRole).toBe('admin');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isTrainer).toBe(true);
    expect(result.current.isMember).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// Empty / undefined / edge cases
// ════════════════════════════════════════════════════════════

describe('useUserRole — empty and edge cases', () => {
  it('returns member when roles is an empty array', () => {
    const { result } = renderHook(() => useUserRole([]));

    expect(result.current.currentRole).toBe('member');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(true);
  });

  it('returns member when roles is undefined', () => {
    const { result } = renderHook(() => useUserRole(undefined));

    expect(result.current.currentRole).toBe('member');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(true);
  });

  it('returns member when roles is not provided at all', () => {
    const { result } = renderHook(() => useUserRole());

    expect(result.current.currentRole).toBe('member');
    expect(result.current.isMember).toBe(true);
  });

  it('ignores unknown role strings', () => {
    // @ts-expect-error — testing runtime behavior with unknown roles
    const { result } = renderHook(() => useUserRole(['superadmin', 'unknown']));

    expect(result.current.currentRole).toBe('superadmin');
    expect(result.current.isSuperAdmin).toBe(true);
    // 'unknown' doesn't match any known role — treated as if not present
  });

  it('returns member when roles contains only unknown values', () => {
    // @ts-expect-error — testing runtime behavior
    const { result } = renderHook(() => useUserRole(['unknown', 'guest']));

    expect(result.current.currentRole).toBe('member');
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isTrainer).toBe(false);
    expect(result.current.isMember).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// Memoization (useMemo)
// ════════════════════════════════════════════════════════════

describe('useUserRole — memoization', () => {
  it('returns the same object reference when roles array reference is unchanged', () => {
    const roles = ['admin'];
    const { result, rerender } = renderHook((r: string[]) => useUserRole(r), {
      initialProps: roles,
    });

    const first = result.current;
    rerender(roles); // same array reference → useMemo returns cached value
    const second = result.current;

    expect(first).toBe(second);
  });

  it('returns a new object when roles array reference changes even if content is same', () => {
    const { result, rerender } = renderHook((r: string[]) => useUserRole(r), {
      initialProps: ['admin'],
    });

    const first = result.current;
    rerender(['admin']); // new array instance (same content) → useMemo recomputes
    const second = result.current;

    expect(first).not.toBe(second);
    expect(second.currentRole).toBe('admin');
    expect(second.isAdmin).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// Type-level: all AppRole values
// ════════════════════════════════════════════════════════════

describe('useUserRole — AppRole exhaustiveness', () => {
  it('maps each AppRole value to correct currentRole', () => {
    const roles: AppRole[] = ['superadmin', 'admin', 'trainer', 'member'];

    for (const role of roles) {
      const { result } = renderHook(() => useUserRole([role]));

      expect(result.current.currentRole).toBe(role);
    }
  });
});
