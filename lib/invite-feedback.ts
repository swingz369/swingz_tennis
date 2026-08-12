'use client';

import { toast } from 'sonner';

export type InviteResult = {
  message?: string;
  mailSent?: boolean;
  inviteLink?: string | null;
};

/**
 * Zeigt das Ergebnis einer Einladung an.
 *
 * Konnte die Einladungsmail nicht zugestellt werden, ist der zurückgegebene Link
 * der einzige verbleibende Weg in das neue Konto — die Meldung bleibt deshalb
 * stehen, bis sie weggeklickt wird, statt nach drei Sekunden zu verschwinden.
 */
export function showInviteResult(data: InviteResult, fallback: string) {
  const message = data.message ?? fallback;

  if (data.mailSent === false && data.inviteLink) {
    const link = data.inviteLink;
    toast.warning(message, {
      duration: Infinity,
      description: link,
      action: {
        label: 'Link kopieren',
        onClick: () => void navigator.clipboard?.writeText(link),
      },
    });
    return;
  }

  toast.success(message);
}
