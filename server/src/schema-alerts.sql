-- Phase P2 : alertes opérationnelles évaluées par le serveur (server/src/alerts.ts).
-- Idempotent (rejoué à chaque démarrage par migrate(), après schema-actions.sql).
--
-- Une alerte = (kind, entity_id). Dédoublonnage : une seule alerte ouverte ou acquittée à la fois par
-- entité (index unique partiel) ; l'évaluateur ne crée donc jamais de doublon, quelle que soit sa fréquence.
-- Cycle : open → acked (quelqu'un l'a vue) → resolved (condition disparue, ou expiration pour les
-- alertes « événement » comme un appel manqué). Chaque transition alimente le journal temps réel :
-- alert.raised, alert.acked, alert.resolved (payload sans donnée personnelle client).

CREATE TABLE IF NOT EXISTS ops.alerts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  store_id TEXT,
  order_id TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acked', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acked_at TIMESTAMPTZ,
  acked_by TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  acked_by_name TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_alerts_active_uidx ON ops.alerts (kind, entity_id) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS ops_alerts_status_idx ON ops.alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_alerts_resolved_idx ON ops.alerts (kind, entity_id, resolved_at DESC) WHERE status = 'resolved';

CREATE OR REPLACE FUNCTION ops.admin_ev_alerts() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'alert.raised';
  ELSIF NEW.status = 'acked' THEN
    v_type := 'alert.acked';
  ELSIF NEW.status = 'resolved' THEN
    v_type := 'alert.resolved';
  ELSE
    RETURN NULL;
  END IF;
  PERFORM ops.admin_emit(v_type, NEW.store_id, 'alert', NEW.id::text, jsonb_build_object(
    'alertId', NEW.id,
    'kind', NEW.kind,
    'severity', NEW.severity,
    'status', NEW.status,
    'entity', NEW.entity,
    'entityId', NEW.entity_id,
    'orderId', NEW.order_id,
    'title', NEW.title,
    'detail', NEW.detail,
    'ackedBy', NEW.acked_by_name,
    'resolvedReason', NEW.resolved_reason
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS alerts_admin_event_ins ON ops.alerts;
CREATE TRIGGER alerts_admin_event_ins
  AFTER INSERT ON ops.alerts
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_alerts();
DROP TRIGGER IF EXISTS alerts_admin_event_upd ON ops.alerts;
CREATE TRIGGER alerts_admin_event_upd
  AFTER UPDATE ON ops.alerts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION ops.admin_ev_alerts();
