import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

/**
 * Trainer record ID (trainers.id, not auth user ID) — used to filter own
 * sessions. Über Route → resolveTrainerRecordId statt direktem
 * Supabase-Zugriff mit E-Mail-Textvergleich (ADR-005, siehe
 * docs/ARCHIV/2026-09-17-ux-analyse-und-sanierungsprompt.md § 2.3).
 */
export function useTrainerRecordId(isTrainer: boolean): string | null {
  const [trainerRecordId, setTrainerRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTrainer) return;
    let cancelled = false;
    apiFetch('/api/trainer/record-id')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setTrainerRecordId(data?.trainerId ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [isTrainer]);

  return trainerRecordId;
}
