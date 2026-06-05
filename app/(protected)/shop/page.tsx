'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Loader2, ShoppingCart, Package, Plus, Minus, X, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { CartProvider, useCart } from '@/lib/shop/cart-context';
import { apiFetch } from '@/lib/api-fetch';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  stock: number;
}

function ShopContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const { items, addItem, removeItem, updateQuantity, clearCart, cartTotal, cartCount } = useCart();

  useEffect(() => {
    apiFetch('/api/shop')
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => toast.error('Produkte konnten nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  // Handle payment cancelled via URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'cancelled') {
      toast.error('Zahlung abgebrochen. Deine Artikel sind noch im Warenkorb.');
      // Clean URL
      window.history.replaceState({}, '', '/shop');
    }
  }, []);

  const categories = ['all', ...new Set(products.map((p) => p.category))];
  const filtered = category === 'all' ? products : products.filter((p) => p.category === category);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await apiFetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Checkout fehlgeschlagen');
      }

      if (data.url) {
        // Clear cart and redirect to Stripe
        clearCart();
        window.location.href = data.url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Vereins-Shop</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trikots, Bälle & mehr</p>
        </div>
        <Button
          onClick={() => setCartOpen(true)}
          variant="outline"
          size="sm"
          className="relative gap-2 border-brand-light/30 hover:bg-brand-light/5"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Warenkorb</span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white shadow-sm">
              {cartCount}
            </span>
          )}
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <Button
            key={c}
            variant={category === c ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(c)}
            className={category === c ? 'bg-brand-primary hover:bg-brand-primary/90' : ''}
          >
            {c === 'all' ? 'Alle' : c}
          </Button>
        ))}
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Keine Produkte in dieser Kategorie verfügbar
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const inCart = items.find((i) => i.productId === p.id);
                const isOutOfStock = p.stock <= 0;
                return (
                  <Card
                    key={p.id}
                    className={`group hover:shadow-md transition-all duration-200 ${
                      isOutOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Product image */}
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden relative">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-gray-400" />
                        )}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Badge variant="error" className="text-xs font-semibold">
                              Ausverkauft
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {p.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.stock > 0 ? (
                            <span
                              className={
                                p.stock <= 2
                                  ? 'text-orange-600 font-medium'
                                  : p.stock <= 5
                                    ? 'text-amber-600'
                                    : ''
                              }
                            >
                              {p.stock} auf Lager
                            </span>
                          ) : (
                            'Nicht verfügbar'
                          )}
                        </p>
                        <p className="text-lg font-bold text-brand-light mt-1">
                          €{p.price.toFixed(2)}
                        </p>
                      </div>

                      {/* Add to cart */}
                      <div className="flex items-center gap-1">
                        {inCart ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => removeItem(p.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-semibold w-7 text-center tabular-nums">
                              {inCart.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => addItem(p)}
                              disabled={inCart.quantity >= p.stock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => addItem(p)}
                            disabled={isOutOfStock}
                          >
                            In den Warenkorb
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Cart slide-over backdrop */}
      {cartOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Warenkorb schließen"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm cursor-pointer"
          onClick={() => setCartOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setCartOpen(false);
          }}
        />
      )}

      {/* Cart slide-over panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          cartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Cart header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-light" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Warenkorb</h2>
              {cartCount > 0 && (
                <Badge className="bg-brand-light/10 text-brand-light text-xs">{cartCount}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCartOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <ShoppingCart className="h-12 w-12 text-gray-300" />
                <p className="text-sm text-muted-foreground font-medium">Dein Warenkorb ist leer</p>
                <Button variant="outline" size="sm" onClick={() => setCartOpen(false)}>
                  Weiter einkaufen
                </Button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 relative">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        className="object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      €{item.unitPrice.toFixed(2)} / Stk.
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-semibold w-6 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-brand-light">
                      €{(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 mt-1 text-muted-foreground hover:text-red-500"
                      onClick={() => updateQuantity(item.productId, 0)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart footer */}
          {items.length > 0 && (
            <div className="border-t px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Zwischensumme</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  €{cartTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Versand & Zahlung im nächsten Schritt</p>
              <Button
                onClick={handleCheckout}
                disabled={checkingOut || cartCount === 0}
                className="w-full gap-2 bg-brand-primary hover:bg-brand-primary/90"
              >
                {checkingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {checkingOut ? 'Wird vorbereitet…' : `Zur Kasse · €${cartTotal.toFixed(2)}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={clearCart}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Warenkorb leeren
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <CartProvider>
      <ShopContent />
    </CartProvider>
  );
}
