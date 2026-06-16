/**
 * POST /api/shop/checkout
 *
 * Creates a shop_order (status: pending_payment) and a Stripe Checkout Session.
 * Stock is only reduced when the webhook confirms payment.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:shop:checkout');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { items }: { items: { productId: string; quantity: number }[] } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Mindestens ein Artikel erforderlich' }, { status: 400 });
      }

      const supabase = auth.supabase;

      // Fetch products and validate stock
      const { data: products, error: productsError } = await supabase
        .from('shop_products')
        .select('id, name, price, stock, image_url, club_id')
        .in(
          'id',
          items.map((i) => i.productId)
        )
        .eq('is_active', true);

      if (productsError || !products || products.length !== items.length) {
        return NextResponse.json(
          { error: 'Einige Produkte sind nicht verfügbar' },
          { status: 400 }
        );
      }

      // Validate stock and calculate total
      let totalAmount = 0;
      const orderItems: {
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        total: number;
      }[] = [];

      const lineItems: {
        price_data: {
          currency: string;
          unit_amount: number;
          product_data: { name: string; images?: string[] };
        };
        quantity: number;
      }[] = [];

      for (const item of items) {
        const product = products.find((p: any) => p.id === item.productId);
        if (!product) {
          return NextResponse.json(
            { error: `Produkt ${item.productId} nicht gefunden` },
            { status: 400 }
          );
        }
        if ((product.stock ?? 0) < item.quantity) {
          return NextResponse.json(
            { error: `Nicht genug Bestand für „${product.name}“ (verfügbar: ${product.stock})` },
            { status: 400 }
          );
        }
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          total: itemTotal,
        });

        lineItems.push({
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(product.price * 100),
            product_data: {
              name: product.name,
              ...(product.image_url ? { images: [product.image_url] } : {}),
            },
          },
          quantity: item.quantity,
        });
      }

      // Check Stripe availability BEFORE creating the order
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json(
          {
            error:
              'Zahlungsdienstleister ist nicht konfiguriert. Bitte wende dich an den Administrator.',
          },
          { status: 503 }
        );
      }

      // Build URLs (use a placeholder order ID for now; we'll create the real order next)
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : _request.nextUrl.origin);

      // Create pending order
      const { data: order, error: orderError } = await supabase
        .from('shop_orders')
        .insert({
          user_id: auth.user.id,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: 'unpaid',
          items: orderItems,
        })
        .select('id')
        .single();

      if (orderError || !order) {
        log.error('[Shop Checkout] Order creation failed:', orderError);
        return NextResponse.json(
          { error: 'Fehler beim Erstellen der Bestellung' },
          { status: 500 }
        );
      }

      const successUrl = `${baseUrl}/shop/success?orderId=${order.id}`;
      const cancelUrl = `${baseUrl}/shop?payment=cancelled&orderId=${order.id}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: auth.user.email || undefined,
        metadata: {
          orderId: order.id,
          orderType: 'shop',
          userId: auth.user.id,
        },
      });

      return NextResponse.json({ url: session.url, orderId: order.id });
    } catch (error) {
      log.error('[Shop Checkout] Error:', error);
      const message =
        error instanceof Error ? error.message : 'Fehler beim Erstellen der Checkout-Session';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
