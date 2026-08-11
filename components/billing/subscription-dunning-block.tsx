import { PortalButton } from '@/app/(protected)/admin/(gated)/subscription/subscribe-button';

/**
 * Full-page block shown instead of gated content when the caller's own SaaS
 * subscription is past_due/unpaid. Shared by admin and superadmin gated
 * layouts — see lib/subscription-gate.ts for the underlying check.
 */
export function SubscriptionDunningBlock() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Zahlung ausstehend</h1>
        <p className="text-muted-foreground">
          Die Zahlung für dein SwingZ-Abonnement konnte nicht verarbeitet werden. Bitte aktualisiere
          deine Zahlungsmethode, um den Zugriff fortzusetzen.
        </p>
        <PortalButton />
      </div>
    </div>
  );
}
