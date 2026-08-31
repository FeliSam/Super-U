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
