-- Phase P1b : actions admin sur les commandes (journal d'audit), remboursements.
-- Idempotent (rejoué à chaque démarrage par migrate()).
--
-- ops.order_audit : une ligne par action back-office (qui, quoi, avant, après, motif).
-- public.refunds  : remboursements enregistrés (FedaPay n'expose pas d'API de remboursement :
--                   method = 'manual' → à effectuer dans le tableau de bord FedaPay / en espèces).
-- Les deux tables alimentent le journal temps réel (ops.admin_emit) : order.audit, payment.refunded.

CREATE TABLE IF NOT EXISTS ops.order_audit (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ops_order_audit_order_idx ON ops.order_audit (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id TEXT REFERENCES public.payments(id) ON DELETE SET NULL,
  amount INT NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'fedapay')),
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'pending', 'succeeded', 'failed')),
  provider_ref TEXT,
  reason TEXT NOT NULL,
  actor_staff_id TEXT REFERENCES ops.staff(id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id);

CREATE OR REPLACE FUNCTION ops.admin_ev_order_audit() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('order.audit', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'auditId', NEW.id,
    'orderId', NEW.order_id,
    'action', NEW.action,
    'actorStaffId', NEW.actor_staff_id,
    'actorName', NEW.actor_name,
    'actorRole', NEW.actor_role,
    'before', NEW.before - 'amount',
    'after', NEW.after - 'amount',
    'reason', NEW.reason,
    'money', CASE WHEN NEW.after ? 'amount' THEN jsonb_build_object('amount', NEW.after->'amount') END
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS order_audit_admin_event ON ops.order_audit;
CREATE TRIGGER order_audit_admin_event
  AFTER INSERT ON ops.order_audit
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_order_audit();

CREATE OR REPLACE FUNCTION ops.admin_ev_refunds() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('payment.refunded', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'refundId', NEW.id,
    'orderId', NEW.order_id,
    'paymentId', NEW.payment_id,
    'method', NEW.method,
    'channel', NEW.channel,
    'status', NEW.status,
    'actorName', NEW.actor_name,
    'money', jsonb_build_object('amount', NEW.amount)
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS refunds_admin_event ON public.refunds;
CREATE TRIGGER refunds_admin_event
  AFTER INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_refunds();
