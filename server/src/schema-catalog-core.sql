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
