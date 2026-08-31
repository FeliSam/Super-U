CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  birth_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS chips (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  promo_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_lines (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty > 0),
  unit_override TEXT,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT,
  amount INT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_id_idx ON payments (provider_id);


-- Marché Doré — schéma ops (2e app : picking magasin + courses / livraison)
-- Les commandes client restent dans public.orders (payload JSON pour l’app boutique).
-- Chaque INSERT/UPDATE de payload crée/maj les jobs ops.

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO ops.schema_meta (key, value) VALUES ('version', '6')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- —— Enrichissement commandes boutique (indexables par l’app livreur) ——

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS managed_by TEXT NOT NULL DEFAULT 'shop';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS item_count INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS slot_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_label TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropoff_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_distance_m DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_duration_s DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_profile TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_geojson JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handoff_code TEXT;
UPDATE orders
SET handoff_code = lpad((1000 + floor(random() * 9000)::int)::text, 4, '0')
WHERE handoff_code IS NULL OR btrim(handoff_code) = '';
UPDATE orders
SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('handoffCode', handoff_code)
WHERE handoff_code IS NOT NULL
  AND (payload->>'handoffCode' IS NULL OR btrim(payload->>'handoffCode') = '');

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_chk
    CHECK (status IN ('confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_managed_by_chk
    CHECK (managed_by IN ('shop', 'ops'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_id_idx ON orders (store_id);
CREATE INDEX IF NOT EXISTS orders_managed_by_idx ON orders (managed_by);

CREATE TABLE IF NOT EXISTS public.order_lines (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  qty INT NOT NULL CHECK (qty > 0),
  unit_price INT NOT NULL DEFAULT 0,
  picked_qty INT NOT NULL DEFAULT 0 CHECK (picked_qty >= 0),
  unavailable BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS order_lines_product_idx ON public.order_lines (product_id);

-- —— Personnel 2e application ——

-- Un coursier peut rassembler ET livrer : picker_id et courier_id
-- d’une même commande peuvent pointer vers le même ops.staff.id.
CREATE TABLE IF NOT EXISTS ops.staff (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'coursier'
    CHECK (role IN ('picker', 'courier', 'coursier', 'dispatcher', 'both')),
  can_pick BOOLEAN NOT NULL DEFAULT TRUE,
  can_deliver BOOLEAN NOT NULL DEFAULT TRUE,
  store_id TEXT,
  vehicle TEXT CHECK (vehicle IS NULL OR vehicle IN ('moto', 'voiture', 'velo', 'pied')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_can_act_chk CHECK (can_pick OR can_deliver)
);

CREATE TABLE IF NOT EXISTS ops.staff_sessions (
  token TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_staff_sessions_staff_idx ON ops.staff_sessions (staff_id);
CREATE INDEX IF NOT EXISTS ops_staff_store_idx ON ops.staff (store_id, role) WHERE is_active;

-- Bases déjà créées sans flags : un livreur = aussi coursier (pick + livraison).
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS can_pick BOOLEAN;
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS can_deliver BOOLEAN;
UPDATE ops.staff SET can_pick = TRUE WHERE can_pick IS NULL;
UPDATE ops.staff SET can_deliver = TRUE WHERE can_deliver IS NULL;
ALTER TABLE ops.staff ALTER COLUMN can_pick SET DEFAULT TRUE;
ALTER TABLE ops.staff ALTER COLUMN can_deliver SET DEFAULT TRUE;
ALTER TABLE ops.staff ALTER COLUMN can_pick SET NOT NULL;
ALTER TABLE ops.staff ALTER COLUMN can_deliver SET NOT NULL;
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS photo_data TEXT;
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'ops.staff'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE ops.staff DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE ops.staff DROP CONSTRAINT IF EXISTS staff_can_act_chk;
  ALTER TABLE ops.staff DROP CONSTRAINT IF EXISTS staff_role_check;
  ALTER TABLE ops.staff ADD CONSTRAINT staff_role_check
    CHECK (role IN (
      'picker', 'courier', 'coursier', 'dispatcher', 'both',
      'admin', 'manager', 'magasinier', 'recruteur', 'support'
    ));
  ALTER TABLE ops.staff ADD CONSTRAINT staff_can_act_chk
    CHECK (
      can_pick OR can_deliver
      OR role IN ('admin', 'manager', 'magasinier', 'recruteur', 'dispatcher', 'support')
    );
END $$;
UPDATE ops.staff
SET role = 'coursier'
WHERE can_pick AND can_deliver AND role IN ('picker', 'courier', 'both');

-- —— Rassemblement magasin (picking) ——

-- Un même ops.staff.id peut être picker_id ET courier_id (coursier solo).
CREATE TABLE IF NOT EXISTS ops.pick_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  store_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'assigned', 'picking', 'packed', 'cancelled')),
  picker_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_pick_jobs_board_idx ON ops.pick_jobs (status, store_id, created_at);

-- —— Course (tournée livreur) + livraison unitaire ——

CREATE TABLE IF NOT EXISTS ops.courses (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE RESTRICT,
  store_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_courses_courier_idx ON ops.courses (courier_id, status);

CREATE TABLE IF NOT EXISTS ops.deliveries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES ops.courses(id) ON DELETE SET NULL,
  store_id TEXT,
  status TEXT NOT NULL DEFAULT 'unassigned'
    CHECK (status IN (
      'unassigned', 'offered', 'assigned', 'at_store', 'picked_up',
      'en_route', 'arrived', 'delivered', 'failed', 'cancelled'
    )),
  courier_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  cash_to_collect INT NOT NULL DEFAULT 0,
  pickup_lng DOUBLE PRECISION,
  pickup_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  route_distance_m DOUBLE PRECISION,
  route_duration_s DOUBLE PRECISION,
  assigned_at TIMESTAMPTZ,
  at_store_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  failed_reason_code TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_deliveries_board_idx ON ops.deliveries (status, store_id, created_at);
CREATE INDEX IF NOT EXISTS ops_deliveries_courier_idx ON ops.deliveries (courier_id, status);
ALTER TABLE ops.deliveries ADD COLUMN IF NOT EXISTS failed_reason_code TEXT;
ALTER TABLE ops.deliveries ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ops.delivery_offers (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES ops.deliveries(id) ON DELETE CASCADE,
  courier_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delivery_id, courier_id)
);

CREATE TABLE IF NOT EXISTS ops.courier_locations (
  courier_id TEXT PRIMARY KEY REFERENCES ops.staff(id) ON DELETE CASCADE,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.events (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  pick_job_id TEXT REFERENCES ops.pick_jobs(id) ON DELETE SET NULL,
  delivery_id TEXT REFERENCES ops.deliveries(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'staff', 'system')),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_events_order_idx ON ops.events (order_id, created_at DESC);

-- —— Extraction payload → colonnes + jobs ops ——

CREATE OR REPLACE FUNCTION public.order_json_num(p JSONB, k TEXT)
RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p ->> k IS NULL OR btrim(p ->> k) = '' THEN NULL
    ELSE (p ->> k)::DOUBLE PRECISION
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_before()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.ensure_ops_jobs(p_order orders)
RETURNS void
LANGUAGE plpgsql AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.trg_orders_after()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
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
$fn$;

DROP TRIGGER IF EXISTS orders_before_sync ON orders;
CREATE TRIGGER orders_before_sync
  BEFORE INSERT OR UPDATE OF payload ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_before();

DROP TRIGGER IF EXISTS orders_after_sync ON orders;
CREATE TRIGGER orders_after_sync
  AFTER INSERT OR UPDATE OF payload ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_after();

CREATE OR REPLACE FUNCTION public.map_ops_to_shop_status(pick TEXT, del TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN del IN ('cancelled') OR pick IN ('cancelled') THEN 'cancelled'
    WHEN del IN ('delivered') THEN 'delivered'
    WHEN del IN ('en_route', 'arrived', 'picked_up') THEN 'shipping'
    -- Acceptée / rassemblée côté app course, pas encore en trajet client
    WHEN pick IN ('picking', 'assigned', 'packed') OR del IN ('assigned', 'at_store') THEN 'preparing'
    -- confirmed = en attente de l’app course
    ELSE 'confirmed'
  END;
$$;

-- Vues partagées (les deux apps lisent la même vérité)
-- v_pick_board : file ramassage (queued/assigned/picking). packed → handoff deliveries.
-- v_delivery_board : livraisons actives. CourseGO ne claim que si pick_status = packed.
-- v_order_tracking : boutique /me/orders/:id/live
DROP VIEW IF EXISTS public.v_order_tracking;
DROP VIEW IF EXISTS ops.v_delivery_board;
DROP VIEW IF EXISTS ops.v_pick_board;

CREATE OR REPLACE VIEW ops.v_pick_board
WITH (security_invoker = true) AS
SELECT
  j.id,
  j.order_id,
  j.store_id,
  j.status AS pick_status,
  j.picker_id,
  o.status AS shop_status,
  o.item_count,
  o.total,
  o.slot_label,
  o.day_label,
  o.address_label,
  o.store_name,
  o.created_at
FROM ops.pick_jobs j
JOIN orders o ON o.id = j.order_id
WHERE j.status IN ('queued', 'assigned', 'picking');

CREATE OR REPLACE VIEW ops.v_delivery_board
WITH (security_invoker = true) AS
SELECT
  d.id,
  d.order_id,
  d.course_id,
  d.store_id,
  d.status AS delivery_status,
  d.courier_id,
  d.cash_to_collect,
  d.pickup_lng,
  d.pickup_lat,
  d.dropoff_lng,
  d.dropoff_lat,
  d.route_distance_m,
  d.route_duration_s,
  d.picked_up_at,
  d.en_route_at,
  o.status AS shop_status,
  o.address_label,
  o.address_line,
  o.address_city,
  o.address_phone,
  o.store_name,
  o.slot_label,
  o.day_label,
  o.total,
  o.item_count,
  o.payment_id,
  o.comment,
  u.first_name AS customer_first,
  u.last_name AS customer_last,
  o.created_at,
  pj.status AS pick_status,
  pj.picker_id,
  pj.packed_at,
  (pj.picker_id IS NOT NULL AND d.courier_id IS NOT NULL AND pj.picker_id = d.courier_id) AS same_handler
FROM ops.deliveries d
JOIN orders o ON o.id = d.order_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN ops.pick_jobs pj ON pj.order_id = d.order_id
WHERE d.status NOT IN ('delivered', 'failed', 'cancelled');

CREATE OR REPLACE VIEW public.v_order_tracking
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.user_id,
  o.status,
  o.managed_by,
  o.store_id,
  o.store_name,
  o.total,
  o.item_count,
  o.address_label,
  o.address_line,
  o.address_phone,
  o.dropoff_lng,
  o.dropoff_lat,
  o.store_lng,
  o.store_lat,
  o.route_distance_m,
  o.route_duration_s,
  d.status AS delivery_status,
  d.courier_id,
  s.first_name AS courier_first_name,
  s.last_name AS courier_last_name,
  s.phone AS courier_phone,
  (s.photo_data IS NOT NULL AND length(s.photo_data) > 20) AS courier_has_photo,
  loc.lng AS courier_lng,
  loc.lat AS courier_lat,
  loc.updated_at AS courier_located_at,
  pj.status AS pick_status,
  pj.picker_id,
  pk.first_name AS picker_first_name,
  pk.last_name AS picker_last_name,
  pj.packed_at,
  (pj.picker_id IS NOT NULL AND d.courier_id IS NOT NULL AND pj.picker_id = d.courier_id) AS same_handler,
  d.failed_reason,
  d.failed_reason_code,
  s.vehicle AS courier_vehicle,
  d.picked_up_at,
  d.en_route_at,
  o.created_at,
  o.updated_at
FROM orders o
LEFT JOIN ops.deliveries d ON d.order_id = o.id
LEFT JOIN ops.staff s ON s.id = d.courier_id
LEFT JOIN ops.courier_locations loc ON loc.courier_id = d.courier_id
LEFT JOIN ops.pick_jobs pj ON pj.order_id = o.id
LEFT JOIN ops.staff pk ON pk.id = pj.picker_id;

-- Rôles applicatifs (connexion dédiée par interface)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marche_shop') THEN
    CREATE ROLE marche_shop LOGIN PASSWORD 'marche_shop_local';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marche_ops') THEN
    CREATE ROLE marche_ops LOGIN PASSWORD 'marche_ops_local';
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO marche_shop, marche_ops', current_database());
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
DO $$ BEGIN
  GRANT USAGE ON SCHEMA public TO marche_shop, marche_ops;
  GRANT USAGE ON SCHEMA ops TO marche_ops, marche_shop;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO marche_shop;
  GRANT SELECT ON ALL TABLES IN SCHEMA ops TO marche_shop;
  GRANT SELECT, INSERT, UPDATE ON ops.events TO marche_shop;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO marche_shop;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ops TO marche_shop;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ops TO marche_ops;
  GRANT SELECT, UPDATE ON public.orders TO marche_ops;
  GRANT SELECT, UPDATE ON public.order_lines TO marche_ops;
  GRANT SELECT ON public.users TO marche_ops;
  GRANT SELECT ON public.stores, public.products, public.categories TO marche_ops;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ops TO marche_ops;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marche_shop;
  ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marche_ops;
  ALTER DEFAULT PRIVILEGES IN SCHEMA ops GRANT SELECT ON TABLES TO marche_shop;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Gains staff : ramassage + livraison (la course quitte le board une fois clôturée)
CREATE TABLE IF NOT EXISTS ops.staff_payouts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pick', 'deliver', 'tip')),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ref_id TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, ref_id)
);

CREATE INDEX IF NOT EXISTS ops_payouts_staff_idx ON ops.staff_payouts (staff_id, created_at DESC);

INSERT INTO ops.staff_payouts (id, staff_id, kind, order_id, ref_id, amount, created_at)
SELECT
  'pay-pick-' || j.id,
  j.picker_id,
  'pick',
  j.order_id,
  j.id,
  500,
  COALESCE(j.packed_at, j.updated_at)
FROM ops.pick_jobs j
WHERE j.status = 'packed' AND j.picker_id IS NOT NULL
ON CONFLICT (kind, ref_id) DO NOTHING;

INSERT INTO ops.staff_payouts (id, staff_id, kind, order_id, ref_id, amount, created_at)
SELECT
  'pay-del-' || d.id,
  d.courier_id,
  'deliver',
  d.order_id,
  d.id,
  GREATEST(COALESCE(o.delivery_fee, 0), 1500),
  COALESCE(d.delivered_at, d.updated_at)
FROM ops.deliveries d
JOIN orders o ON o.id = d.order_id
WHERE d.status = 'delivered' AND d.courier_id IS NOT NULL
ON CONFLICT (kind, ref_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ops.order_ratings (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rater_kind TEXT NOT NULL CHECK (rater_kind IN ('customer', 'staff')),
  rater_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rater_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, rater_kind)
);

ALTER TABLE ops.order_ratings ADD COLUMN IF NOT EXISTS tip_amount INT NOT NULL DEFAULT 0;
ALTER TABLE ops.order_ratings DROP CONSTRAINT IF EXISTS order_ratings_tip_amount_check;
ALTER TABLE ops.order_ratings ADD CONSTRAINT order_ratings_tip_amount_check CHECK (tip_amount >= 0);

DO $$
DECLARE
  con TEXT;
BEGIN
  SELECT c.conname INTO con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'ops' AND t.relname = 'staff_payouts' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%pick%'
    AND pg_get_constraintdef(c.oid) NOT ILIKE '%tip%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ops.staff_payouts DROP CONSTRAINT %I', con);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'ops' AND t.relname = 'staff_payouts' AND c.conname = 'staff_payouts_kind_check'
  ) THEN
    ALTER TABLE ops.staff_payouts
      ADD CONSTRAINT staff_payouts_kind_check CHECK (kind IN ('pick', 'deliver', 'tip'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ops.staff_notifications (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT,
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_staff_notif_idx
  ON ops.staff_notifications (staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'order',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT '',
  href TEXT,
  order_id TEXT,
  icon TEXT NOT NULL DEFAULT 'bell',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_notif_idx
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE ops.deliveries ADD COLUMN IF NOT EXISTS failed_reason_code TEXT;

CREATE TABLE IF NOT EXISTS ops.delivery_incidents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL REFERENCES ops.deliveries(id) ON DELETE CASCADE,
  staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  reason_code TEXT NOT NULL DEFAULT 'other',
  reason_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_incidents_order_idx ON ops.delivery_incidents (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_incidents_created_idx ON ops.delivery_incidents (created_at DESC);

CREATE TABLE IF NOT EXISTS ops.client_incident_actions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_id TEXT REFERENCES ops.delivery_incidents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_client_actions_created_idx
  ON ops.client_incident_actions (created_at DESC);

DO $$ BEGIN
  GRANT SELECT ON ops.delivery_incidents TO marche_shop;
  GRANT SELECT, INSERT, UPDATE ON ops.delivery_incidents TO marche_ops;
  GRANT SELECT, INSERT, UPDATE ON ops.client_incident_actions TO marche_shop, marche_ops;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO marche_shop;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
DECLARE
  con TEXT;
BEGIN
  SELECT c.conname INTO con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'ops' AND t.relname = 'staff' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%vehicle%'
    AND pg_get_constraintdef(c.oid) NOT ILIKE '%tricycle%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ops.staff DROP CONSTRAINT %I', con);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'ops' AND t.relname = 'staff' AND c.conname = 'staff_vehicle_kind_check'
  ) THEN
    ALTER TABLE ops.staff
      ADD CONSTRAINT staff_vehicle_kind_check
      CHECK (vehicle IS NULL OR vehicle IN ('moto', 'voiture', 'velo', 'tricycle', 'pied'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ops.staff_store_affiliations (
  staff_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, store_id)
);

CREATE TABLE IF NOT EXISTS ops.staff_profiles (
  staff_id TEXT PRIMARY KEY REFERENCES ops.staff(id) ON DELETE CASCADE,
  vehicle_kind TEXT,
  vehicle_plate TEXT NOT NULL DEFAULT '',
  owns_vehicle BOOLEAN NOT NULL DEFAULT FALSE,
  needs_kit BOOLEAN NOT NULL DEFAULT FALSE,
  vehicle_photo TEXT,
  id_number TEXT NOT NULL DEFAULT '',
  id_photo TEXT,
  license_number TEXT NOT NULL DEFAULT '',
  has_license BOOLEAN NOT NULL DEFAULT FALSE,
  license_photo TEXT,
  selfie_license_photo TEXT,
  residence_line TEXT NOT NULL DEFAULT '',
  residence_city TEXT NOT NULL DEFAULT '',
  insurance_ref TEXT NOT NULL DEFAULT '',
  has_insurance BOOLEAN NOT NULL DEFAULT FALSE,
  insurance_photo TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rejouer les commandes déjà en base
SELECT public.ensure_ops_jobs(o) FROM orders o;


-- Messagerie + appels in-app (client Marché Doré ↔ coursier / support)
-- Le chat n’était que dans user_state JSON. Ce schéma est la source de vérité partagée.

CREATE SCHEMA IF NOT EXISTS comms;

CREATE TABLE IF NOT EXISTS comms.schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO comms.schema_meta (key, value) VALUES ('version', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE TABLE IF NOT EXISTS comms.threads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('support', 'courier', 'order')),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS comms_threads_courier_order_uidx;
DROP INDEX IF EXISTS comms.comms_threads_courier_order_uidx;

ALTER TABLE comms.threads ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE comms.threads ADD COLUMN IF NOT EXISTS disabled_by TEXT
  CHECK (disabled_by IS NULL OR disabled_by IN ('customer', 'staff'));
ALTER TABLE comms.threads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS comms_threads_kind_idx ON comms.threads (kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS comms.thread_members (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comms.threads(id) ON DELETE CASCADE,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'staff', 'system')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  staff_id TEXT REFERENCES ops.staff(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comms_member_actor_chk CHECK (
    (actor_kind = 'customer' AND user_id IS NOT NULL AND staff_id IS NULL)
    OR (actor_kind = 'staff' AND staff_id IS NOT NULL AND user_id IS NULL)
    OR (actor_kind = 'system' AND user_id IS NULL AND staff_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS comms_members_user_uidx
  ON comms.thread_members (thread_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comms_members_staff_uidx
  ON comms.thread_members (thread_id, staff_id) WHERE staff_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS comms.messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comms.threads(id) ON DELETE CASCADE,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('customer', 'staff', 'system')),
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'image', 'system', 'call')),
  body TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comms_messages_thread_idx ON comms.messages (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comms.calls (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comms.threads(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  caller_kind TEXT NOT NULL CHECK (caller_kind IN ('customer', 'staff')),
  caller_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  caller_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  callee_kind TEXT NOT NULL CHECK (callee_kind IN ('customer', 'staff')),
  callee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  callee_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  media TEXT NOT NULL DEFAULT 'audio' CHECK (media IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN (
      'initiated', 'ringing', 'accepted', 'rejected', 'canceled', 'missed', 'ended', 'failed'
    )),
  end_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ringing_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  CONSTRAINT comms_call_caller_chk CHECK (
    (caller_kind = 'customer' AND caller_user_id IS NOT NULL)
    OR (caller_kind = 'staff' AND caller_staff_id IS NOT NULL)
  ),
  CONSTRAINT comms_call_callee_chk CHECK (
    (callee_kind = 'customer' AND callee_user_id IS NOT NULL)
    OR (callee_kind = 'staff' AND callee_staff_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS comms_calls_thread_idx ON comms.calls (thread_id, started_at DESC);
CREATE INDEX IF NOT EXISTS comms_calls_open_idx ON comms.calls (status) WHERE status IN ('initiated', 'ringing', 'accepted');

-- Un seul appel actif (sonnerie / en cours) par fil
CREATE UNIQUE INDEX IF NOT EXISTS comms_calls_one_live_uidx
  ON comms.calls (thread_id)
  WHERE status IN ('initiated', 'ringing', 'accepted');

-- Signalisation WebRTC (SDP / ICE) — les apps pollent ou LISTEN comms_signal
CREATE TABLE IF NOT EXISTS comms.call_signals (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES comms.calls(id) ON DELETE CASCADE,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('customer', 'staff')),
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice', 'hangup', 'reject')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comms_signals_call_idx ON comms.call_signals (call_id, id);

-- Jetons push / VoIP pour décrocher en arrière-plan
CREATE TABLE IF NOT EXISTS comms.devices (
  id TEXT PRIMARY KEY,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'staff')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  staff_id TEXT REFERENCES ops.staff(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  push_token TEXT,
  voip_token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comms_device_actor_chk CHECK (
    (actor_kind = 'customer' AND user_id IS NOT NULL AND staff_id IS NULL)
    OR (actor_kind = 'staff' AND staff_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS comms_devices_user_idx ON comms.devices (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comms_devices_staff_idx ON comms.devices (staff_id) WHERE staff_id IS NOT NULL;

DROP VIEW IF EXISTS comms.v_inbox;
CREATE OR REPLACE VIEW comms.v_inbox
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.kind,
  t.order_id,
  t.updated_at,
  t.disabled_at,
  t.disabled_by,
  t.archived_at,
  m.body AS last_body,
  m.kind AS last_kind,
  m.created_at AS last_at,
  m.sender_kind AS last_sender_kind
FROM comms.threads t
LEFT JOIN LATERAL (
  SELECT body, kind, created_at, sender_kind
  FROM comms.messages
  WHERE thread_id = t.id
  ORDER BY created_at DESC, id DESC
  LIMIT 1
) m ON TRUE
WHERE t.archived_at IS NULL
  AND (t.disabled_at IS NULL OR t.disabled_by IS NOT NULL);

CREATE OR REPLACE FUNCTION comms.touch_thread()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE comms.threads SET updated_at = NOW() WHERE id = NEW.thread_id;
  PERFORM pg_notify(
    'comms_message',
    json_build_object('thread_id', NEW.thread_id, 'message_id', NEW.id, 'kind', NEW.kind)::text
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS comms_messages_touch ON comms.messages;
CREATE TRIGGER comms_messages_touch
  AFTER INSERT ON comms.messages
  FOR EACH ROW
  EXECUTE FUNCTION comms.touch_thread();

CREATE OR REPLACE FUNCTION comms.notify_call()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
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
$fn$;

DROP TRIGGER IF EXISTS comms_calls_notify ON comms.calls;
CREATE TRIGGER comms_calls_notify
  AFTER INSERT OR UPDATE OF status ON comms.calls
  FOR EACH ROW
  EXECUTE FUNCTION comms.notify_call();

CREATE OR REPLACE FUNCTION comms.notify_signal()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_notify(
    'comms_signal',
    json_build_object('call_id', NEW.call_id, 'signal_id', NEW.id, 'type', NEW.signal_type)::text
  );
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS comms_signals_notify ON comms.call_signals;
CREATE TRIGGER comms_signals_notify
  AFTER INSERT ON comms.call_signals
  FOR EACH ROW
  EXECUTE FUNCTION comms.notify_signal();

-- Fil coursier + membres dès qu’un staff est assigné à la livraison
-- Un fil par couple client ↔ coursier (plusieurs colis = même conversation)
CREATE OR REPLACE FUNCTION comms.ensure_courier_thread(p_order_id TEXT, p_staff_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $fn$
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
$fn$;

-- Archive le fil coursier 30 min après livraison, sauf si une autre course
-- est encore active entre le même client et le même livreur.
CREATE OR REPLACE FUNCTION comms.archive_delivered_courier_threads()
RETURNS INTEGER
LANGUAGE plpgsql AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION comms.thread_for_order(p_order_id TEXT)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
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
$$;

CREATE OR REPLACE FUNCTION comms.ensure_support_thread(p_user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION comms.trg_delivery_thread()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.courier_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR OLD.courier_id IS DISTINCT FROM NEW.courier_id
  ) THEN
    PERFORM comms.ensure_courier_thread(NEW.order_id, NEW.courier_id);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS deliveries_comms_thread ON ops.deliveries;
CREATE TRIGGER deliveries_comms_thread
  AFTER INSERT OR UPDATE OF courier_id ON ops.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION comms.trg_delivery_thread();

-- Rattrapage commandes déjà assignées
SELECT comms.ensure_courier_thread(d.order_id, d.courier_id)
FROM ops.deliveries d
WHERE d.courier_id IS NOT NULL;

DO $$ BEGIN
  GRANT USAGE ON SCHEMA comms TO marche_shop, marche_ops;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA comms TO marche_shop, marche_ops;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA comms TO marche_shop, marche_ops;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- Catalogue admin : merch, audit, stock par magasin (même base public).

CREATE TABLE IF NOT EXISTS catalog_settings (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_staff_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_audit_entity_idx ON catalog_audit (entity, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_stock (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  reserved NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, store_id)
);

CREATE INDEX IF NOT EXISTS product_stock_store_idx ON product_stock (store_id, qty);

CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  delta NUMERIC(12,3) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'receipt', 'sale', 'adjust', 'shrink', 'pick_unavailable', 'transfer', 'seed'
  )),
  ref_type TEXT,
  ref_id TEXT,
  actor_staff_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_moves_product_idx ON stock_moves (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_moves_store_idx ON stock_moves (store_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS stock_moves_order_product_uidx
  ON stock_moves (product_id, store_id, ref_id)
  WHERE ref_type = 'order' AND reason = 'sale';

-- Rattrape une seule fois les commandes créées avant le registre automatique.
WITH missing_sales AS (
  SELECT l.product_id,
         COALESCE(o.store_id, 'su-aeroport') AS store_id,
         o.id AS order_id,
         SUM(l.qty)::NUMERIC AS sold
  FROM order_lines l
  JOIN orders o ON o.id = l.order_id
  WHERE o.status <> 'cancelled'
    AND NOT EXISTS (
      SELECT 1 FROM stock_moves m
      WHERE m.product_id = l.product_id
        AND m.store_id = COALESCE(o.store_id, 'su-aeroport')
        AND m.ref_type = 'order'
        AND m.ref_id = o.id
        AND m.reason = 'sale'
    )
  GROUP BY l.product_id, COALESCE(o.store_id, 'su-aeroport'), o.id
),
inserted AS (
  INSERT INTO stock_moves (id, product_id, store_id, delta, reason, ref_type, ref_id, note, created_at)
  SELECT 'sale-backfill-' || md5(order_id || ':' || product_id || ':' || store_id),
         product_id, store_id, -sold, 'sale', 'order', order_id,
         'Commande historique ' || order_id,
         COALESCE((SELECT created_at FROM orders WHERE id = order_id), NOW())
  FROM missing_sales
  ON CONFLICT DO NOTHING
  RETURNING product_id, store_id, -delta AS sold
),
totals AS (
  SELECT product_id, store_id, SUM(sold) AS sold
  FROM inserted
  GROUP BY product_id, store_id
)
UPDATE product_stock s
SET qty = GREATEST(0, s.qty - totals.sold),
    updated_at = NOW()
FROM totals
WHERE s.product_id = totals.product_id
  AND s.store_id = totals.store_id;

INSERT INTO catalog_settings (key, payload)
VALUES
  ('merch', '{
    "popularIds": ["tomates", "bananes", "gingembre"],
    "recommendedIds": ["poulet", "miel", "mangues", "lait", "carottes", "ananas", "plantains", "gingembre"],
    "trendingTerms": ["Glace", "Thon", "Chips", "Bananes", "Poulet"]
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- RH / personnel : onboarding, documents (même base ops).

ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS onboard_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE ops.staff ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_onboard_status_check' AND conrelid = 'ops.staff'::regclass
  ) THEN
    ALTER TABLE ops.staff ADD CONSTRAINT staff_onboard_status_check
      CHECK (onboard_status IN ('draft', 'invited', 'active', 'suspended'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_created_by_fk' AND conrelid = 'ops.staff'::regclass
  ) THEN
    ALTER TABLE ops.staff
      ADD CONSTRAINT staff_created_by_fk
      FOREIGN KEY (created_by) REFERENCES ops.staff(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ops.staff_documents (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES ops.staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cip', 'permis', 'photo', 'contrat', 'autre')),
  label TEXT,
  url_or_path TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_staff_documents_staff_idx ON ops.staff_documents (staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_staff_onboard_idx ON ops.staff (onboard_status, is_active);


-- Noyau catalogue importable. Migration additive et rejouable, sans suppression.

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE chips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uidx
  ON products (sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_uidx
  ON products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON products (category_id, active);
CREATE INDEX IF NOT EXISTS products_updated_id_idx
  ON products (updated_at, id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_nonempty_chk') THEN
    ALTER TABLE products ADD CONSTRAINT products_sku_nonempty_chk
      CHECK (sku IS NULL OR btrim(sku) <> '') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_digits_chk') THEN
    ALTER TABLE products ADD CONSTRAINT products_barcode_digits_chk
      CHECK (barcode IS NULL OR barcode ~ '^[0-9]{8,14}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_payload_object_chk') THEN
    ALTER TABLE products ADD CONSTRAINT products_payload_object_chk
      CHECK (jsonb_typeof(payload) = 'object') NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION catalog_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'products', 'categories', 'banners', 'chips', 'stores',
    'catalog_settings', 'product_stock'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_set_updated_at', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION catalog_set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS product_media (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'image',
  position INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  local_path TEXT,
  checksum_sha256 TEXT,
  license_name TEXT,
  license_url TEXT,
  attribution TEXT,
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_media_kind_chk CHECK (kind IN ('image', 'video')),
  CONSTRAINT product_media_position_chk CHECK (position >= 0),
  CONSTRAINT product_media_location_chk CHECK (
    is_placeholder OR source_url IS NOT NULL OR local_path IS NOT NULL
  ),
  CONSTRAINT product_media_checksum_chk CHECK (
    checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_media_product_position_uidx
  ON product_media (product_id, kind, position);
CREATE INDEX IF NOT EXISTS product_media_product_idx
  ON product_media (product_id, position);

DROP TRIGGER IF EXISTS product_media_set_updated_at ON product_media;
CREATE TRIGGER product_media_set_updated_at
BEFORE UPDATE ON product_media
FOR EACH ROW EXECUTE FUNCTION catalog_set_updated_at();

CREATE TABLE IF NOT EXISTS catalog_import_runs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  manifest_version TEXT,
  manifest_checksum_sha256 TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'running',
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT catalog_import_runs_status_chk
    CHECK (status IN ('running', 'completed', 'failed', 'dry-run'))
);

CREATE INDEX IF NOT EXISTS catalog_import_runs_started_idx
  ON catalog_import_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS catalog_import_runs_checksum_idx
  ON catalog_import_runs (manifest_checksum_sha256)
  WHERE manifest_checksum_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_import_rows (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES catalog_import_runs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  requested_id TEXT,
  resolved_product_id TEXT,
  sku TEXT,
  barcode TEXT,
  action TEXT NOT NULL,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_import_rows_number_chk CHECK (row_number > 0),
  CONSTRAINT catalog_import_rows_action_chk
    CHECK (action IN ('inserted', 'updated', 'unchanged', 'invalid', 'stock-initialized', 'stock-skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_import_rows_run_row_uidx
  ON catalog_import_rows (run_id, row_number);
CREATE INDEX IF NOT EXISTS catalog_import_rows_lookup_idx
  ON catalog_import_rows (sku, barcode);

-- Historique de synchronisation prêt pour les suppressions futures. Aucun produit
-- existant n'est supprimé ou désactivé par cette migration.
CREATE TABLE IF NOT EXISTS catalog_tombstones (
  entity TEXT NOT NULL DEFAULT 'product',
  entity_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revision BIGSERIAL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (entity, entity_id)
);
CREATE INDEX IF NOT EXISTS catalog_tombstones_deleted_idx
  ON catalog_tombstones (deleted_at, entity_id);

ALTER TABLE stock_moves ADD COLUMN IF NOT EXISTS qty_before NUMERIC(12,3);
ALTER TABLE stock_moves ADD COLUMN IF NOT EXISTS qty_after NUMERIC(12,3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_qty_nonnegative_chk') THEN
    ALTER TABLE product_stock ADD CONSTRAINT product_stock_qty_nonnegative_chk
      CHECK (qty >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_reserved_nonnegative_chk') THEN
    ALTER TABLE product_stock ADD CONSTRAINT product_stock_reserved_nonnegative_chk
      CHECK (reserved >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_reserved_lte_qty_chk') THEN
    ALTER TABLE product_stock ADD CONSTRAINT product_stock_reserved_lte_qty_chk
      CHECK (reserved <= qty) NOT VALID;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_moves_order_unavailable_uidx
  ON stock_moves (product_id, store_id, ref_id)
  WHERE ref_type = 'order' AND reason = 'pick_unavailable';
