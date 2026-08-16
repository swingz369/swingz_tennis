'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-fetch';

export interface FamilyMember {
  userId: string;
  fullName: string;
  email: string;
  role: 'parent' | 'child' | 'member';
  relationship: string | null;
  dateOfBirth: string | null;
  isMinor: boolean;
  isSelf: boolean;
}

export interface FamilyData {
  familyGroupId: string | null;
  inviteCode: string | null;
  members: FamilyMember[];
  currentUserId: string;
  /** Whether the currently active account belongs to a minor */
  isMinor: boolean;
  /** Whether the current user is acting as a parent viewing a child's account */
  isParentViewingChild: boolean;
}

const FAMILY_QUERY_KEY = ['family-accounts'];
const ACTIVE_FAMILY_USER_KEY = 'swingz_active_family_user';

function computeIsMinor(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const ageDifMs = Date.now() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970) < 18;
}

export function useFamilyAccounts() {
  const queryClient = useQueryClient();
  const [activeChildUserId, setActiveChildUserIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_FAMILY_USER_KEY);
  });

  const setActiveChildUserId = useCallback(
    (userId: string | null) => {
      setActiveChildUserIdState(userId);
      if (userId) {
        localStorage.setItem(ACTIVE_FAMILY_USER_KEY, userId);
      } else {
        localStorage.removeItem(ACTIVE_FAMILY_USER_KEY);
      }
      // Invalidate queries that depend on the active user context
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    [queryClient]
  );

  const { data, isLoading, error } = useQuery<FamilyData>({
    queryKey: FAMILY_QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch('/api/family-accounts', { credentials: 'include' });
      if (!res.ok) {
        // Not having a family is not an error
        if (res.status === 404) {
          return {
            familyGroupId: null,
            inviteCode: null,
            members: [],
            currentUserId: '',
            isMinor: false,
            isParentViewingChild: false,
          };
        }
        throw new Error('Failed to load family accounts');
      }
      const json = await res.json();

      // The API returns { familyGroupId, members: [...] }
      // Map to our FamilyMember type
      const members: FamilyMember[] = (json.members ?? []).map((m: Record<string, unknown>) => ({
        userId: m.userId ?? m.user_id,
        fullName: m.fullName ?? m.full_name ?? 'Unbekannt',
        email: m.email ?? '',
        role: m.role ?? 'member',
        relationship: m.relationship ?? null,
        dateOfBirth: m.dateOfBirth ?? m.date_of_birth ?? null,
        isMinor: computeIsMinor((m.dateOfBirth ?? m.date_of_birth) as string | null),
        isSelf: Boolean(m.isSelf),
      }));

      // Find current user in the family
      const currentUserId = json.currentUserId ?? '';
      const currentMember = members.find((m) => m.userId === currentUserId);
      const isMinor = currentMember?.isMinor ?? false;

      return {
        familyGroupId: json.familyGroupId ?? null,
        inviteCode: json.inviteCode ?? null,
        members,
        currentUserId,
        isMinor,
        isParentViewingChild: false, // Updated below
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  // Determine effective state
  const familyData = data ?? {
    familyGroupId: null,
    inviteCode: null,
    members: [],
    currentUserId: '',
    isMinor: false,
    isParentViewingChild: false,
  };

  // Check if parent is viewing a child's account
  const isParentViewingChild =
    activeChildUserId !== null && activeChildUserId !== familyData.currentUserId;
  const activeChild = activeChildUserId
    ? familyData.members.find((m) => m.userId === activeChildUserId)
    : null;

  // Whether the effective view is a minor account
  const effectiveIsMinor = isParentViewingChild
    ? (activeChild?.isMinor ?? false)
    : familyData.isMinor;

  // Erwachsener mit einem Familienkonto darf die Familie verwalten (Einladungscode
  // anzeigen/erneuern). Bewusst altersbasiert statt `role === 'parent'`, weil der
  // Admin-Pfad alle als 'member' anlegt.
  const isAdult = !familyData.isMinor;
  const hasFamily = familyData.familyGroupId !== null;
  const canManageFamily = isAdult && hasFamily;

  // Whether the current logged-in user is a parent (has children in family)
  const isParent =
    familyData.members.some(
      (m) => m.userId === familyData.currentUserId && (m.role === 'parent' || m.role === 'member')
    ) && familyData.members.some((m) => m.isMinor);

  // Children that this parent can switch to
  const children = familyData.members.filter((m) => m.isMinor);

  // Switch back to own account
  const switchToOwnAccount = useCallback(() => {
    setActiveChildUserId(null);
  }, [setActiveChildUserId]);

  // Switch to a child's account
  const switchToChild = useCallback(
    (childUserId: string) => {
      setActiveChildUserId(childUserId);
    },
    [setActiveChildUserId]
  );

  return {
    ...familyData,
    isLoading,
    error,
    isParent,
    children,
    isParentViewingChild,
    effectiveIsMinor,
    activeChild,
    isAdult,
    hasFamily,
    canManageFamily,
    switchToChild,
    switchToOwnAccount,
  };
}
