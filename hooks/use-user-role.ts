'use client';

import { useMemo } from 'react';

export type AppRole = 'superadmin' | 'admin' | 'trainer' | 'member';

export interface UserRoleInfo {
  /** Highest-priority role (superadmin > admin > trainer > member). */
  currentRole: AppRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  isMember: boolean;
}

/**
 * Centralised role detection for all nav components.
 *
 * Roles array is expected to contain one or more of:
 * 'superadmin', 'admin', 'trainer', 'member'.
 *
 * The "highest" role wins when multiple are present.
 */
export function useUserRole(roles?: string[]): UserRoleInfo {
  return useMemo(() => {
    const isSuperAdmin = roles?.includes('superadmin') ?? false;
    const isAdmin = roles?.includes('admin') ?? false;
    const isTrainer = roles?.includes('trainer') ?? false;

    const currentRole: AppRole = isSuperAdmin
      ? 'superadmin'
      : isAdmin
        ? 'admin'
        : isTrainer
          ? 'trainer'
          : 'member';

    return {
      currentRole,
      isSuperAdmin,
      isAdmin,
      isTrainer,
      isMember: !isSuperAdmin && !isAdmin && !isTrainer,
    };
  }, [roles]);
}
