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
