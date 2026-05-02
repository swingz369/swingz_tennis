import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/cache';

export interface UserClubData {
  clubId: string | null;
}

export interface UserMemberData {
  memberId: string | null;
}

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
      return data.roles as string[];
    },
    retry: 1,
    staleTime: STALE_TIMES.LONG,
  });
}
