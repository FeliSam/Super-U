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

INSERT INTO catalog_settings (key, payload)
VALUES
  ('merch', '{
    "popularIds": ["tomates", "bananes", "gingembre"],
    "recommendedIds": ["poulet", "miel", "mangues", "lait", "carottes", "ananas", "plantains", "gingembre"],
    "trendingTerms": ["Glace", "Thon", "Chips", "Bananes", "Poulet"]
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
