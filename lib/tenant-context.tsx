'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ClubBranding } from '@/lib/branding';
import { DEFAULT_BRANDING, mergeBranding, brandingToCSSVars } from '@/lib/branding';

interface TenantContextType {
  clubId: string | null;
  branding: ClubBranding;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  clubId: null,
  branding: DEFAULT_BRANDING,
  isLoading: true,
});

export function useTenant() {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [clubId, setClubId] = useState<string | null>(null);
  const [branding, setBranding] = useState<ClubBranding>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveTenant() {
      try {
        // Try to get clubId from cookie (set by middleware)
        const cookieClubId = document.cookie
          .split('; ')
          .find((row) => row.startsWith('tenant-club='))
          ?.split('=')[1];

        if (cookieClubId) {
          setClubId(cookieClubId);
          const res = await fetch(`/api/branding?clubId=${cookieClubId}`);
          if (res.ok) {
            const data = await res.json();
            const merged = mergeBranding({
              clubId: cookieClubId,
              brand: data.brand,
              logos: data.logos,
              customDomain: data.customDomain,
            });
            setBranding(merged);
            applyBrandingToDOM(merged);
          }
        } else {
          // No tenant context, use defaults
          setBranding(DEFAULT_BRANDING);
        }
      } catch (err) {
        console.error('Tenant resolution failed', err);
      } finally {
        setIsLoading(false);
      }
    }

    resolveTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ clubId, branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

function applyBrandingToDOM(branding: ClubBranding) {
  const vars = brandingToCSSVars(branding);
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Also update favicon if provided
  if (branding.logos.favicon) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = branding.logos.favicon;
  }
}
