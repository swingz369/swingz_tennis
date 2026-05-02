import { describe, it, expect } from 'vitest';

describe('useUserData Hook', () => {
  describe('exports', () => {
    it('should export useUserClub', async () => {
      const { useUserClub } = await import('@/hooks/use-user-data');
      expect(typeof useUserClub).toBe('function');
    });

    it('should export useUserMember', async () => {
      const { useUserMember } = await import('@/hooks/use-user-data');
      expect(typeof useUserMember).toBe('function');
    });

    it('should export useUserRoles', async () => {
      const { useUserRoles } = await import('@/hooks/use-user-data');
      expect(typeof useUserRoles).toBe('function');
    });

    it('should export useUserData namespace', async () => {
      const useUserData = await import('@/hooks/use-user-data');
      expect(useUserData).toBeDefined();
      expect(typeof useUserData.useUserClub).toBe('function');
      expect(typeof useUserData.useUserMember).toBe('function');
      expect(typeof useUserData.useUserRoles).toBe('function');
    });
  });
});
