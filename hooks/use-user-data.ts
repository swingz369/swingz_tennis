import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';
import { fetchJSON } from '@/lib/fetch-utils';

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

export interface UserClubData {
  clubId: string | null;
  club?: {
    id: string;
    name: string;
    maxMembers: number;
    defaultHourlyRate: number;
    taxRate: number;
    status: string;
    bundesland: string | null;
    billingUnitMinutes: number;
    defaultPaymentMethod: string;
    invoicePrefix: string;
  } | null;
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
    queryFn: ({ signal }) =>
      fetchJSON<UserClubData>('/api/user/club', {
        signal, // Support cancellation
        timeout: 15000, // 15 second timeout
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
        },
      }),
    staleTime: STALE_TIMES.LONG,
    gcTime: STALE_TIMES.LONG * 2, // Keep in cache longer
  });
}

export function useUserMember() {
  return useQuery({
    queryKey: QUERY_KEYS.userMember('current'),
    queryFn: ({ signal }) =>
      fetchJSON<UserMemberData>('/api/user/member', {
        signal,
        timeout: 15000,
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
        },
      }),
    staleTime: STALE_TIMES.LONG,
    gcTime: STALE_TIMES.LONG * 2,
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: QUERY_KEYS.userRoles('current'),
    queryFn: async ({ signal }) => {
      const data = await fetchJSON<{ roles: UserRole[] }>('/api/user/roles', {
        signal,
        timeout: 15000,
        retry: {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
        },
      });
      return data.roles;
    },
    staleTime: STALE_TIMES.LONG,
    gcTime: STALE_TIMES.LONG * 2,
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
