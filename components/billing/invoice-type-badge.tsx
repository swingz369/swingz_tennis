import { Badge } from '@/components/ui/badge';

/**
 * Zentraler Badge für den Rechnungs-Typ.
 *
 * Bewusst kein `StatusBadge`: Der Rechnungs-Typ (Saison / Mitgliedsbeitrag /
 * Zusatz) ist eine Kategorie, kein Lebenszyklus-Status. Er baut auf dem
 * kanonischen `Badge` auf statt einer handgerollten `<span>`-Kopie — so teilen
 * sich `billing-client` und `invoices-tab` dieselbe Darstellung.
 */

type InvoiceType = 'season' | 'membership' | 'adhoc';

const INVOICE_TYPE_CONFIG: Record<InvoiceType, { label: string; variant: 'info' | 'secondary' }> = {
  season: { label: 'Saison', variant: 'info' },
  membership: { label: 'Mitgliedsbeitrag', variant: 'info' },
  adhoc: { label: 'Zusatz', variant: 'secondary' },
};

export function InvoiceTypeBadge({ type }: { type?: string | null }) {
  const config = (type && INVOICE_TYPE_CONFIG[type as InvoiceType]) || INVOICE_TYPE_CONFIG.adhoc;
  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  );
}
