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

INSERT INTO ops.schema_meta (key, value) VALUES ('version', '2')
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
      AND c.conname <> 'staff_can_act_chk'
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
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_deliveries_board_idx ON ops.deliveries (status, store_id, created_at);
CREATE INDEX IF NOT EXISTS ops_deliveries_courier_idx ON ops.deliveries (courier_id, status);

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
    WHEN pick IN ('picking', 'assigned', 'packed') OR del IN ('assigned', 'at_store') THEN 'preparing'
    ELSE 'confirmed'
  END;
$$;

-- Vues partagées (les deux apps lisent la même vérité)
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
  o.created_at,
  pj.status AS pick_status,
  pj.picker_id,
  pj.packed_at,
  (pj.picker_id IS NOT NULL AND d.courier_id IS NOT NULL AND pj.picker_id = d.courier_id) AS same_handler
FROM ops.deliveries d
JOIN orders o ON o.id = d.order_id
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
  loc.lng AS courier_lng,
  loc.lat AS courier_lat,
  loc.updated_at AS courier_located_at,
  pj.status AS pick_status,
  pj.picker_id,
  pk.first_name AS picker_first_name,
  pk.last_name AS picker_last_name,
  pj.packed_at,
  (pj.picker_id IS NOT NULL AND d.courier_id IS NOT NULL AND pj.picker_id = d.courier_id) AS same_handler,
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

DROP INDEX IF EXISTS comms.comms_threads_courier_order_uidx;

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

CREATE OR REPLACE VIEW comms.v_inbox
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.kind,
  t.order_id,
  t.updated_at,
  m.body AS last_body,
  m.kind AS last_kind,
  m.created_at AS last_at,
  m.sender_kind AS last_sender_kind
FROM comms.threads t
LEFT JOIN LATERAL (
  SELECT body, kind, created_at, sender_kind
  FROM comms.messages
  WHERE thread_id = t.id
  ORDER BY created_at DESC
  LIMIT 1
) m ON TRUE;

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
CREATE OR REPLACE FUNCTION comms.ensure_courier_thread(p_order_id TEXT, p_staff_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $fn$
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
