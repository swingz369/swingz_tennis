'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Store,
  ShoppingBag,
  DollarSign,
  X,
  Save,
  Eye,
  EyeOff,
  ClipboardList,
  CheckCircle2,
  Truck,
  Clock,
  Upload,
  ImagePlus,
  Link as LinkIcon,
} from 'lucide-react';
import { IconBox } from '@/components/ui/icon-box';
import { apiFetch } from '@/lib/api-fetch';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { PageHeader } from '@/components/ui/page-header';
import type { PaginationMeta } from '@/lib/pagination';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:shop:page');

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  stock: number;
  is_active: boolean;
  created_at?: string;
  club_id?: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ShopOrder {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  items: OrderItem[];
  created_at: string;
}

interface OrderSummary {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
}

const CATEGORIES = [
  'Bekleidung',
  'Ausrüstung',
  'Bälle',
  'Schläger',
  'Taschen',
  'Schuhe',
  'Accessoires',
  'Allgemein',
];

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string | undefined }>> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipped: Truck,
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  shipped: 'Versendet',
  cancelled: 'Storniert',
};

const STATUS_NEXT_ACTION: Record<
  string,
  { label: string; icon: typeof CheckCircle2; next: string } | null
> = {
  pending: { label: 'Bestätigen', icon: CheckCircle2, next: 'confirmed' },
  confirmed: { label: 'Versenden', icon: Truck, next: 'shipped' },
};

const emptyForm: Omit<Product, 'id' | 'created_at' | 'club_id'> = {
  name: '',
  description: '',
  price: 0,
  category: 'Allgemein',
  stock: 0,
  image_url: '',
  is_active: true,
};

export default function AdminShopPage() {
  const [activeTab, setActiveTab] = useState('products');

  // ── Product state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPagination, setProductsPagination] = useState<PaginationMeta | null>(null);
  const PRODUCTS_PER_PAGE = 20;

  // ── Image upload state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  // ── Order state ──
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [orderStats, setOrderStats] = useState<OrderSummary>({
    total_orders: 0,
    total_revenue: 0,
    pending_orders: 0,
  });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPagination, setOrdersPagination] = useState<PaginationMeta | null>(null);
  const ORDERS_PER_PAGE = 10;

  const fetchProducts = useCallback(async (page: number = 1) => {
    try {
      const res = await apiFetch(
        `/api/admin/shop/products?page=${page}&limit=${PRODUCTS_PER_PAGE}`
      );
      const data = await res.json();
      setProducts(data.products ?? []);
      setProductsPagination(data.pagination ?? null);
    } catch (err) {
      log.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async (statusFilter?: string, page: number = 1) => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(ORDERS_PER_PAGE));
      const res = await apiFetch(`/api/admin/shop/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrderStats({
        total_orders: data.total_orders ?? 0,
        total_revenue: data.total_revenue ?? 0,
        pending_orders: data.pending_orders ?? 0,
      });
      setOrdersPagination(data.pagination ?? null);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        log.error('Shop orders fetch failed:', err);
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(productsPage);
  }, [fetchProducts, productsPage]);

  useEffect(() => {
    fetchOrders(orderStatusFilter, ordersPage);
  }, [fetchOrders, orderStatusFilter, ordersPage]);

  const handleStatusFilterChange = (status: string) => {
    setOrderStatusFilter(status);
    setOrdersPage(1);
    // fetchOrders will be triggered by the useEffect
  };

  const handleAdvanceStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await apiFetch(`/api/admin/shop/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }
      toast.success(`Bestellung auf „${STATUS_LABELS[newStatus]}“ gesetzt`);
      fetchOrders(orderStatusFilter, ordersPage);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (
      !confirm(
        'Möchtest du diese Bestellung wirklich stornieren? Bei bereits bezahlten Bestellungen muss die Rückerstattung manuell über das Stripe-Dashboard erfolgen.'
      )
    )
      return;
    await handleAdvanceStatus(orderId, 'cancelled');
  };

  // ── Product actions ──

  const openCreateForm = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setImageFile(null);
    setImagePreview(null);
    setUploadingImage(false);
    setImageMode('upload');
  };

  const openEditForm = (product: Product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      category: product.category ?? 'Allgemein',
      stock: product.stock,
      image_url: product.image_url ?? '',
      is_active: product.is_active,
    });
    setShowForm(true);
    // Reset image upload state for edit
    setImageFile(null);
    setImagePreview(product.image_url || null);
    setUploadingImage(false);
    setImageMode(product.image_url ? 'url' : 'upload');
  };

  const handleImageSelected = (file: File | null) => {
    // Revoke previous blob URL to prevent memory leaks
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', imageFile);

      const res = await apiFetch('/api/admin/shop/upload', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload fehlgeschlagen');
      }

      const data = await res.json();
      return data.url;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Upload image first if in upload mode and a file is selected
      let imageUrl = form.image_url;
      if (imageMode === 'upload' && imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          setSaving(false);
          return; // upload failed, error already toasted
        }
        imageUrl = uploadedUrl;
      }

      const method = editId ? 'PUT' : 'POST';
      const body = editId
        ? { ...form, id: editId, image_url: imageUrl || null }
        : { ...form, image_url: imageUrl || null };

      const res = await apiFetch('/api/admin/shop/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Speichern');
      }

      toast.success(editId ? 'Produkt aktualisiert' : 'Produkt erstellt');
      setShowForm(false);
      setEditId(null);
      fetchProducts(productsPage);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await apiFetch(`/api/admin/shop/products?id=${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Löschen');
      }
      toast.success('Produkt gelöscht');
      setDeleteId(null);
      // Reset to page 1 if we deleted the last item on this page
      if (products.length === 1 && productsPage > 1) {
        setProductsPage(productsPage - 1);
      } else {
        fetchProducts(productsPage);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // With server-side pagination, all returned products are the current page
  // Separate active/inactive for display grouping
  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

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
    <div className="space-y-6">
      <PageHeader
        title="Shop verwalten"
        description="Produkte, Bestellungen & Vereinsshop"
        actions={[
          { label: 'Produkt anlegen', icon: Plus, onClick: openCreateForm, disabled: showForm },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Produkte',
            value: productsPagination?.totalCount ?? products.length,
            icon: Package,
            color: 'text-info-600 dark:text-info-400',
            bg: 'bg-info-50 dark:bg-info-900/30',
          },
          {
            label: 'Aktive',
            value: activeProducts.length,
            icon: Eye,
            color: 'text-brand-light',
            bg: 'bg-brand-light/10',
          },
          {
            label: 'Bestellungen',
            value: orderStats.total_orders,
            icon: ShoppingBag,
            color: 'text-info-600 dark:text-info-400',
            bg: 'bg-info-50 dark:bg-info-900/30',
          },
          {
            label: 'Umsatz Shop',
            value: orderStats.total_revenue > 0 ? formatCurrency(orderStats.total_revenue) : '—',
            icon: DollarSign,
            color: 'text-brand-accent',
            bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border border-border dark:border-white/10 shadow-sm p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-brand-primary mt-1.5 tabular-nums">
                    {typeof kpi.value === 'number' ? kpi.value.toLocaleString('de-DE') : kpi.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${kpi.bg}`}
                >
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Products | Orders */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-muted dark:bg-card/5 p-1 rounded-xl">
          <TabsTrigger
            value="products"
            className="rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Produkte
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Bestellungen
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Products Tab ════════════════ */}
        <TabsContent value="products" className="space-y-6 mt-4">
          {/* Create/Edit Form */}
          {showForm && (
            <Card className="border-brand-light/30">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <IconBox icon={Package} size="sm" variant="light" />
                  {editId ? 'Produkt bearbeiten' : 'Neues Produkt'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setEditId(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-name">Produktname *</Label>
                      <Input
                        id="prod-name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="z.B. Vereins-T-Shirt"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-category">Kategorie</Label>
                      <select
                        id="prod-category"
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-price">Preis (€) *</Label>
                      <Input
                        id="prod-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prod-stock">Lagerbestand</Label>
                      <Input
                        id="prod-stock"
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, stock: parseInt(e.target.value) || 0 }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Produktbild</Label>

                      {/* Mode toggle */}
                      <div className="flex items-center gap-1 mb-2">
                        <button
                          type="button"
                          onClick={() => setImageMode('upload')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                            imageMode === 'upload'
                              ? 'bg-brand-light/10 text-brand-light border-brand-light/30'
                              : 'bg-background dark:bg-surface-dark text-muted-foreground border-border dark:border-white/10'
                          }`}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Hochladen
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageMode('url')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                            imageMode === 'url'
                              ? 'bg-brand-light/10 text-brand-light border-brand-light/30'
                              : 'bg-background dark:bg-surface-dark text-muted-foreground border-border dark:border-white/10'
                          }`}
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          URL
                        </button>
                      </div>

                      {imageMode === 'upload' ? (
                        <>
                          {/* Drop zone */}
                          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- file upload drop zone requires drag events on label */}
                          <label
                            htmlFor="prod-image-upload"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dragCounter.current++;
                              setDragOver(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dragCounter.current--;
                              if (dragCounter.current <= 0) {
                                dragCounter.current = 0;
                                setDragOver(false);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              dragCounter.current = 0;
                              setDragOver(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                handleImageSelected(file);
                              }
                            }}
                            className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                              dragOver
                                ? 'border-brand-light bg-brand-light/5 scale-[1.02] shadow-lg shadow-brand-light/10'
                                : 'border-border dark:border-white/10 hover:border-brand-light/40 bg-muted/50 dark:bg-card/[0.02]'
                            }`}
                          >
                            {imagePreview ? (
                              <div className="relative w-full max-w-[200px] aspect-square rounded-xl overflow-hidden">
                                <Image
                                  src={imagePreview}
                                  alt="Vorschau"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted dark:bg-card/5">
                                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                </div>{' '}
                                <div className="text-center">
                                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                                    Bild auswählen oder hier ablegen
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    JPG, PNG, WebP, AVIF · max. 5 MB
                                  </p>
                                </div>
                              </>
                            )}
                            <input
                              id="prod-image-upload"
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp,.avif,.gif"
                              className="hidden"
                              onChange={(e) => {
                                handleImageSelected(e.target.files?.[0] ?? null);
                              }}
                            />
                          </label>
                          {imageFile && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                            </p>
                          )}
                          {uploadingImage && (
                            <div className="flex items-center gap-2 text-xs text-brand-light mt-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Lade Bild hoch…
                            </div>
                          )}
                        </>
                      ) : (
                        <Input
                          id="prod-image-url"
                          value={form.image_url}
                          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                          placeholder="https://..."
                        />
                      )}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="prod-desc">Beschreibung</Label>
                      <Textarea
                        id="prod-desc"
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Produktbeschreibung..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-3 md:col-span-2">
                      <Switch
                        id="prod-active"
                        checked={form.is_active}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, is_active: checked }))
                        }
                      />
                      <Label htmlFor="prod-active" className="cursor-pointer">
                        {form.is_active ? (
                          <span className="flex items-center gap-1.5 text-sm text-brand-light">
                            <Eye className="h-4 w-4" /> Produkt ist sichtbar
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <EyeOff className="h-4 w-4" /> Produkt ist ausgeblendet
                          </span>
                        )}
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {editId ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setEditId(null);
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <IconBox icon={Store} size="lg" variant="gray" className="mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground dark:text-muted-foreground mb-1">
                  Noch keine Produkte
                </p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                  Erstelle das erste Produkt für deinen Vereinsshop
                </p>
                <Button onClick={openCreateForm} className="gap-2">
                  <Plus className="h-4 w-4" /> Erstes Produkt anlegen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {activeProducts.length > 0 && (
                <Card className="border border-border dark:border-white/10 shadow-sm p-0">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                      <IconBox icon={Eye} size="xs" variant="light" /> Aktive Produkte
                      <Badge className="text-2xs px-1.5 py-0 bg-brand-light/10 text-brand-light border-brand-light/20 ml-1">
                        {activeProducts.length}
                        {productsPagination && productsPagination.totalPages > 1
                          ? ` (Seite ${productsPagination.page})`
                          : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produkt</TableHead>
                          <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
                          <TableHead className="text-right">Preis</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Bestand</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted dark:bg-card/5 shrink-0">
                                  {product.image_url ? (
                                    <Image
                                      src={product.image_url}
                                      alt={product.name}
                                      width={36}
                                      height={36}
                                      className="h-9 w-9 rounded-xl object-cover"
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground dark:text-white truncate max-w-[200px]">
                                    {product.name}
                                  </p>
                                  {product.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px] hidden sm:block">
                                      {product.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {product.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground dark:text-white tabular-nums">
                              {formatCurrency(product.price)}
                            </TableCell>
                            <TableCell className="text-right hidden md:table-cell">
                              <span
                                className={
                                  product.stock <= 0
                                    ? 'text-error-500 font-medium'
                                    : product.stock < 5
                                      ? 'text-brand-accent-500 font-medium'
                                      : 'text-muted-foreground dark:text-muted-foreground'
                                }
                              >
                                {product.stock}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditForm(product)}
                                  className="h-8 w-8 p-0"
                                  aria-label={`${product.name} bearbeiten`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteId(product.id)}
                                  className="h-8 w-8 p-0 text-error-500 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20"
                                  aria-label={`${product.name} löschen`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {inactiveProducts.length > 0 && (
                <Card className="border border-border dark:border-white/10 shadow-sm p-0 opacity-70">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                      <IconBox icon={EyeOff} size="xs" variant="gray" /> Ausgeblendete Produkte
                      <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                        {inactiveProducts.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <Table>
                      <TableBody>
                        {inactiveProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Package className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                <span className="text-muted-foreground line-through">
                                  {product.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditForm(product)}
                                className="h-7 text-xs"
                              >
                                Aktivieren
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Products Pagination */}
          {productsPagination && (
            <PaginationNav meta={productsPagination} compact onPageChange={setProductsPage} />
          )}

          {/* Delete confirmation */}
          {deleteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Card className="max-w-md w-full mx-4 shadow-xl border-error-200 dark:border-error-800/50">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-error-700 dark:text-error-400">
                    <Trash2 className="h-5 w-5" /> Produkt löschen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    Möchtest du dieses Produkt wirklich löschen? Diese Aktion kann nicht rückgängig
                    gemacht werden.
                  </p>
                  <div className="flex items-center gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" /> Endgültig löschen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ════════════════ Orders Tab ════════════════ */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleStatusFilterChange('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                orderStatusFilter === ''
                  ? 'bg-foreground text-background border-foreground dark:bg-card dark:text-foreground dark:border-white'
                  : 'bg-background dark:bg-surface-dark text-muted-foreground dark:text-muted-foreground border-border dark:border-white/10 hover:border-border dark:hover:border-white/20'
              }`}
            >
              Alle ({orderStats.total_orders})
            </button>
            {[
              { key: 'pending', label: 'Offen', count: orderStats.pending_orders },
              { key: 'confirmed', label: 'Bestätigt', count: null },
              { key: 'shipped', label: 'Versendet', count: null },
              { key: 'cancelled', label: 'Storniert', count: null },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => handleStatusFilterChange(filter.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  orderStatusFilter === filter.key
                    ? 'bg-foreground text-background border-foreground dark:bg-card dark:text-foreground dark:border-white'
                    : 'bg-background dark:bg-surface-dark text-muted-foreground dark:text-muted-foreground border-border dark:border-white/10 hover:border-border dark:hover:border-white/20'
                }`}
              >
                {filter.label}
                {filter.count != null ? ` (${filter.count})` : ''}
              </button>
            ))}
          </div>

          {/* Orders table */}
          {ordersLoading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <IconBox icon={ClipboardList} size="lg" variant="gray" className="mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground dark:text-muted-foreground mb-1">
                  Keine Bestellungen
                </p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                  {orderStatusFilter
                    ? `Keine Bestellungen mit Status „${STATUS_LABELS[orderStatusFilter]}“`
                    : 'Sobald Mitglieder Produkte bestellen, erscheinen sie hier'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border dark:border-white/10 shadow-sm p-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
                  <IconBox icon={ClipboardList} size="xs" variant="light" />
                  {orderStatusFilter ? STATUS_LABELS[orderStatusFilter] : 'Alle'} Bestellungen
                  <Badge className="text-2xs px-1.5 py-0 bg-brand-light/10 text-brand-light border-brand-light/20 ml-1">
                    {ordersPagination?.totalCount ?? orders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bestellung</TableHead>
                      <TableHead className="hidden md:table-cell">Artikel</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Zahlung</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const StatusIcon = STATUS_ICONS[order.status] || Clock;
                      const nextAction = STATUS_NEXT_ACTION[order.status] || null;
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground dark:text-white text-xs font-mono truncate max-w-[100px]">
                                {order.id.slice(0, 8)}…
                              </p>
                              <p className="text-2xs text-muted-foreground mt-0.5">
                                {order.created_at ? formatDate(order.created_at) : '—'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-0.5 max-w-[200px]">
                              {(order.items ?? []).slice(0, 2).map((item, i) => (
                                <div
                                  key={i}
                                  className="text-xs text-muted-foreground dark:text-muted-foreground truncate"
                                >
                                  {item.quantity}× {item.product_name}
                                </div>
                              ))}
                              {(order.items ?? []).length > 2 && (
                                <p className="text-2xs text-muted-foreground">
                                  +{(order.items ?? []).length - 2} weitere
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground dark:text-white tabular-nums">
                            {formatCurrency(order.total_amount)}
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell">
                            <Badge
                              variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                              className={`text-2xs px-1.5 py-0 ${
                                order.payment_status === 'paid'
                                  ? 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 border-success-200 dark:border-success-800/30'
                                  : ''
                              }`}
                            >
                              {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-2xs px-2 py-0.5 border ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1 inline" />
                              {STATUS_LABELS[order.status] || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {nextAction && order.payment_status === 'paid' ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-brand-light/30 text-brand-light hover:bg-brand-light/5"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() => handleAdvanceStatus(order.id, nextAction.next)}
                                >
                                  {updatingOrderId === order.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <nextAction.icon className="h-3 w-3" />
                                  )}
                                  {nextAction.label}
                                </Button>
                                {order.status === 'pending' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-error-500 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20"
                                    disabled={updatingOrderId === order.id}
                                    onClick={() => handleCancelOrder(order.id)}
                                    title="Stornieren"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ) : order.status === 'shipped' ? (
                              <span className="text-2xs text-muted-foreground italic">
                                Erledigt
                              </span>
                            ) : order.status === 'cancelled' ? (
                              <span className="text-2xs text-error-400 italic">Storniert</span>
                            ) : order.payment_status !== 'paid' ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-2xs text-muted-foreground italic">
                                  Warte auf Zahlung
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-error-500 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() => handleCancelOrder(order.id)}
                                  title="Stornieren"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Orders Pagination */}
          {ordersPagination && (
            <PaginationNav meta={ordersPagination} compact onPageChange={setOrdersPage} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
