'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, Package, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  stock: number;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    fetch('/api/shop')
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...new Set(products.map((p) => p.category))];
  const filtered = products.filter((p) => category === 'all' || p.category === category);
  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) }
            : i
        );
      }
      return [
        ...prev,
        { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.price },
      ];
    });
    toast.success(`${product.name} zum Warenkorb hinzugefügt`);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing && existing.quantity <= 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i));
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setOrdering(true);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (!res.ok) throw new Error('Bestellung fehlgeschlagen');
      toast.success('Bestellung erfolgreich!');
      setCart([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Vereins-Shop</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trikots, Bälle & mehr</p>
        </div>
        {cartCount > 0 && (
          <Button onClick={placeOrder} disabled={ordering} className="gap-2">
            {ordering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Bestellen (€{cartTotal.toFixed(2)})
          </Button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <Button
            key={c}
            variant={category === c ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? 'Alle' : c}
          </Button>
        ))}
      </div>

      {/* Cart summary */}
      {cartCount > 0 && (
        <Card className="border-brand-light/30 bg-brand-light/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-light" />
              <span className="font-medium">{cartCount} Artikel</span>
              <span className="text-muted-foreground">· €{cartTotal.toFixed(2)}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCart([])}>
              Leeren
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.productId === p.id);
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                    <Package className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm line-clamp-2">{p.name}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {p.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.stock > 0 ? `${p.stock} auf Lager` : 'Ausverkauft'}
                    </p>
                    <p className="text-lg font-bold text-brand-light mt-1">€{p.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {inCart ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => removeFromCart(p.id)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-6 text-center">
                          {inCart.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart(p)}
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
                        onClick={() => addToCart(p)}
                        disabled={p.stock <= 0}
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

      {!loading && products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Produkte verfügbar
          </CardContent>
        </Card>
      )}
    </div>
  );
}
