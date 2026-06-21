'use client';

import { useMemo } from 'react';

export type AppRole = 'owner' | 'superadmin' | 'admin' | 'trainer' | 'member';

export interface UserRoleInfo {
  /** Highest-priority role (owner > superadmin > admin > trainer > member). */
  currentRole: AppRole;
  isOwner: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  isMember: boolean;
}

export function useUserRole(roles?: string[]): UserRoleInfo {
  return useMemo(() => {
    const isOwner = roles?.includes('owner') ?? false;
    const isSuperAdmin = roles?.includes('superadmin') ?? false;
    const isAdmin = roles?.includes('admin') ?? false;
    const isTrainer = roles?.includes('trainer') ?? false;

    const currentRole: AppRole = isOwner
      ? 'owner'
      : isSuperAdmin
        ? 'superadmin'
        : isAdmin
          ? 'admin'
          : isTrainer
            ? 'trainer'
            : 'member';

    return {
      currentRole,
      isOwner,
      isSuperAdmin,
      isAdmin,
      isTrainer,
      isMember: !isOwner && !isSuperAdmin && !isAdmin && !isTrainer,
    };
  }, [roles]);
}
