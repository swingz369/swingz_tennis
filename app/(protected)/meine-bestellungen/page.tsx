'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ShoppingBag,
  Eye,
  X,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

import { createLogger } from '@/lib/logger';

const log = createLogger('meine-bestellungen:page');

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

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string | undefined }>> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipped: Truck,
  cancelled: XCircle,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  shipped: 'Versendet',
  cancelled: 'Storniert',
};

const STATUS_COLORS: Record<string, string> = {
  pending:
    'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800/30',
  confirmed:
    'text-info-600 dark:text-info-400 bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800/30',
  shipped:
    'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800/30',
  cancelled:
    'text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800/30',
};

const FILTER_TABS = [
  { key: '', label: 'Alle' },
  { key: 'pending', label: 'Offen' },
  { key: 'confirmed', label: 'Bestätigt' },
  { key: 'shipped', label: 'Versendet' },
  { key: 'cancelled', label: 'Storniert' },
] as const;

export default function MeineBestellungenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = status ? `/api/shop/orders?status=${status}` : '/api/shop/orders';
      const res = await apiFetch(url);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      log.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(activeFilter);
  }, [activeFilter, fetchOrders]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <PageHeader title="Meine Bestellungen" description="Verfolge deine Shop-Bestellungen" />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeFilter === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(tab.key)}
            className={activeFilter === tab.key ? 'bg-primary hover:bg-primary/90' : ''}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <IconBox icon={ShoppingBag} size="lg" variant="gray" className="mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground dark:text-muted-foreground mb-1">
              Keine Bestellungen
            </p>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
              {activeFilter
                ? `Keine Bestellungen mit Status „${STATUS_LABELS[activeFilter] || activeFilter}“`
                : 'Du hast noch keine Bestellungen aufgegeben.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const StatusIcon = STATUS_ICONS[order.status] || Clock;
            return (
              <Card
                key={order.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedOrder(order);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${STATUS_COLORS[order.status]?.split(' ').slice(1, 3).join(' ') || 'bg-muted dark:bg-card/5'}`}
                      >
                        <StatusIcon
                          className={`h-5 w-5 ${STATUS_COLORS[order.status]?.split(' ')[0] || 'text-muted-foreground'}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground dark:text-white">
                          Bestellung #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(order.created_at)} · {(order.items ?? []).length} Artikel
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            className={`text-2xs px-1.5 py-0 border ${STATUS_COLORS[order.status]}`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1 inline" />
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-2xs px-1.5 py-0 ${
                              order.payment_status === 'paid'
                                ? 'border-success-200 dark:border-success-800/30 text-success-600 dark:text-success-400'
                                : 'border-border dark:border-white/10 text-muted-foreground'
                            }`}
                          >
                            {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-brand-light">
                        {formatCurrency(order.total_amount)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSelectedOrder(null);
            }}
            role="button"
            tabIndex={0}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <Card className="max-w-lg w-full shadow-2xl pointer-events-auto">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground dark:text-white">
                    Bestellung #{selectedOrder.id.slice(0, 8)}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setSelectedOrder(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-xs px-2 py-0.5 border ${STATUS_COLORS[selectedOrder.status]}`}
                  >
                    {(() => {
                      const Icon = STATUS_ICONS[selectedOrder.status] || Clock;
                      return <Icon className="h-3.5 w-3.5 mr-1 inline" />;
                    })()}
                    {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 ${
                      selectedOrder.payment_status === 'paid'
                        ? 'border-success-200 dark:border-success-800/30 text-success-600 dark:text-success-400'
                        : 'border-border dark:border-white/10 text-muted-foreground'
                    }`}
                  >
                    {selectedOrder.payment_status === 'paid' ? 'Bezahlt' : 'Zahlung ausstehend'}
                  </Badge>
                </div>

                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-2">
                    Artikel
                  </h3>
                  <div className="space-y-2">
                    {(selectedOrder.items ?? []).map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-border dark:border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted dark:bg-card/5 shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground dark:text-white">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity}× {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-foreground dark:text-white tabular-nums">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t border-border dark:border-white/10">
                  <span className="font-semibold text-foreground dark:text-white">Gesamt</span>
                  <span className="text-xl font-bold text-brand-light">
                    {formatCurrency(selectedOrder.total_amount)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Bestellt am {formatDate(selectedOrder.created_at)}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
