'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ArrowRight, ShoppingBag, Package, Home } from 'lucide-react';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  items: OrderItem[];
  created_at: string;
}

export const dynamic = 'force-dynamic';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    fetch(`/api/shop/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => setOrder(data.order || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 mx-auto">
          <ShoppingBag className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Keine Bestellung gefunden</h1>
        <p className="text-muted-foreground">
          Es wurde keine Bestell-ID übergeben. Bitte überprüfe den Link.
        </p>
        <Link href="/shop">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            Zurück zum Shop
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      {/* Success header */}
      <div className="text-center space-y-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Vielen Dank für deine Bestellung!</h1>
        <p className="text-sm text-muted-foreground">
          {order
            ? `Deine Bestellung #${order.id.slice(0, 8)} ist bei uns eingegangen.`
            : 'Deine Zahlung wird verarbeitet. Du erhältst in Kürze eine Bestätigung.'}
        </p>
      </div>

      {/* Order summary */}
      {order && (
        <Card className="border-brand-light/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Bestellübersicht</h2>
              <Badge
                className={
                  order.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                }
              >
                {order.payment_status === 'paid' ? 'Bezahlt' : 'In Bearbeitung'}
              </Badge>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {((order.items || []) as OrderItem[])
                .filter((item) => item.product_id)
                .map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {item.product_name}{' '}
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                    </div>
                    <span className="font-medium">€{(item.total || 0).toFixed(2)}</span>
                  </div>
                ))}
            </div>

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-semibold">Gesamtsumme</span>
              <span className="text-lg font-bold text-brand-light">
                €{order.total_amount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        <Link href="/shop">
          <Button variant="outline" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Weiter einkaufen
          </Button>
        </Link>
        <Link href="/member">
          <Button variant="ghost" className="gap-2">
            <Home className="h-4 w-4" />
            Zum Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function ShopSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
