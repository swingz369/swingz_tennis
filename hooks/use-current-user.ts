import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await apiFetch('/api/user/me', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error('Nutzerdaten konnten nicht geladen werden');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
