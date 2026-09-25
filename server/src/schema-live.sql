-- P1 temps réel admin (idempotent : rejoué à chaque démarrage par migrate(), après schema-p0.sql).
--
-- Journal ops.admin_events alimenté par des triggers, + pg_notify('admin_events', id) à chaque insertion.
-- Le serveur écoute (LISTEN) et pousse les événements au panel via SSE (GET /admin/stream).
-- Les positions GPS des coursiers ne sont PAS journalisées : canal léger pg_notify('courier_pos', json).
--
-- Convention payload : les données personnelles client vont dans payload.pii, les montants dans
-- payload.money ; le serveur les retire selon le rôle du lecteur (recruteur / support : pas de PII client).
-- Toutes les fonctions d'émission avalent leurs erreurs (RAISE WARNING) : un souci de journal ne doit
-- jamais faire échouer une commande, un paiement ou un appel.

CREATE TABLE IF NOT EXISTS ops.admin_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  store_id TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ops_admin_events_created_idx ON ops.admin_events (created_at);
CREATE INDEX IF NOT EXISTS ops_admin_events_entity_idx ON ops.admin_events (entity, entity_id, id DESC);

-- Émission : insertion + notification (livrée au COMMIT de la transaction appelante).
CREATE OR REPLACE FUNCTION ops.admin_emit(
  p_type TEXT, p_store TEXT, p_entity TEXT, p_entity_id TEXT, p_payload JSONB
) RETURNS BIGINT
LANGUAGE plpgsql AS $fn$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO ops.admin_events (type, store_id, entity, entity_id, payload)
  VALUES (p_type, p_store, p_entity, p_entity_id, COALESCE(jsonb_strip_nulls(p_payload), '{}'::jsonb))
  RETURNING id INTO v_id;
  PERFORM pg_notify('admin_events', v_id::text);
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ops.admin_emit(%) ignoré : %', p_type, SQLERRM;
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION ops.admin_order_store(p_order TEXT)
RETURNS TEXT
LANGUAGE sql STABLE AS $fn$
  SELECT store_id FROM public.orders WHERE id = p_order
$fn$;

CREATE OR REPLACE FUNCTION ops.admin_staff_name(p_staff TEXT)
RETURNS TEXT
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(trim(concat_ws(' ', first_name, last_name)), '') FROM ops.staff WHERE id = p_staff
$fn$;

-- Rétention (appelée toutes les heures par le serveur, ADMIN_EVENTS_RETENTION_DAYS, 7 par défaut).
CREATE OR REPLACE FUNCTION ops.purge_admin_events(p_days INTEGER DEFAULT 7)
RETURNS BIGINT
LANGUAGE plpgsql AS $fn$
DECLARE
  n BIGINT;
BEGIN
  DELETE FROM ops.admin_events WHERE created_at < NOW() - make_interval(days => GREATEST(p_days, 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;

-- ---------------------------------------------------------------- commandes
CREATE OR REPLACE FUNCTION ops.admin_ev_orders() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT;
  v_pii JSONB;
BEGIN
  SELECT jsonb_build_object(
           'customerName', NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
           'customerPhone', COALESCE(NULLIF(NEW.address_phone, ''), u.phone),
           'address', NULLIF(concat_ws(', ', NULLIF(NEW.address_line, ''), NULLIF(NEW.address_city, '')), '')
         )
    INTO v_pii
    FROM public.users u WHERE u.id = NEW.user_id;
  IF TG_OP = 'INSERT' THEN
    v_type := 'order.created';
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_type := 'order.cancelled';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    v_type := 'order.status';
  ELSE
    v_type := 'order.payment';
  END IF;
  PERFORM ops.admin_emit(v_type, NEW.store_id, 'order', NEW.id, jsonb_build_object(
    'orderId', NEW.id,
    'status', NEW.status,
    'from', CASE WHEN TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN OLD.status END,
    'paymentStatus', NEW.payment_status,
    'paymentFrom', CASE WHEN TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN OLD.payment_status END,
    'paymentMethod', NEW.payment_id,
    'itemCount', NEW.item_count,
    'managedBy', NEW.managed_by,
    'storeName', NEW.store_name,
    'slot', NEW.slot_label,
    'userId', NEW.user_id,
    'money', jsonb_build_object('total', NEW.total, 'deliveryFee', NEW.delivery_fee),
    'pii', v_pii
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS orders_admin_event_ins ON public.orders;
CREATE TRIGGER orders_admin_event_ins
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_orders();
DROP TRIGGER IF EXISTS orders_admin_event_upd ON public.orders;
CREATE TRIGGER orders_admin_event_upd
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION ops.admin_ev_orders();

-- ---------------------------------------------------------------- préparation (pick jobs + lignes)
CREATE OR REPLACE FUNCTION ops.admin_ev_pick_jobs() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT := 'pick.status';
BEGIN
  IF OLD.picker_id IS NULL AND NEW.picker_id IS NOT NULL THEN
    v_type := 'pick.assigned';
  ELSIF OLD.picker_id IS NOT NULL AND NEW.picker_id IS NULL THEN
    v_type := 'pick.released';
  ELSIF OLD.picker_id IS DISTINCT FROM NEW.picker_id THEN
    v_type := 'pick.reassigned';
  END IF;
  PERFORM ops.admin_emit(v_type, NEW.store_id, 'pick_job', NEW.id, jsonb_build_object(
    'orderId', NEW.order_id,
    'status', NEW.status,
    'from', CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN OLD.status END,
    'pickerId', NEW.picker_id,
    'pickerFrom', CASE WHEN OLD.picker_id IS DISTINCT FROM NEW.picker_id THEN OLD.picker_id END,
    'pickerName', ops.admin_staff_name(NEW.picker_id)
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS pick_jobs_admin_event ON ops.pick_jobs;
CREATE TRIGGER pick_jobs_admin_event
  AFTER UPDATE ON ops.pick_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.picker_id IS DISTINCT FROM NEW.picker_id)
  EXECUTE FUNCTION ops.admin_ev_pick_jobs();

CREATE OR REPLACE FUNCTION ops.admin_ev_order_lines() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('pick.line', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'orderId', NEW.order_id,
    'productId', NEW.product_id,
    'name', NEW.name,
    'qty', NEW.qty,
    'pickedQty', NEW.picked_qty,
    'unavailable', NEW.unavailable
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS order_lines_admin_event ON public.order_lines;
CREATE TRIGGER order_lines_admin_event
  AFTER UPDATE OF picked_qty, unavailable ON public.order_lines
  FOR EACH ROW
  WHEN (OLD.picked_qty IS DISTINCT FROM NEW.picked_qty OR OLD.unavailable IS DISTINCT FROM NEW.unavailable)
  EXECUTE FUNCTION ops.admin_ev_order_lines();

-- ---------------------------------------------------------------- livraisons
CREATE OR REPLACE FUNCTION ops.admin_ev_deliveries() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT := 'delivery.status';
BEGIN
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    v_type := 'delivery.failed';
  ELSIF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    v_type := 'delivery.delivered';
  ELSIF OLD.courier_id IS NULL AND NEW.courier_id IS NOT NULL THEN
    v_type := 'delivery.claimed';
  ELSIF OLD.courier_id IS NOT NULL AND NEW.courier_id IS NULL THEN
    v_type := 'delivery.released';
  ELSIF OLD.courier_id IS DISTINCT FROM NEW.courier_id THEN
    v_type := 'delivery.reassigned';
  END IF;
  PERFORM ops.admin_emit(v_type, NEW.store_id, 'delivery', NEW.id, jsonb_build_object(
    'orderId', NEW.order_id,
    'status', NEW.status,
    'from', CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN OLD.status END,
    'courierId', NEW.courier_id,
    'courierFrom', CASE WHEN OLD.courier_id IS DISTINCT FROM NEW.courier_id THEN OLD.courier_id END,
    'courierName', ops.admin_staff_name(NEW.courier_id),
    'failedReason', CASE WHEN NEW.status = 'failed' THEN NEW.failed_reason END,
    'failedReasonCode', CASE WHEN NEW.status = 'failed' THEN NEW.failed_reason_code END,
    'money', jsonb_build_object('cashToCollect', NEW.cash_to_collect)
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS deliveries_admin_event ON ops.deliveries;
CREATE TRIGGER deliveries_admin_event
  AFTER UPDATE ON ops.deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.courier_id IS DISTINCT FROM NEW.courier_id)
  EXECUTE FUNCTION ops.admin_ev_deliveries();

-- ---------------------------------------------------------------- stock (tous magasins)
CREATE OR REPLACE FUNCTION ops.admin_ev_product_stock() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('stock.changed', NEW.store_id, 'product', NEW.product_id, jsonb_build_object(
    'productId', NEW.product_id,
    'name', (SELECT payload->>'name' FROM public.products WHERE id = NEW.product_id),
    'qty', NEW.qty,
    'reserved', NEW.reserved,
    'available', GREATEST(NEW.qty - NEW.reserved, 0),
    'minQty', NEW.min_qty,
    'low', (NEW.qty - NEW.reserved) <= NEW.min_qty,
    'qtyFrom', CASE WHEN TG_OP = 'UPDATE' THEN OLD.qty END
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS product_stock_admin_event_ins ON public.product_stock;
CREATE TRIGGER product_stock_admin_event_ins
  AFTER INSERT ON public.product_stock
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_product_stock();
DROP TRIGGER IF EXISTS product_stock_admin_event_upd ON public.product_stock;
CREATE TRIGGER product_stock_admin_event_upd
  AFTER UPDATE ON public.product_stock
  FOR EACH ROW
  WHEN (OLD.qty IS DISTINCT FROM NEW.qty OR OLD.reserved IS DISTINCT FROM NEW.reserved OR OLD.min_qty IS DISTINCT FROM NEW.min_qty)
  EXECUTE FUNCTION ops.admin_ev_product_stock();

CREATE OR REPLACE FUNCTION ops.admin_ev_stock_moves() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('stock.move', NEW.store_id, 'product', NEW.product_id, jsonb_build_object(
    'moveId', NEW.id,
    'productId', NEW.product_id,
    'delta', NEW.delta,
    'reason', NEW.reason,
    'refType', NEW.ref_type,
    'refId', NEW.ref_id,
    'qtyBefore', NEW.qty_before,
    'qtyAfter', NEW.qty_after,
    'actorStaffId', NEW.actor_staff_id
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS stock_moves_admin_event ON public.stock_moves;
CREATE TRIGGER stock_moves_admin_event
  AFTER INSERT ON public.stock_moves
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_stock_moves();

-- ---------------------------------------------------------------- clients Marché Doré
CREATE OR REPLACE FUNCTION ops.admin_ev_users() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name THEN
      v_fields := array_append(v_fields, 'name');
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN v_fields := array_append(v_fields, 'email'); END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN v_fields := array_append(v_fields, 'phone'); END IF;
    IF OLD.birth_date IS DISTINCT FROM NEW.birth_date THEN v_fields := array_append(v_fields, 'birthDate'); END IF;
    IF OLD.photo_data IS DISTINCT FROM NEW.photo_data THEN v_fields := array_append(v_fields, 'photo'); END IF;
    IF OLD.onboarding_done IS DISTINCT FROM NEW.onboarding_done THEN v_fields := array_append(v_fields, 'onboarding'); END IF;
  END IF;
  PERFORM ops.admin_emit(
    CASE WHEN TG_OP = 'INSERT' THEN 'client.signup' ELSE 'client.profile' END,
    NULL, 'user', NEW.id,
    jsonb_build_object(
      'userId', NEW.id,
      'fields', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(v_fields) END,
      'onboardingDone', NEW.onboarding_done,
      'pii', jsonb_build_object(
        'name', NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
        'email', NEW.email,
        'phone', NEW.phone
      )
    )
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS users_admin_event_ins ON public.users;
CREATE TRIGGER users_admin_event_ins
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_users();
DROP TRIGGER IF EXISTS users_admin_event_upd ON public.users;
CREATE TRIGGER users_admin_event_upd
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (
    OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name
    OR OLD.email IS DISTINCT FROM NEW.email OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.birth_date IS DISTINCT FROM NEW.birth_date OR OLD.onboarding_done IS DISTINCT FROM NEW.onboarding_done
    OR OLD.photo_data IS DISTINCT FROM NEW.photo_data
  )
  EXECUTE FUNCTION ops.admin_ev_users();

-- ---------------------------------------------------------------- personnel
-- Présence : seules les transitions duty_status (online / paused / offline) sont journalisées ;
-- les battements last_seen_at (à chaque ping GPS / requête) ne le sont jamais.
CREATE OR REPLACE FUNCTION ops.admin_ev_staff() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT;
  v_pending BOOLEAN := COALESCE(NEW.onboard_status, 'active') IN ('draft', 'invited');
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := CASE WHEN v_pending THEN 'staff.pending' ELSE 'staff.created' END;
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active
     OR OLD.onboard_status IS DISTINCT FROM NEW.onboard_status
     OR OLD.role IS DISTINCT FROM NEW.role
     OR OLD.store_id IS DISTINCT FROM NEW.store_id THEN
    v_type := CASE
      WHEN v_pending AND COALESCE(OLD.onboard_status, 'active') NOT IN ('draft', 'invited') THEN 'staff.pending'
      WHEN NEW.is_active AND NOT OLD.is_active THEN 'staff.activated'
      WHEN OLD.is_active AND NOT NEW.is_active THEN 'staff.deactivated'
      ELSE 'staff.status'
    END;
  ELSE
    v_type := 'staff.presence';
  END IF;
  PERFORM ops.admin_emit(v_type, NEW.store_id, 'staff', NEW.id, jsonb_build_object(
    'staffId', NEW.id,
    'name', NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
    'role', NEW.role,
    'isActive', NEW.is_active,
    'onboardStatus', NEW.onboard_status,
    'pending', v_pending,
    'presence', NEW.duty_status,
    'presenceFrom', CASE WHEN TG_OP = 'UPDATE' AND OLD.duty_status IS DISTINCT FROM NEW.duty_status THEN OLD.duty_status END,
    'canPick', NEW.can_pick,
    'canDeliver', NEW.can_deliver
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS staff_admin_event_ins ON ops.staff;
CREATE TRIGGER staff_admin_event_ins
  AFTER INSERT ON ops.staff
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_staff();
DROP TRIGGER IF EXISTS staff_admin_event_upd ON ops.staff;
CREATE TRIGGER staff_admin_event_upd
  AFTER UPDATE ON ops.staff
  FOR EACH ROW
  WHEN (
    OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.onboard_status IS DISTINCT FROM NEW.onboard_status
    OR OLD.role IS DISTINCT FROM NEW.role OR OLD.store_id IS DISTINCT FROM NEW.store_id
    OR OLD.duty_status IS DISTINCT FROM NEW.duty_status
  )
  EXECUTE FUNCTION ops.admin_ev_staff();

-- ---------------------------------------------------------------- notes, incidents
CREATE OR REPLACE FUNCTION ops.admin_ev_ratings() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('rating.created', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'ratingId', NEW.id,
    'orderId', NEW.order_id,
    'raterKind', NEW.rater_kind,
    'raterStaffId', NEW.rater_staff_id,
    'rating', NEW.rating,
    'money', jsonb_build_object('tip', NEW.tip_amount),
    'pii', jsonb_build_object('comment', NULLIF(left(COALESCE(NEW.comment, ''), 280), ''))
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS order_ratings_admin_event ON ops.order_ratings;
CREATE TRIGGER order_ratings_admin_event
  AFTER INSERT ON ops.order_ratings
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_ratings();

CREATE OR REPLACE FUNCTION ops.admin_ev_incidents() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('incident.created', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'incidentId', NEW.id,
    'orderId', NEW.order_id,
    'deliveryId', NEW.delivery_id,
    'staffId', NEW.staff_id,
    'staffName', ops.admin_staff_name(NEW.staff_id),
    'reasonCode', NEW.reason_code,
    'reasonText', NULLIF(left(COALESCE(NEW.reason_text, ''), 280), '')
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS delivery_incidents_admin_event ON ops.delivery_incidents;
CREATE TRIGGER delivery_incidents_admin_event
  AFTER INSERT ON ops.delivery_incidents
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_incidents();

CREATE OR REPLACE FUNCTION ops.admin_ev_client_incident_actions() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM ops.admin_emit('incident.client_action', ops.admin_order_store(NEW.order_id), 'order', NEW.order_id, jsonb_build_object(
    'actionId', NEW.id,
    'orderId', NEW.order_id,
    'incidentId', NEW.incident_id,
    'action', NEW.action,
    'userId', NEW.user_id,
    'pii', jsonb_build_object('note', NULLIF(left(COALESCE(NEW.note, ''), 280), ''))
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS client_incident_actions_admin_event ON ops.client_incident_actions;
CREATE TRIGGER client_incident_actions_admin_event
  AFTER INSERT ON ops.client_incident_actions
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_client_incident_actions();

-- ---------------------------------------------------------------- paiements
CREATE OR REPLACE FUNCTION ops.admin_ev_payments() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'payment.created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_type := CASE WHEN NEW.status = 'paid' THEN 'payment.paid' ELSE 'payment.status' END;
  ELSE
    v_type := 'payment.linked';
  END IF;
  PERFORM ops.admin_emit(v_type, ops.admin_order_store(NEW.order_id), 'payment', NEW.id, jsonb_build_object(
    'paymentId', NEW.id,
    'orderId', NEW.order_id,
    'userId', NEW.user_id,
    'method', NEW.method,
    'status', NEW.status,
    'from', CASE WHEN TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN OLD.status END,
    'money', jsonb_build_object('amount', NEW.amount)
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS payments_admin_event_ins ON public.payments;
CREATE TRIGGER payments_admin_event_ins
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_payments();
DROP TRIGGER IF EXISTS payments_admin_event_upd ON public.payments;
CREATE TRIGGER payments_admin_event_upd
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.order_id IS DISTINCT FROM NEW.order_id)
  EXECUTE FUNCTION ops.admin_ev_payments();

-- ---------------------------------------------------------------- appels et messages (comms)
CREATE OR REPLACE FUNCTION ops.admin_ev_calls() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_type := 'call.started';
  ELSIF NEW.status = 'accepted' THEN
    v_type := 'call.answered';
  ELSIF NEW.status IN ('missed', 'rejected') OR (NEW.status = 'canceled' AND NEW.answered_at IS NULL) THEN
    v_type := 'call.missed';
  ELSIF NEW.status IN ('ended', 'failed', 'canceled') THEN
    v_type := 'call.ended';
  ELSE
    RETURN NULL; -- initiated → ringing : sans intérêt pour le panel
  END IF;
  PERFORM ops.admin_emit(v_type, ops.admin_order_store(NEW.order_id), 'call', NEW.id, jsonb_build_object(
    'callId', NEW.id,
    'threadId', NEW.thread_id,
    'orderId', NEW.order_id,
    'media', NEW.media,
    'status', NEW.status,
    'endReason', NEW.end_reason,
    'callerKind', NEW.caller_kind,
    'calleeKind', NEW.callee_kind,
    'callerStaffId', NEW.caller_staff_id,
    'calleeStaffId', NEW.callee_staff_id,
    'callerUserId', NEW.caller_user_id,
    'calleeUserId', NEW.callee_user_id,
    'durationS', CASE WHEN NEW.answered_at IS NOT NULL AND NEW.ended_at IS NOT NULL
                      THEN ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at)))::int END
  ));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS calls_admin_event_ins ON comms.calls;
CREATE TRIGGER calls_admin_event_ins
  AFTER INSERT ON comms.calls
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_calls();
DROP TRIGGER IF EXISTS calls_admin_event_upd ON comms.calls;
CREATE TRIGGER calls_admin_event_upd
  AFTER UPDATE ON comms.calls
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION ops.admin_ev_calls();

CREATE OR REPLACE FUNCTION ops.admin_ev_messages() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_kind TEXT;
  v_order TEXT;
BEGIN
  SELECT kind, order_id INTO v_kind, v_order FROM comms.threads WHERE id = NEW.thread_id;
  PERFORM ops.admin_emit(
    CASE WHEN v_kind = 'support' THEN 'support.message' ELSE 'thread.message' END,
    ops.admin_order_store(v_order), 'thread', NEW.thread_id,
    jsonb_build_object(
      'messageId', NEW.id,
      'threadId', NEW.thread_id,
      'threadKind', v_kind,
      'orderId', v_order,
      'senderKind', NEW.sender_kind,
      'senderStaffId', NEW.sender_staff_id,
      'senderUserId', NEW.sender_user_id,
      'kind', NEW.kind,
      'pii', jsonb_build_object('body', NULLIF(left(COALESCE(NEW.body, ''), 280), ''))
    )
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Le journal ne doit jamais faire échouer l'écriture métier.
  RAISE WARNING '% ignoré : %', TG_NAME, SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS messages_admin_event ON comms.messages;
CREATE TRIGGER messages_admin_event
  AFTER INSERT ON comms.messages
  FOR EACH ROW EXECUTE FUNCTION ops.admin_ev_messages();

-- ---------------------------------------------------------------- GPS coursiers (canal léger, non journalisé)
CREATE OR REPLACE FUNCTION ops.admin_courier_pos_notify() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_notify('courier_pos', json_build_object(
    'c', NEW.courier_id,
    'lng', NEW.lng,
    'lat', NEW.lat,
    'h', NEW.heading,
    's', NEW.speed_mps,
    't', NEW.updated_at,
    'st', (SELECT store_id FROM ops.staff WHERE id = NEW.courier_id)
  )::text);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'courier_pos ignoré : %', SQLERRM;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS courier_locations_admin_pos ON ops.courier_locations;
CREATE TRIGGER courier_locations_admin_pos
  AFTER INSERT OR UPDATE ON ops.courier_locations
  FOR EACH ROW EXECUTE FUNCTION ops.admin_courier_pos_notify();
