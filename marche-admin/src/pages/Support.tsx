import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useStreamReload } from '@/lib/adminStream';
import { ORDER_STATUS, formatWhen } from '@/lib/orderLabels';

type ThreadRow = {
  id: string;
  userId: string | null;
  customerName: string;
  customerPhone: string | null;
  lastBody: string | null;
  lastAt: string | null;
  lastSenderKind: string | null;
  unread: number;
  total: number;
  disabled: boolean;
};

type Msg = { id: string; senderKind: string; senderName: string | null; mine: boolean; kind: string; body: string; createdAt: string };

type ThreadDetail = {
  thread: { id: string; userId: string | null; customerName: string; customerPhone: string | null; disabled: boolean };
  orders: { id: string; status: string; createdAt: string }[];
  messages: Msg[];
};

export function SupportPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(() => {
    api<{ threads: ThreadRow[]; unreadTotal: number }>('/admin/support/threads')
      .then((r) => {
        setThreads(r.threads);
        setUnreadTotal(r.unreadTotal);
        setErr('');
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  const loadThread = useCallback((id: string, markRead: boolean) => {
    api<ThreadDetail>(`/admin/support/threads/${encodeURIComponent(id)}`)
      .then((r) => {
        setDetail(r);
        if (markRead) {
          void api(`/admin/support/threads/${encodeURIComponent(id)}/read`, { method: 'POST' }).then(loadList, () => undefined);
        }
      })
      .catch((e: Error) => setErr(e.message));
  }, [loadList]);

  useEffect(loadList, [loadList]);
  useEffect(() => {
    if (openId) loadThread(openId, true);
    else setDetail(null);
  }, [openId, loadThread]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [detail?.messages.length]);

  // Temps réel : chaque message support recharge la liste et le fil ouvert.
  const openRef = useRef(openId);
  openRef.current = openId;
  useStreamReload(['support.'], () => {
    loadList();
    if (openRef.current) loadThread(openRef.current, true);
  });

  const send = async () => {
    if (!openId || !draft.trim()) return;
    setSending(true);
    try {
      await api(`/admin/support/threads/${encodeURIComponent(openId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft('');
      loadThread(openId, false);
      loadList();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const list = filter === 'unread' ? threads.filter((t) => t.unread > 0) : threads;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Support</h2>
          <p>Conversations « Assistance » de Marché Doré. Vos réponses arrivent dans l’app client (onglet Messages) avec une notification.</p>
        </div>
        <span className={`pill ${unreadTotal ? 'warn' : 'ok'}`}>{unreadTotal ? `${unreadTotal} non lue(s)` : 'Tout est lu'}</span>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="support-grid">
        <div className="card support-list">
          <div className="seg" style={{ margin: '0 0 10px' }}>
            <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
              Toutes ({threads.length})
            </button>
            <button type="button" className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>
              Non lues ({unreadTotal})
            </button>
          </div>
          {list.length ? null : <p className="dash-empty">Aucune conversation.</p>}
          {list.map((t) => (
            <button key={t.id} type="button" className={`support-row${openId === t.id ? ' on' : ''}${t.unread ? ' unread' : ''}`} onClick={() => setOpenId(t.id)}>
              <span className="support-row-top">
                <strong>{t.customerName}</strong>
                <small>{t.lastAt ? formatWhen(t.lastAt) : ''}</small>
              </span>
              <span className="support-row-body">
                <small>
                  {t.lastSenderKind === 'staff' ? 'Vous : ' : ''}
                  {t.lastBody ?? '—'}
                </small>
                {t.unread ? <span className="unread-badge">{t.unread}</span> : null}
              </span>
            </button>
          ))}
        </div>
        <div className="card support-thread">
          {!detail ? (
            <p className="dash-empty">Choisissez une conversation.</p>
          ) : (
            <>
              <div className="dash-card-head">
                <h3>
                  {detail.thread.customerName}
                  {detail.thread.customerPhone ? <small> · {detail.thread.customerPhone}</small> : null}
                </h3>
                {detail.thread.userId ? (
                  <Link to={`/clients/${encodeURIComponent(detail.thread.userId)}`} className="btn ghost sm">
                    Fiche client
                  </Link>
                ) : null}
              </div>
              {detail.orders.length ? (
                <div className="support-orders">
                  {detail.orders.map((o) => (
                    <Link key={o.id} to={`/commandes/${encodeURIComponent(o.id)}`} className="pill">
                      {o.id} · {ORDER_STATUS[o.status] ?? o.status}
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="chat-log">
                {detail.messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.senderKind === 'customer' ? 'them' : m.senderKind === 'system' ? 'sys' : 'us'}`}>
                    <div className="chat-bubble">{m.kind === 'image' ? '📷 Photo' : m.body}</div>
                    <small>
                      {m.senderKind === 'staff' ? `${m.senderName ?? 'Équipe'} · ` : ''}
                      {formatWhen(m.createdAt)}
                    </small>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              {detail.thread.disabled ? (
                <p className="warn-note">Le client a désactivé cette conversation.</p>
              ) : (
                <form
                  className="chat-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}>
                  <textarea
                    rows={2}
                    value={draft}
                    maxLength={4000}
                    placeholder="Répondre au client…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button type="submit" className="btn gold sm" disabled={sending || !draft.trim()}>
                    {sending ? 'Envoi…' : 'Envoyer'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
