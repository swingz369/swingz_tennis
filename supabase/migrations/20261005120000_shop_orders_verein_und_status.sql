-- shop_orders: Bestellung gehört einem Verein, Status setzt nicht der Käufer (05.10.2026)
--
-- 1. "Users can create orders" prüfte nur user_id = auth.uid(). Ein Mitglied konnte
--    per PostgREST eine Bestellung mit status/payment_status 'paid' und beliebigem
--    Betrag anlegen — sie erschien beim Vereinsadmin als bezahlt und zählte im Umsatz.
-- 2. Lesen/Ändern hing an is_admin_of_user(user_id): Die Tabelle kannte keinen Verein,
--    also durfte der Admin von Verein A die Bestellungen eines Mitglieds bei Verein B
--    lesen und ändern (auch payment_status). Die Admin-Route filterte nur clientseitig
--    über items.
--
-- Fix: club_id an die Bestellung (Checkout kennt ihn, ein Warenkorb = ein Verein),
-- Policies darauf. payment_status schreibt nur noch process_shop_order_payment
-- (service_role); der Admin ändert nur den Bearbeitungsstatus.

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Bestand: Verein aus dem ersten Artikel. Nicht auflösbare Altzeilen bleiben NULL —
-- sie sieht dann nur noch der Käufer (und der Owner); neue Zeilen erzwingt die Policy.
UPDATE public.shop_orders o
   SET club_id = p.club_id
  FROM public.shop_products p
 WHERE o.club_id IS NULL
   AND p.id = (o.items->0->>'product_id')::uuid;

CREATE INDEX IF NOT EXISTS idx_shop_orders_club ON public.shop_orders (club_id, created_at DESC);

DROP POLICY IF EXISTS "Users can create orders" ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_select_own_or_admin ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_update_club_admin ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_insert_own ON public.shop_orders;

CREATE POLICY shop_orders_insert_own ON public.shop_orders FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_club_member(club_id)
    AND status = 'pending'
    AND payment_status = 'unpaid'
  );
CREATE POLICY shop_orders_select_own_or_admin ON public.shop_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner() OR public.is_club_admin(club_id));
CREATE POLICY shop_orders_update_club_admin ON public.shop_orders FOR UPDATE TO authenticated
  USING (public.is_club_admin(club_id))
  WITH CHECK (public.is_club_admin(club_id));

REVOKE ALL ON public.shop_orders FROM anon;
REVOKE UPDATE ON public.shop_orders FROM authenticated;
GRANT UPDATE (status) ON public.shop_orders TO authenticated;
