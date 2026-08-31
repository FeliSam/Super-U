-- Export inventaire Postgres (fallback si pg_dump indisponible)
-- generated_at 2026-08-30T20:54:34.207Z

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
-- [r] ops.client_incident_actions
-- [r] ops.courier_locations
-- [r] ops.courses
-- [r] ops.deliveries
-- [r] ops.delivery_incidents
-- [r] ops.delivery_offers
-- [r] ops.events
-- [r] ops.order_ratings
-- [r] ops.pick_jobs
-- [r] ops.schema_meta
-- [r] ops.staff
-- [r] ops.staff_documents
-- [r] ops.staff_notifications
-- [r] ops.staff_payouts
-- [r] ops.staff_profiles
-- [r] ops.staff_sessions
-- [r] ops.staff_store_affiliations
-- [v] ops.v_delivery_board
-- [v] ops.v_pick_board
-- [S] public.catalog_audit_id_seq
-- [S] public.catalog_import_rows_id_seq
-- [S] public.catalog_import_runs_id_seq
-- [S] public.catalog_tombstones_revision_seq
-- [S] public.product_media_id_seq
-- [r] public.banners
-- [r] public.cart_lines
-- [r] public.carts
-- [r] public.catalog_audit
-- [r] public.catalog_import_rows
-- [r] public.catalog_import_runs
-- [r] public.catalog_settings
-- [r] public.catalog_tombstones
-- [r] public.categories
-- [r] public.chips
-- [r] public.order_lines
-- [r] public.orders
-- [r] public.payments
-- [r] public.product_media
-- [r] public.product_stock
-- [r] public.products
-- [r] public.sessions
-- [r] public.stock_moves
-- [r] public.stores
-- [r] public.user_notifications
-- [r] public.user_state
-- [r] public.users
-- [v] public.v_order_tracking

-- Fonctions
CREATE OR REPLACE FUNCTION comms.archive_delivered_courier_threads()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  n INTEGER := 0;
BEGIN
  WITH due AS (
    SELECT t.id
    FROM comms.threads t
    JOIN ops.deliveries d ON d.order_id = t.order_id
    JOIN comms.thread_members m_s
      ON m_s.thread_id = t.id AND m_s.actor_kind = 'staff' AND m_s.staff_id = d.courier_id
    JOIN comms.thread_members m_u
      ON m_u.thread_id = t.id AND m_u.actor_kind = 'customer'
    WHERE t.kind = 'courier'
      AND t.archived_at IS NULL
      AND d.status = 'delivered'
      AND d.courier_id IS NOT NULL
      AND COALESCE(d.delivered_at, d.updated_at) <= NOW() - INTERVAL '30 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM ops.deliveries d2
        JOIN orders o2 ON o2.id = d2.order_id
        WHERE d2.courier_id = m_s.staff_id
          AND o2.user_id = m_u.user_id
          AND d2.status NOT IN ('delivered', 'failed', 'cancelled')
      )
  ),
  archived AS (
    UPDATE comms.threads t
    SET archived_at = NOW(),
        disabled_at = COALESCE(t.disabled_at, NOW()),
        updated_at = NOW()
    FROM due
    WHERE t.id = due.id
    RETURNING t.id
  )
  INSERT INTO comms.messages (id, thread_id, sender_kind, kind, body, payload)
  SELECT
    'msg-archive-' || archived.id,
    archived.id,
    'system',
    'system',
    'Conversation archivée 30 minutes après la livraison.',
    '{"reason":"delivered_timeout"}'::jsonb
  FROM archived
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$
;

CREATE OR REPLACE FUNCTION comms.ensure_courier_thread(p_order_id text, p_staff_id text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  tid TEXT;
  uid TEXT;
  prev_order TEXT;
  extra TEXT;
BEGIN
  IF p_order_id IS NULL OR p_staff_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT user_id INTO uid FROM orders WHERE id = p_order_id;
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT t.id, t.order_id INTO tid, prev_order
  FROM comms.threads t
  JOIN comms.thread_members m_u
    ON m_u.thread_id = t.id AND m_u.actor_kind = 'customer' AND m_u.user_id = uid
  JOIN comms.thread_members m_s
    ON m_s.thread_id = t.id AND m_s.actor_kind = 'staff' AND m_s.staff_id = p_staff_id
  WHERE t.kind = 'courier'
  ORDER BY t.created_at ASC
  LIMIT 1;

  IF tid IS NOT NULL THEN
    UPDATE comms.threads SET order_id = NULL
     WHERE kind = 'courier' AND order_id = p_order_id AND id <> tid;
    FOR extra IN
      SELECT t.id
      FROM comms.threads t
      JOIN comms.thread_members m_u
        ON m_u.thread_id = t.id AND m_u.actor_kind = 'customer' AND m_u.user_id = uid
      JOIN comms.thread_members m_s
        ON m_s.thread_id = t.id AND m_s.actor_kind = 'staff' AND m_s.staff_id = p_staff_id
      WHERE t.kind = 'courier' AND t.id <> tid
    LOOP
      UPDATE comms.messages SET thread_id = tid WHERE thread_id = extra;
      DELETE FROM comms.threads WHERE id = extra;
    END LOOP;
    UPDATE comms.threads SET order_id = p_order_id, updated_at = NOW(),
           disabled_at = NULL, disabled_by = NULL, archived_at = NULL
    WHERE id = tid;
    IF prev_order IS DISTINCT FROM p_order_id THEN
      INSERT INTO comms.messages (id, thread_id, sender_kind, kind, body, payload)
      VALUES (
        'msg-join-' || replace(p_order_id, '#', ''),
        tid,
        'system',
        'system',
        'Commande ' || p_order_id || ' ajoutée à cette conversation.',
        jsonb_build_object('orderId', p_order_id)
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
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
  END IF;

  tid := 'courier-' || p_staff_id || '-' || uid;
  UPDATE comms.threads SET order_id = NULL
   WHERE kind = 'courier' AND order_id = p_order_id AND id <> tid;
  INSERT INTO comms.threads (id, kind, order_id, title)
  VALUES (tid, 'courier', p_order_id, 'Livreur')
  ON CONFLICT (id) DO UPDATE SET order_id = EXCLUDED.order_id, updated_at = NOW(),
    disabled_at = NULL, archived_at = NULL;
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

CREATE OR REPLACE FUNCTION comms.ensure_support_thread(p_user_id text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  tid TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  tid := 'support-' || p_user_id;
  INSERT INTO comms.threads (id, kind, title)
  VALUES (tid, 'support', 'Assistance Marché Doré')
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
  INSERT INTO comms.thread_members (thread_id, actor_kind, user_id)
  SELECT tid, 'customer', p_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM comms.thread_members m WHERE m.thread_id = tid AND m.user_id = p_user_id
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
  -- Une pastille par fin d’appel, attribuée à l’APPELANT (pas 'system')
  -- pour que boutique et CourseGO l’alignent à droite / gauche selon qui a composé.
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('rejected', 'canceled', 'missed', 'ended') THEN
    INSERT INTO comms.messages (
      id, thread_id, sender_kind, sender_user_id, sender_staff_id, kind, body, payload
    ) VALUES (
      'callmsg-' || NEW.id || '-' || NEW.status,
      NEW.thread_id,
      NEW.caller_kind,
      NEW.caller_user_id,
      NEW.caller_staff_id,
      'call',
      CASE NEW.status
        WHEN 'rejected' THEN 'Appel refusé'
        WHEN 'canceled' THEN 'Appel annulé'
        WHEN 'missed' THEN 'Appel manqué'
        WHEN 'ended' THEN 'Appel terminé'
        ELSE 'Appel'
      END,
      jsonb_build_object(
        'call_id', NEW.id,
        'status', NEW.status,
        'media', NEW.media,
        'caller_kind', NEW.caller_kind
      )
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

CREATE OR REPLACE FUNCTION comms.thread_for_order(p_order_id text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT t.id
  FROM orders o
  LEFT JOIN ops.deliveries d ON d.order_id = o.id
  JOIN comms.threads t ON t.kind = 'courier' AND t.archived_at IS NULL
    AND (t.disabled_at IS NULL OR t.disabled_by IS NULL)
  JOIN comms.thread_members m_u ON m_u.thread_id = t.id AND m_u.user_id = o.user_id AND m_u.actor_kind = 'customer'
  LEFT JOIN comms.thread_members m_s ON m_s.thread_id = t.id AND m_s.staff_id = d.courier_id AND m_s.actor_kind = 'staff'
  WHERE o.id = p_order_id
    AND (d.courier_id IS NULL OR m_s.staff_id IS NOT NULL)
  ORDER BY CASE WHEN m_s.staff_id IS NOT NULL THEN 0 ELSE 1 END, t.created_at ASC
  LIMIT 1
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

CREATE OR REPLACE FUNCTION public.catalog_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
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
    -- Acceptée / rassemblée côté app course, pas encore en trajet client
    WHEN pick IN ('picking', 'assigned', 'packed') OR del IN ('assigned', 'at_store') THEN 'preparing'
    -- confirmed = en attente de l’app course
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
  IF COALESCE(NEW.item_count, 0) = 0 THEN
    SELECT COALESCE(SUM(COALESCE((elem->>'qty')::INT, 0)), 0)
      INTO NEW.item_count
    FROM jsonb_array_elements(COALESCE(p->'lines', '[]'::jsonb)) elem;
  END IF;
  IF COALESCE(NEW.total, 0) = 0 THEN
    SELECT COALESCE(SUM(
      COALESCE((elem->>'qty')::INT, 0) * COALESCE((elem->>'unitPrice')::INT, (elem->>'unit_price')::INT, 0)
    ), 0)
      INTO NEW.total
    FROM jsonb_array_elements(COALESCE(p->'lines', '[]'::jsonb)) elem;
    IF NEW.total = 0 THEN
      NEW.total := GREATEST(0, COALESCE(NEW.subtotal, 0) + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount, 0));
    END IF;
  END IF;
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
  IF NEW.handoff_code IS NULL OR btrim(NEW.handoff_code) = '' THEN
    NEW.handoff_code := COALESCE(
      NULLIF(btrim(p->>'handoffCode'), ''),
      lpad((1000 + floor(random() * 9000)::int)::text, 4, '0')
    );
  END IF;
  NEW.payload := COALESCE(NEW.payload, '{}'::jsonb) || jsonb_build_object('handoffCode', NEW.handoff_code);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$
;
