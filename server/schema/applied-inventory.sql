-- Export inventaire Postgres (fallback si pg_dump indisponible)
-- generated_at 2026-08-29T18:22:11.240Z

-- Tables / vues
-- [S] comms.call_signals_id_seq
-- [S] comms.thread_members_id_seq
-- [r] comms.call_signals
-- [r] comms.calls
-- [r] comms.devices
-- [r] comms.messages
-- [r] comms.schema_meta
-- [r] comms.thread_members
-- [r] comms.threads
-- [v] comms.v_inbox
-- [S] ops.events_id_seq
-- [r] ops.courier_locations
-- [r] ops.courses
-- [r] ops.deliveries
-- [r] ops.delivery_offers
-- [r] ops.events
-- [r] ops.pick_jobs
-- [r] ops.schema_meta
-- [r] ops.staff
-- [r] ops.staff_sessions
-- [v] ops.v_delivery_board
-- [v] ops.v_pick_board
-- [r] public.banners
-- [r] public.cart_lines
-- [r] public.carts
-- [r] public.categories
-- [r] public.chips
-- [r] public.order_lines
-- [r] public.orders
-- [r] public.payments
-- [r] public.products
-- [r] public.sessions
-- [r] public.stores
-- [r] public.user_state
-- [r] public.users
-- [v] public.v_order_tracking

-- Fonctions
CREATE OR REPLACE FUNCTION comms.ensure_courier_thread(p_order_id text, p_staff_id text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  tid TEXT;
  uid TEXT;
BEGIN
  IF p_order_id IS NULL OR p_staff_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT user_id INTO uid FROM orders WHERE id = p_order_id;
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  tid := 'courier-' || replace(p_order_id, '#', '');
  INSERT INTO comms.threads (id, kind, order_id, title)
  VALUES (tid, 'courier', p_order_id, 'Livreur')
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
  INSERT INTO comms.thread_members (thread_id, actor_kind, user_id)
  SELECT tid, 'customer', uid
  WHERE NOT EXISTS (
    SELECT 1 FROM comms.thread_members m WHERE m.thread_id = tid AND m.user_id = uid
  );
  INSERT INTO comms.thread_members (thread_id, actor_kind, staff_id)
  SELECT tid, 'staff', p_staff_id
  WHERE NOT EXISTS (
    SELECT 1 FROM comms.thread_members m WHERE m.thread_id = tid AND m.staff_id = p_staff_id
  );
  RETURN tid;
END;
$function$
;

CREATE OR REPLACE FUNCTION comms.notify_call()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_notify(
    'comms_call',
    json_build_object('call_id', NEW.id, 'thread_id', NEW.thread_id, 'status', NEW.status)::text
  );
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO comms.messages (
      id, thread_id, sender_kind, sender_user_id, sender_staff_id, kind, body, payload
    ) VALUES (
      'callmsg-' || NEW.id || '-' || NEW.status,
      NEW.thread_id,
      'system',
      NULL,
      NULL,
      'call',
      CASE NEW.status
        WHEN 'initiated' THEN 'Appel en cours'
        WHEN 'ringing' THEN 'Sonnerie'
        WHEN 'accepted' THEN 'Appel accepté'
        WHEN 'rejected' THEN 'Appel refusé'
        WHEN 'canceled' THEN 'Appel annulé'
        WHEN 'missed' THEN 'Appel manqué'
        WHEN 'ended' THEN 'Appel terminé'
        ELSE 'Appel'
      END,
      jsonb_build_object('call_id', NEW.id, 'status', NEW.status, 'media', NEW.media)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION comms.notify_signal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM pg_notify(
    'comms_signal',
    json_build_object('call_id', NEW.call_id, 'signal_id', NEW.id, 'type', NEW.signal_type)::text
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION comms.touch_thread()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE comms.threads SET updated_at = NOW() WHERE id = NEW.thread_id;
  PERFORM pg_notify(
    'comms_message',
    json_build_object('thread_id', NEW.thread_id, 'message_id', NEW.id, 'kind', NEW.kind)::text
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION comms.trg_delivery_thread()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.courier_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR OLD.courier_id IS DISTINCT FROM NEW.courier_id
  ) THEN
    PERFORM comms.ensure_courier_thread(NEW.order_id, NEW.courier_id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_ops_jobs(p_order orders)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  cash INT;
  pick_status TEXT;
  del_status TEXT;
BEGIN
  DELETE FROM public.order_lines ol
  WHERE ol.order_id = p_order.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_order.payload->'lines', '[]'::jsonb)) line
      WHERE COALESCE(line->>'productId', '') = ol.product_id
    );

  INSERT INTO public.order_lines (order_id, position, product_id, name, unit, qty, unit_price)
  SELECT
    p_order.id,
    (ord.ordinality - 1)::INT,
    COALESCE(line->>'productId', ''),
    COALESCE(line->>'name', 'Article'),
    COALESCE(line->>'unit', ''),
    GREATEST(1, COALESCE((line->>'qty')::INT, 1)),
    COALESCE((line->>'unitPrice')::INT, 0)
  FROM jsonb_array_elements(COALESCE(p_order.payload->'lines', '[]'::jsonb)) WITH ORDINALITY AS ord(line, ordinality)
  WHERE COALESCE(line->>'productId', '') <> ''
  ON CONFLICT (order_id, product_id) DO UPDATE SET
    position = EXCLUDED.position,
    name = EXCLUDED.name,
    unit = EXCLUDED.unit,
    qty = EXCLUDED.qty,
    unit_price = EXCLUDED.unit_price;

  cash := CASE
    WHEN COALESCE(p_order.payment_id, '') = 'cod'
      OR COALESCE(p_order.payment_status, '') = 'cod_pending'
    THEN COALESCE(p_order.total, 0)
    ELSE 0
  END;

  IF p_order.status = 'cancelled' THEN
    pick_status := 'cancelled';
    del_status := 'cancelled';
  ELSIF p_order.status = 'delivered' THEN
    pick_status := 'packed';
    del_status := 'delivered';
  ELSIF p_order.status = 'shipping' THEN
    pick_status := 'packed';
    del_status := 'en_route';
  ELSIF p_order.status = 'preparing' THEN
    pick_status := 'picking';
    del_status := 'unassigned';
  ELSE
    pick_status := 'queued';
    del_status := 'unassigned';
  END IF;

  INSERT INTO ops.pick_jobs (id, order_id, store_id, status, created_at, updated_at)
  VALUES ('pick-' || p_order.id, p_order.id, p_order.store_id, pick_status, NOW(), NOW())
  ON CONFLICT (order_id) DO UPDATE SET
    store_id = EXCLUDED.store_id,
    updated_at = NOW(),
    status = CASE
      WHEN ops.pick_jobs.status IN ('packed', 'cancelled') THEN ops.pick_jobs.status
      WHEN EXCLUDED.status = 'cancelled' THEN 'cancelled'
      WHEN p_order.managed_by = 'ops' THEN ops.pick_jobs.status
      ELSE EXCLUDED.status
    END;

  INSERT INTO ops.deliveries (
    id, order_id, store_id, status, cash_to_collect,
    pickup_lng, pickup_lat, dropoff_lng, dropoff_lat,
    route_distance_m, route_duration_s, created_at, updated_at
  ) VALUES (
    'del-' || p_order.id, p_order.id, p_order.store_id, del_status, cash,
    p_order.store_lng, p_order.store_lat, p_order.dropoff_lng, p_order.dropoff_lat,
    p_order.route_distance_m, p_order.route_duration_s, NOW(), NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    store_id = EXCLUDED.store_id,
    cash_to_collect = EXCLUDED.cash_to_collect,
    pickup_lng = EXCLUDED.pickup_lng,
    pickup_lat = EXCLUDED.pickup_lat,
    dropoff_lng = EXCLUDED.dropoff_lng,
    dropoff_lat = EXCLUDED.dropoff_lat,
    route_distance_m = EXCLUDED.route_distance_m,
    route_duration_s = EXCLUDED.route_duration_s,
    updated_at = NOW(),
    status = CASE
      WHEN ops.deliveries.status IN ('delivered', 'failed', 'cancelled') THEN ops.deliveries.status
      WHEN EXCLUDED.status = 'cancelled' THEN 'cancelled'
      WHEN p_order.managed_by = 'ops' THEN ops.deliveries.status
      ELSE EXCLUDED.status
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.map_ops_to_shop_status(pick text, del text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN del IN ('cancelled') OR pick IN ('cancelled') THEN 'cancelled'
    WHEN del IN ('delivered') THEN 'delivered'
    WHEN del IN ('en_route', 'arrived', 'picked_up') THEN 'shipping'
    WHEN pick IN ('picking', 'assigned', 'packed') OR del IN ('assigned', 'at_store') THEN 'preparing'
    ELSE 'confirmed'
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.order_json_num(p jsonb, k text)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p ->> k IS NULL OR btrim(p ->> k) = '' THEN NULL
    ELSE (p ->> k)::DOUBLE PRECISION
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_orders_after()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.ensure_ops_jobs(NEW);
  INSERT INTO ops.events (order_id, actor_kind, event_type, payload)
  VALUES (
    NEW.id,
    'system',
    CASE WHEN TG_OP = 'INSERT' THEN 'order.created' ELSE 'order.updated' END,
    jsonb_build_object('status', NEW.status, 'managed_by', NEW.managed_by)
  );
  PERFORM pg_notify(
    'marche_ops',
    json_build_object('order_id', NEW.id, 'status', NEW.status, 'store_id', NEW.store_id)::text
  );
  PERFORM pg_notify(
    'marche_shop',
    json_build_object('order_id', NEW.id, 'user_id', NEW.user_id, 'status', NEW.status)::text
  );
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_orders_before()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  p JSONB;
BEGIN
  p := COALESCE(NEW.payload, '{}'::jsonb);
  NEW.status := COALESCE(NULLIF(p->>'status', ''), NEW.status, 'confirmed');
  IF NEW.status NOT IN ('confirmed', 'preparing', 'shipping', 'delivered', 'cancelled') THEN
    NEW.status := 'confirmed';
  END IF;
  NEW.store_id := NULLIF(p->>'storeId', '');
  NEW.store_name := NULLIF(p->>'storeName', '');
  NEW.item_count := COALESCE((p->>'itemCount')::INT, NEW.item_count, 0);
  NEW.subtotal := COALESCE((p->>'subtotal')::INT, 0);
  NEW.delivery_fee := COALESCE((p->>'delivery')::INT, 0);
  NEW.discount := COALESCE((p->>'discount')::INT, 0);
  NEW.total := COALESCE((p->>'total')::INT, 0);
  NEW.payment_id := NULLIF(p->>'paymentId', '');
  NEW.payment_label := NULLIF(p->>'paymentLabel', '');
  NEW.payment_status := NULLIF(p->>'paymentStatus', '');
  NEW.payment_ref := NULLIF(p->>'paymentRef', '');
  NEW.day_label := NULLIF(p->>'dayLabel', '');
  NEW.slot_label := NULLIF(p->>'slotLabel', '');
  NEW.address_label := NULLIF(p->>'addressLabel', '');
  NEW.address_line := NULLIF(p->>'addressLine', '');
  NEW.address_city := NULLIF(p->>'addressCity', '');
  NEW.address_phone := NULLIF(p->>'addressPhone', '');
  NEW.comment := COALESCE(p->>'comment', '');
  NEW.dropoff_lng := (p->'addressCoordinate'->>0)::DOUBLE PRECISION;
  NEW.dropoff_lat := (p->'addressCoordinate'->>1)::DOUBLE PRECISION;
  NEW.store_lng := (p->'storeCoordinate'->>0)::DOUBLE PRECISION;
  NEW.store_lat := (p->'storeCoordinate'->>1)::DOUBLE PRECISION;
  NEW.route_distance_m := public.order_json_num(p, 'routeDistanceMeters');
  NEW.route_duration_s := public.order_json_num(p, 'routeDurationSeconds');
  NEW.route_profile := COALESCE(NULLIF(p->>'routeProfile', ''), 'driving');
  NEW.route_geojson := p->'routeCoordinates';
  IF p->>'managedBy' = 'ops' THEN
    NEW.managed_by := 'ops';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;
