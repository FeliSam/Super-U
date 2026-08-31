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
