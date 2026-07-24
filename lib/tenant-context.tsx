'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';
import type { ClubBranding } from '@/lib/branding';
import { DEFAULT_BRANDING } from '@/lib/branding';

interface TenantContextType {
  clubId: string | null;
  branding: ClubBranding;
}

const TenantContext = createContext<TenantContextType>({
  clubId: null,
  branding: DEFAULT_BRANDING,
});

export function useTenant() {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  children: ReactNode;
  /** Active club id, resolved server-side in app/(protected)/layout.tsx. */
  clubId?: string | null;
  /**
   * Club branding, resolved server-side in app/(protected)/layout.tsx.
   * Colors are already applied via an SSR-rendered <style> tag (no flash);
   * this provider only needs to expose the data to client components
   * (logo <img> src in header/sidebar) and keep the favicon <link> in sync.
   */
  branding?: ClubBranding;
}

export function TenantProvider({
  children,
  clubId = null,
  branding = DEFAULT_BRANDING,
}: TenantProviderProps) {
  useEffect(() => {
    if (!branding.logos.favicon) return;
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (link) link.href = branding.logos.favicon;
  }, [branding.logos.favicon]);

  return <TenantContext.Provider value={{ clubId, branding }}>{children}</TenantContext.Provider>;
}
