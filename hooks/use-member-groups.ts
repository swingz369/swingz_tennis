import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/cache';

/**
 * Returns the active training group IDs for the current member within a club.
 * Used to filter sessions and plan entries in the member calendar view.
 */
export function useMemberGroupIds(clubId: string | null) {
  return useQuery({
    queryKey: ['member-group-ids', clubId],
    queryFn: async ({ signal }) => {
      if (!clubId) return [] as string[];
      const res = await fetch(`/api/user/member/groups?clubId=${clubId}`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) {
        // Gracefully return empty if the endpoint fails (e.g. no group memberships yet)
        return [] as string[];
      }
      const data = await res.json();
      return (data.groupIds ?? []) as string[];
    },
    enabled: !!clubId,
    staleTime: STALE_TIMES.LONG,
    gcTime: STALE_TIMES.LONG * 2,
  });
}
