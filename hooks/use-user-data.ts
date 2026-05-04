import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

export interface UserClubData {
  clubId: string | null;
}

export interface UserMemberData {
  memberId: string | null;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  bio?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dateOfBirth?: string;
  memberType?: 'member' | 'trial' | 'inactive';
  membershipStatus?: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart?: string;
  membershipEnd?: string;
  trainingGroup?: string;
  notes?: string;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
};

export function useUserClub() {
  return useQuery({
    queryKey: QUERY_KEYS.userClub('current'),
    queryFn: async () => {
      const res = await fetch('/api/user/club');
      if (!res.ok) {
        throw new Error('Failed to fetch club data');
      }
      return res.json() as Promise<UserClubData>;
    },
    retry: 1,
    staleTime: STALE_TIMES.LONG,
  });
}

export function useUserMember() {
  return useQuery({
    queryKey: QUERY_KEYS.userMember('current'),
    queryFn: async () => {
      const res = await fetch('/api/user/member');
      if (!res.ok) {
        throw new Error('Failed to fetch member data');
      }
      return res.json() as Promise<UserMemberData>;
    },
    retry: 1,
    staleTime: STALE_TIMES.LONG,
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: QUERY_KEYS.userRoles('current'),
    queryFn: async () => {
      const res = await fetch('/api/user/roles');
      if (!res.ok) {
        throw new Error('Failed to fetch user roles');
      }
      const data = await res.json();
      return data.roles as UserRole[];
    },
    retry: 1,
    staleTime: STALE_TIMES.LONG,
  });
}

export function useHasRole(requiredRole: UserRole) {
  const { data: roles, isLoading } = useUserRoles();

  if (isLoading || !roles || roles.length === 0) {
    return { hasRole: false, isLoading };
  }

  const highestRole = roles.reduce((highest, role) => {
    return ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest;
  }, roles[0]);

  return {
    hasRole: ROLE_HIERARCHY[highestRole] >= ROLE_HIERARCHY[requiredRole],
    isLoading: false,
    currentRole: highestRole,
  };
}

export function useIsSuperadmin() {
  return useHasRole('superadmin');
}

export function useIsAdminOrAbove() {
  return useHasRole('admin');
}

export function useIsTrainerOrAbove() {
  return useHasRole('trainer');
}
