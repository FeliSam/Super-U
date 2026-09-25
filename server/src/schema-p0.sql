-- P0 sécurité (idempotent : rejoué à chaque démarrage par migrate(), comme les autres schema-*.sql).

-- 1. Sessions staff : expiration glissante (30 jours par défaut, prolongée à l'usage).
--    Les sessions existantes reçoivent NOW() + 30 jours au moment de la migration :
--    aucun coursier ni admin connecté n'est déconnecté par le déploiement.
ALTER TABLE ops.staff_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days');
CREATE INDEX IF NOT EXISTS ops_staff_sessions_expires_idx ON ops.staff_sessions (expires_at);

-- 2. Numéro béninois normalisé (10 chiffres nationaux) pour une comparaison EXACTE au login.
--    Même règle que nationalBeninDigits() dans server/src/phone.ts.
CREATE OR REPLACE FUNCTION public.national_phone_digits(p TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  d TEXT;
BEGIN
  d := regexp_replace(COALESCE(p, ''), '\D', '', 'g');
  IF left(d, 5) = '00229' THEN
    d := substr(d, 6);
  ELSIF left(d, 3) = '229' THEN
    d := substr(d, 4);
  END IF;
  IF length(d) = 10 AND left(d, 2) IN ('01', '02') THEN
    RETURN d;
  END IF;
  IF length(d) = 8 THEN
    RETURN CASE WHEN left(d, 1) = '2' THEN '02' ELSE '01' END || d;
  END IF;
  RETURN NULL;
END;
$fn$;

-- 3. Mouvements de stock : motif « cancel » (réintégration à l'annulation d'une commande).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'stock_moves'::regclass
      AND conname = 'stock_moves_reason_check'
      AND pg_get_constraintdef(oid) LIKE '%''cancel''%'
  ) THEN
    ALTER TABLE stock_moves DROP CONSTRAINT IF EXISTS stock_moves_reason_check;
    ALTER TABLE stock_moves ADD CONSTRAINT stock_moves_reason_check
      CHECK (reason IN (
        'receipt', 'sale', 'adjust', 'shrink', 'pick_unavailable', 'transfer', 'seed', 'cancel'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_moves_order_cancel_uidx
  ON stock_moves (product_id, store_id, ref_id)
  WHERE ref_type = 'order' AND reason = 'cancel';

-- 4. Paiements : rattachement à la commande (rempli quand l'app envoie orderId / paymentRef).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fk' AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_order_id_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);
