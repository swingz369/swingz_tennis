import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PortalButton } from '@/app/(protected)/admin/subscription/subscribe-button';

/**
 * Ganzseitige Sperre anstelle des Vereinsbereichs. Zwei Fälle, eine
 * Komponente — siehe lib/subscription-gate.ts:
 *
 *   past_due → Abo läuft, die Abbuchung ist gescheitert. Der Kunde muss ins
 *              Stripe-Portal, um die Zahlungsmethode zu korrigieren.
 *   none     → gar kein Abo. Der Kunde muss zuerst eines abschließen.
 *
 * Bewusst inline gerendert statt als Redirect: die Zielseite (/admin/
 * subscription) liegt selbst hinter derselben Sperre, ein Redirect würde
 * also im Kreis laufen.
 */
export function SubscriptionDunningBlock() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
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

export function SubscriptionRequiredBlock({
  href = '/admin/subscription',
}: {
  /** Superadmins verwalten ihr Abo unter /superadmin/subscription. */
  href?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Abonnement erforderlich</h1>
        <p className="text-muted-foreground">
          Der Vereinsbereich von SwingZ ist kostenpflichtig. Wähle einen Tarif, um deinen Verein zu
          verwalten — Mitglieder, Trainer und Platzbuchungen bleiben so lange unberührt.
        </p>
        <Button asChild className="w-full">
          <Link href={href}>Tarif wählen</Link>
        </Button>
      </div>
    </div>
  );
}
