'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipped: Truck,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30',
  confirmed: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30',
  shipped: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30',
  cancelled: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  confirmed: 'Bestätigt',
  shipped: 'Versendet',
  cancelled: 'Storniert',
};

const STATUS_NEXT_ACTION: Record<string, { label: string; icon: typeof CheckCircle2; next: string } | null> = {
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

  // ── Image upload state ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');

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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/products');
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async (statusFilter?: string) => {
    setOrdersLoading(true);
    try {
      const url = statusFilter
        ? `/api/admin/shop/orders?status=${statusFilter}`
        : '/api/admin/shop/orders';
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrderStats({
        total_orders: data.total_orders ?? 0,
        total_revenue: data.total_revenue ?? 0,
        pending_orders: data.pending_orders ?? 0,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Shop orders fetch failed:', err);
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, [fetchProducts, fetchOrders]);

  const handleStatusFilterChange = (status: string) => {
    setOrderStatusFilter(status);
    fetchOrders(status);
  };

  const handleAdvanceStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }
      toast.success(`Bestellung auf „${STATUS_LABELS[newStatus]}“ gesetzt`);
      fetchOrders(orderStatusFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingOrderId(null);
    }
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

      const res = await fetch('/api/admin/shop/upload', {
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

      const res = await fetch('/api/admin/shop/products', {
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
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/admin/shop/products?id=${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Löschen');
      }
      toast.success('Produkt gelöscht');
      setDeleteId(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Shop verwalten</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Produkte, Bestellungen & Vereinsshop
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2" disabled={showForm}>
          <Plus className="h-4 w-4" />
          Produkt anlegen
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Produkte',
            value: products.length,
            icon: Package,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/30',
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
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-900/30',
          },
          {
            label: 'Umsatz Shop',
            value: orderStats.total_revenue > 0
              ? formatCurrency(orderStats.total_revenue)
              : '—',
            icon: DollarSign,
            color: 'text-brand-accent',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="border border-gray-200 dark:border-white/10 shadow-sm p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-brand-primary mt-1.5 tabular-nums">
                    {typeof kpi.value === 'number' ? kpi.value.toLocaleString('de-DE') : kpi.value}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Products | Orders */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <TabsTrigger value="products" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm">
            <Package className="h-4 w-4 mr-2" />
            Produkte
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm">
            <ClipboardList className="h-4 w-4 mr-2" />
            Bestellungen
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Products Tab ════════════════ */}
        <TabsContent value="products" className="space-y-6 mt-4">

          {/* Create/Edit Form */}
          {showForm && (
            <Card className="border-brand-light/30 shadow-md bg-gradient-to-br from-white to-brand-light/5 dark:from-surface-dark dark:to-brand-light/5">
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
                        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light/50"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
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
                        onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
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
                        onChange={(e) => setForm((f) => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            imageMode === 'upload'
                              ? 'bg-brand-light/10 text-brand-light border-brand-light/30'
                              : 'bg-white dark:bg-surface-dark text-gray-500 border-gray-200 dark:border-white/10'
                          }`}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Hochladen
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageMode('url')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            imageMode === 'url'
                              ? 'bg-brand-light/10 text-brand-light border-brand-light/30'
                              : 'bg-white dark:bg-surface-dark text-gray-500 border-gray-200 dark:border-white/10'
                          }`}
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          URL
                        </button>
                      </div>

                      {imageMode === 'upload' ? (
                        <>
                          {/* Drop zone */}
                          <label
                            htmlFor="prod-image-upload"
                            className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-brand-light/40 transition-colors bg-gray-50/50 dark:bg-white/[0.02]"
                          >
                            {imagePreview ? (
                              <div className="relative w-full max-w-[200px] aspect-square rounded-lg overflow-hidden">
                                <Image
                                  src={imagePreview}
                                  alt="Vorschau"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
                                  <ImagePlus className="h-6 w-6 text-gray-400" />
                                </div>                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Bild auswählen
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
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
                            <p className="text-xs text-gray-500 mt-1 truncate">
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
                          onChange={(e) =>
                            setForm((f) => ({ ...f, image_url: e.target.value }))
                          }
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
                        onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                      />
                      <Label htmlFor="prod-active" className="cursor-pointer">
                        {form.is_active ? (
                          <span className="flex items-center gap-1.5 text-sm text-brand-light">
                            <Eye className="h-4 w-4" /> Produkt ist sichtbar
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-gray-400">
                            <EyeOff className="h-4 w-4" /> Produkt ist ausgeblendet
                          </span>
                        )}
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {editId ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowForm(false); setEditId(null); }}
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
                <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">Noch keine Produkte</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
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
                <Card className="border border-gray-200 dark:border-white/10 shadow-sm p-0">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                      <IconBox icon={Eye} size="xs" variant="light" /> Aktive Produkte
                      <Badge className="text-[11px] px-1.5 py-0 bg-brand-light/10 text-brand-light border-brand-light/20 ml-1">
                        {activeProducts.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-white/5">
                            <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Produkt</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Kategorie</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Preis</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Bestand</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/[0.02]">
                          {activeProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 shrink-0">
                                    {product.image_url ? (
                                      <Image src={product.image_url} alt={product.name} width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
                                    ) : (
                                      <Package className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{product.name}</p>
                                    {product.description && (
                                      <p className="text-xs text-gray-400 truncate max-w-[200px] hidden sm:block">{product.description}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2 hidden sm:table-cell">
                                <Badge variant="outline" className="text-xs">{product.category}</Badge>
                              </td>
                              <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(product.price)}
                              </td>
                              <td className="py-3 px-2 text-right hidden md:table-cell">
                                <span className={
                                  product.stock <= 0 ? 'text-red-500 font-medium' :
                                  product.stock < 5 ? 'text-orange-500 font-medium' :
                                  'text-gray-600 dark:text-gray-400'
                                }>{product.stock}</span>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditForm(product)} className="h-8 w-8 p-0" aria-label={`${product.name} bearbeiten`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(product.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label={`${product.name} löschen`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {inactiveProducts.length > 0 && (
                <Card className="border border-gray-200 dark:border-white/10 shadow-sm p-0 opacity-70">
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-500">
                      <IconBox icon={EyeOff} size="xs" variant="gray" /> Ausgeblendete Produkte
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0">{inactiveProducts.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50 dark:divide-white/[0.02]">
                          {inactiveProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 px-2">
                                <div className="flex items-center gap-3">
                                  <Package className="h-4 w-4 text-gray-300 shrink-0" />
                                  <span className="text-gray-500 line-through">{product.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <Button variant="ghost" size="sm" onClick={() => openEditForm(product)} className="h-7 text-xs">Aktivieren</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Delete confirmation */}
          {deleteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Card className="max-w-md w-full mx-4 shadow-xl border-red-200 dark:border-red-800/50">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                    <Trash2 className="h-5 w-5" /> Produkt löschen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Möchtest du dieses Produkt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                  <div className="flex items-center gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Abbrechen</Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
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
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                  : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
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
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                {filter.label}{filter.count != null ? ` (${filter.count})` : ''}
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
                <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">Keine Bestellungen</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {orderStatusFilter
                    ? `Keine Bestellungen mit Status „${STATUS_LABELS[orderStatusFilter]}“`
                    : 'Sobald Mitglieder Produkte bestellen, erscheinen sie hier'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-gray-200 dark:border-white/10 shadow-sm p-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                  <IconBox icon={ClipboardList} size="xs" variant="light" />
                  {orderStatusFilter ? STATUS_LABELS[orderStatusFilter] : 'Alle'} Bestellungen
                  <Badge className="text-[11px] px-1.5 py-0 bg-brand-light/10 text-brand-light border-brand-light/20 ml-1">
                    {orders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/5">
                        <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Bestellung</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Artikel</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Betrag</th>
                        <th className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Zahlung</th>
                        <th className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/[0.02]">
                      {orders.map((order) => {
                        const StatusIcon = STATUS_ICONS[order.status] || Clock;
                        const nextAction = STATUS_NEXT_ACTION[order.status] || null;
                        return (
                          <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-2">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white text-xs font-mono truncate max-w-[100px]">
                                  {order.id.slice(0, 8)}…
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {order.created_at ? formatDate(order.created_at) : '—'}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-2 hidden md:table-cell">
                              <div className="space-y-0.5 max-w-[200px]">
                                {(order.items ?? []).slice(0, 2).map((item, i) => (
                                  <div key={i} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {item.quantity}× {item.product_name}
                                  </div>
                                ))}
                                {(order.items ?? []).length > 2 && (
                                  <p className="text-[11px] text-gray-400">
                                    +{(order.items ?? []).length - 2} weitere
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">
                              {formatCurrency(order.total_amount)}
                            </td>
                            <td className="py-3 px-2 text-center hidden sm:table-cell">
                              <Badge
                                variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                                className={`text-[11px] px-1.5 py-0 ${
                                  order.payment_status === 'paid'
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                                    : ''
                                }`}
                              >
                                {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Badge className={`text-[11px] px-2 py-0.5 border ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                                <StatusIcon className="h-3 w-3 mr-1 inline" />
                                {STATUS_LABELS[order.status] || order.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right">
                              {nextAction && order.payment_status === 'paid' ? (
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
                              ) : order.status === 'shipped' ? (
                                <span className="text-[11px] text-gray-400 italic">Erledigt</span>
                              ) : order.payment_status !== 'paid' ? (
                                <span className="text-[11px] text-gray-400 italic">Warte auf Zahlung</span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
