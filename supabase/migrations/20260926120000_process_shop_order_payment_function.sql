-- Zahlungsstatus und Lagerbestand einer Shop-Bestellung in einer Transaktion.
-- Vorher setzte der Webhook erst "bezahlt" und zog dann den Bestand einzeln ab:
-- ein Fehler dazwischen hinterließ eine bezahlte Bestellung mit falschem Bestand,
-- und der Retry übersprang sie, weil sie schon bezahlt war.
-- Die Zeilensperre auf der Bestellung serialisiert doppelte Events; der Abzug
-- mit `stock >= quantity` in einem UPDATE serialisiert parallele Käufe.
CREATE OR REPLACE FUNCTION public.process_shop_order_payment(p_order_id uuid, p_paid boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_item jsonb;
  v_short uuid[] := '{}';
BEGIN
  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop-Bestellung % nicht gefunden', p_order_id USING ERRCODE = 'P0002';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid');
  END IF;

  UPDATE shop_orders
     SET status = 'pending',
         payment_status = CASE WHEN p_paid THEN 'paid' ELSE 'pending' END
   WHERE id = p_order_id;

  IF NOT p_paid THEN
    RETURN jsonb_build_object('status', 'pending');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) LOOP
    CONTINUE WHEN v_item->>'product_id' IS NULL OR coalesce((v_item->>'quantity')::int, 0) <= 0;
    UPDATE shop_products
       SET stock = stock - (v_item->>'quantity')::int
     WHERE id = (v_item->>'product_id')::uuid
       AND stock IS NOT NULL
       AND stock >= (v_item->>'quantity')::int;
    IF NOT FOUND AND EXISTS (
      SELECT 1 FROM shop_products
       WHERE id = (v_item->>'product_id')::uuid AND stock IS NOT NULL
    ) THEN
      -- Bezahlt, aber Bestand reicht nicht (überverkauft): nicht abbrechen,
      -- sonst wäre die Zahlung ohne Bestellung. Der Webhook meldet es.
      v_short := v_short || (v_item->>'product_id')::uuid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('status', 'paid', 'short_stock', to_jsonb(v_short));
END;
$$;

REVOKE ALL ON FUNCTION public.process_shop_order_payment(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_shop_order_payment(uuid, boolean) TO service_role;
