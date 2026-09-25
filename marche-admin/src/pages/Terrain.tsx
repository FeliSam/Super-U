import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Bike, MessageSquare, Star, Wallet, X } from 'lucide-react';
import { api, formatFcfa } from '@/lib/api';
import { useCachedResource } from '@/lib/cachedApi';
import { DELIVERY_STATUS, PICK_STATUS, formatWhen } from '@/lib/orderLabels';
import { roleLabel } from '@/lib/staffLabels';

type Mission = {
  id: string | null;
  orderId: string | null;
  status: string | null;
  address: string | null;
  storeName: string | null;
  customerName: string | null;
};

type FloorStaff = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  canPick: boolean;
  canDeliver: boolean;
  storeId: string | null;
  vehicle: string | null;
  phone: string;
  presence: 'online' | 'paused' | 'offline' | string;
  lastSeenAt: string | null;
  pick: Mission | null;
  delivery: Mission | null;
  today: { picks: number; deliveries: number; tips: number; ratingAvg: number; ratingCount: number };
};

type QueueRow = {
  kind: string;
  id: string;
  orderId: string;
  status: string;
  storeName: string | null;
  address: string | null;
  customerName: string | null;
  itemCount: number;
  createdAt: string;
};

type RatingRow = {
  id: string;
  orderId: string;
  rating: number;
  comment: string;
  tipAmount: number;
  createdAt: string;
  customerName: string | null;
  staffName: string | null;
};

type Floor = {
  kpis: {
    online: number;
    paused: number;
    offline: number;
    picking: number;
    delivering: number;
    queue: number;
    tipsToday: number;
  };
  staff: FloorStaff[];
  queue: QueueRow[];
  ratings: RatingRow[];
};

type WindowId = 'hour' | 'day' | 'week' | 'month';

type StaffBoard = {
  window: WindowId;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    canPick: boolean;
    canDeliver: boolean;
    storeId: string | null;
    vehicle: string | null;
    phone: string;
    email: string;
    lastSeenAt: string | null;
    dutyStatus: string;
  };
  stats: {
    picks: number;
    deliveriesOk: number;
    deliveriesFail: number;
    orders: number;
    pickMinutes: number;
    deliveryMinutes: number;
    onlineMinutes: number;
    earnPick: number;
    earnDeliver: number;
    earnTip: number;
    ratingAvg: number;
    ratingCount: number;
  };
  ratings: {
    id: string;
    orderId: string;
    rating: number;
    comment: string;
    tipAmount: number;
    createdAt: string;
    customerName: string | null;
  }[];
  missions: { kind: string; orderId: string; status: string; at: string; amount: number }[];
};

type SortKey = 'name' | 'status' | 'mission' | 'today';

const PRESENCE: Record<string, { label: string; cls: string; rank: number }> = {
  online: { label: 'En ligne', cls: 'ok', rank: 0 },
  paused: { label: 'En pause', cls: 'warn', rank: 1 },
  offline: { label: 'Hors ligne', cls: 'out', rank: 2 },
};

const COLS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Collaborateur' },
  { key: 'status', label: 'Statut' },
  { key: 'mission', label: 'Mission' },
  { key: 'today', label: 'Aujourd’hui' },
];

function actionLine(s: FloorStaff) {
  if (s.pick) {
    const st = PICK_STATUS[s.pick.status ?? ''] ?? s.pick.status;
    const who = s.pick.customerName || s.pick.orderId;
    return `Ramasse ${who ?? ''} · ${st}`;
  }
  if (s.delivery) {
    const st = DELIVERY_STATUS[s.delivery.status ?? ''] ?? s.delivery.status;
    const who = s.delivery.customerName || s.delivery.orderId;
    const where = s.delivery.address ? ` → ${s.delivery.address}` : '';
    return `Livre ${who ?? ''}${where} · ${st}`;
  }
  if (s.presence === 'paused') return 'Radar fermé — en pause';
  if (s.presence === 'online') return 'Disponible, en attente de course';
  return s.lastSeenAt ? `Vu ${formatWhen(s.lastSeenAt)}` : 'Pas de session CourseGO récente';
}

function stars(n: number) {
  const r = Math.round(n);
  return '★'.repeat(Math.max(0, Math.min(5, r))) + '☆'.repeat(Math.max(0, 5 - r));
}

function formatMinutes(min: number) {
  if (!min) return '0 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function missionStatusLabel(kind: string, status: string) {
  if (kind === 'ramassage') return PICK_STATUS[status] ?? status;
  return DELIVERY_STATUS[status] ?? status;
}

export function TerrainPage() {
  const { data } = useCachedResource<Floor>('floor', '/admin/floor', 'floor');
  const [filter, setFilter] = useState<'all' | 'live' | 'paused' | 'offline'>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<StaffBoard | null>(null);
  const [boardErr, setBoardErr] = useState('');
  const [win, setWin] = useState<WindowId>('day');
  const err = '';

  const loadBoard = useCallback((id: string, windowId: WindowId) => {
    setBoardErr('');
    api<StaffBoard>(`/admin/floor/staff/${encodeURIComponent(id)}?window=${windowId}`)
      .then(setBoard)
      .catch((e: Error) => setBoardErr(e.message));
  }, []);

  useEffect(() => {
    if (!openId) {
      setBoard(null);
      return;
    }
    loadBoard(openId, win);
  }, [openId, win, loadBoard]);

  const extras = useMemo(() => {
    const list = data?.staff ?? [];
    const picks = list.reduce((a, s) => a + s.today.picks, 0);
    const dels = list.reduce((a, s) => a + s.today.deliveries, 0);
    const rated = list.filter((s) => s.today.ratingCount > 0);
    const avg =
      rated.reduce((a, s) => a + s.today.ratingAvg * s.today.ratingCount, 0) /
      Math.max(1, rated.reduce((a, s) => a + s.today.ratingCount, 0));
    return { picks, dels, avg: rated.length ? avg : 0, rated: rated.reduce((a, s) => a + s.today.ratingCount, 0) };
  }, [data]);

  const visible = useMemo(() => {
    let list = data?.staff ?? [];
    if (filter === 'live') list = list.filter((s) => s.presence === 'online' || s.pick || s.delivery);
    if (filter === 'paused') list = list.filter((s) => s.presence === 'paused');
    if (filter === 'offline') list = list.filter((s) => s.presence === 'offline');
    if (!sortKey) return list;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let delta = 0;
      if (sortKey === 'name') {
        delta = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr', { sensitivity: 'base' });
      } else if (sortKey === 'status') {
        delta = (PRESENCE[a.presence]?.rank ?? 9) - (PRESENCE[b.presence]?.rank ?? 9);
      } else if (sortKey === 'mission') {
        delta = actionLine(a).localeCompare(actionLine(b), 'fr', { sensitivity: 'base' });
      } else {
        delta = a.today.picks + a.today.deliveries - (b.today.picks + b.today.deliveries);
      }
      return delta * dir;
    });
  }, [data, filter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'today' ? 'desc' : 'asc');
    }
  };

  const st = board?.stats;
  const earned = st ? st.earnPick + st.earnDeliver + st.earnTip : 0;
  const successRate =
    st && st.deliveriesOk + st.deliveriesFail > 0
      ? Math.round((st.deliveriesOk / (st.deliveriesOk + st.deliveriesFail)) * 100)
      : null;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Terrain</h2>
          <p>
            Vue live CourseGO : présence radar, missions en cours, file à assigner. Cliquez un collaborateur pour son
            tableau de bord (commandes, gains, avis, temps en ligne).
          </p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="k">En ligne</div>
          <div className="v">{data?.kpis.online ?? '—'}</div>
          <small>Radar CourseGO ouvert (ping &lt; 45 s).</small>
        </div>
        <div className="card stat">
          <div className="k">En pause</div>
          <div className="v">{data?.kpis.paused ?? '—'}</div>
          <small>Connectés mais radar fermé — pas de nouvelle course.</small>
        </div>
        <div className="card stat">
          <div className="k">Hors ligne</div>
          <div className="v">{data?.kpis.offline ?? '—'}</div>
          <small>Pas de session récente sur l’app terrain.</small>
        </div>
        <div className="card stat">
          <div className="k">En ramassage</div>
          <div className="v">{data?.kpis.picking ?? '—'}</div>
          <small>Scan / constitution du colis en magasin.</small>
        </div>
        <div className="card stat">
          <div className="k">En livraison</div>
          <div className="v">{data?.kpis.delivering ?? '—'}</div>
          <small>Course acceptée, pas encore remise au client.</small>
        </div>
        <div className="card stat">
          <div className="k">File à pourvoir</div>
          <div className="v">{data?.kpis.queue ?? '—'}</div>
          <small>Commandes sans ramasseur ou sans coursier.</small>
        </div>
        <div className="card stat">
          <div className="k">Ramassages du jour</div>
          <div className="v">{extras.picks}</div>
          <small>Colis marqués prêts (payout ramassage).</small>
        </div>
        <div className="card stat">
          <div className="k">Livraisons du jour</div>
          <div className="v">{extras.dels}</div>
          <small>Remises confirmées (code client).</small>
        </div>
        <div className="card stat">
          <div className="k">Pourboires du jour</div>
          <div className="v">{data ? formatFcfa(data.kpis.tipsToday) : '—'}</div>
          <small>Versés avec l’avis boutique après livraison.</small>
        </div>
        <div className="card stat">
          <div className="k">Note moyenne</div>
          <div className="v">{extras.rated ? extras.avg.toFixed(1) : '—'}</div>
          <small>{extras.rated ? `${extras.rated} avis clients` : 'Pas encore d’avis.'}</small>
        </div>
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        {(
          [
            ['all', 'Toute l’équipe'],
            ['live', 'En action'],
            ['paused', 'Pause'],
            ['offline', 'Hors ligne'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="floor-split">
        <div className="card table-card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                {COLS.map((c) => {
                  const on = sortKey === c.key;
                  const Icon = !on ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th key={c.key} aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => toggleSort(c.key)}>
                        {c.label}
                        <Icon size={14} strokeWidth={2.2} aria-hidden />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const p = PRESENCE[s.presence] ?? PRESENCE.offline;
                const orderId = s.pick?.orderId || s.delivery?.orderId;
                return (
                  <tr
                    key={s.id}
                    className={`row-link${openId === s.id ? ' on' : ''}`}
                    onClick={() => setOpenId(s.id)}
                  >
                    <td>
                      <strong>
                        {s.firstName} {s.lastName}
                      </strong>
                      <small>
                        {roleLabel(s.role)}
                        {s.vehicle ? ` · ${s.vehicle}` : ''}
                        {s.storeId ? ` · ${s.storeId}` : ''}
                      </small>
                    </td>
                    <td>
                      <span className={`pill ${p.cls}`}>{p.label}</span>
                    </td>
                    <td>
                      {actionLine(s)}
                      {orderId ? (
                        <small>
                          <Link to={`/commandes/${encodeURIComponent(orderId)}`} onClick={(e) => e.stopPropagation()}>
                            Commande {orderId.slice(0, 8)}…
                          </Link>
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <small>
                        {s.today.picks} ramass. · {s.today.deliveries} livr.
                        {s.today.tips ? ` · ${formatFcfa(s.today.tips)} pourboires` : ''}
                        {s.today.ratingCount ? ` · ${s.today.ratingAvg.toFixed(1)}/5 (${s.today.ratingCount})` : ''}
                      </small>
                    </td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--muted)', padding: 24 }}>
                    Aucun staff terrain pour ce filtre. Les comptes boutique et RH n’apparaissent pas ici.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card">
            <div className="dash-card-head">
              <Bike size={16} />
              <h3>File à pourvoir</h3>
            </div>
            <p className="hint-line">Commandes sans personne assignée — à donner depuis CourseGO.</p>
            <ul className="dash-list">
              {(data?.queue ?? []).map((q) => (
                <li key={`${q.kind}-${q.id}`}>
                  <span>
                    {q.kind === 'pick' ? 'Ramassage' : 'Livraison'} · {q.customerName || q.orderId}
                    <small style={{ display: 'block' }}>{q.address || q.storeName || '—'}</small>
                  </span>
                  <Link to={`/commandes/${encodeURIComponent(q.orderId)}`}>ouvrir</Link>
                </li>
              ))}
              {!data?.queue.length ? <li style={{ color: 'var(--muted)' }}>Rien en attente d’assignation.</li> : null}
            </ul>
          </div>

          <div className="card">
            <div className="dash-card-head">
              <Star size={16} />
              <h3>Avis clients</h3>
            </div>
            <p className="hint-line">Notes laissées dans Marché Doré après une remise.</p>
            <ul className="dash-list">
              {(data?.ratings ?? []).map((r) => (
                <li key={r.id} style={{ alignItems: 'flex-start' }}>
                  <span>
                    <strong>{stars(r.rating)}</strong> {r.staffName || 'Coursier'}
                    <small style={{ display: 'block' }}>
                      {r.customerName || 'Client'} · {formatWhen(r.createdAt)}
                      {r.comment ? ` — ${r.comment}` : ''}
                    </small>
                  </span>
                  {r.tipAmount > 0 ? <strong>{formatFcfa(r.tipAmount)}</strong> : <MessageSquare size={14} />}
                </li>
              ))}
              {!data?.ratings.length ? (
                <li style={{ color: 'var(--muted)' }}>Pas encore d’avis depuis l’app boutique.</li>
              ) : null}
            </ul>
          </div>

          <div className="card">
            <div className="dash-card-head">
              <Wallet size={16} />
              <h3>Pourboires</h3>
            </div>
            <p className="dash-empty" style={{ margin: 0 }}>
              Total du jour : <strong>{data ? formatFcfa(data.kpis.tipsToday) : '—'}</strong>. Un pourboire n’est
              enregistré qu’avec un avis client après livraison réussie.
            </p>
          </div>
        </div>
      </div>

      {openId ? (
        <div className="card staff-board" style={{ marginTop: 16 }}>
          <div className="dash-card-head">
            <h3>
              {board ? `${board.staff.firstName} ${board.staff.lastName}` : 'Tableau de bord'}
            </h3>
            <button type="button" className="icon-btn" onClick={() => setOpenId(null)} aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          {board ? (
            <p className="hint-line">
              {roleLabel(board.staff.role)}
              {board.staff.vehicle ? ` · ${board.staff.vehicle}` : ''}
              {board.staff.storeId ? ` · ${board.staff.storeId}` : ''}
              {board.staff.phone ? ` · ${board.staff.phone}` : ''}
              {board.staff.lastSeenAt ? ` · vu ${formatWhen(board.staff.lastSeenAt)}` : ''}
            </p>
          ) : null}

          <div className="seg" style={{ margin: '12px 0 16px' }}>
            {(
              [
                ['hour', 'Dernière heure'],
                ['day', 'Aujourd’hui'],
                ['week', '7 jours'],
                ['month', '30 jours'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={win === id ? 'on' : ''} onClick={() => setWin(id)}>
                {label}
              </button>
            ))}
          </div>

          {boardErr ? <p className="err">{boardErr}</p> : null}
          {!board && !boardErr ? <p className="hint-line">Chargement du tableau de bord…</p> : null}

          {st ? (
            <>
              <div className="grid stats staff-stats">
                <div className="card stat">
                  <div className="k">Commandes</div>
                  <div className="v">{st.orders}</div>
                  <small>Ramassages ou livraisons distincts sur la période.</small>
                </div>
                <div className="card stat">
                  <div className="k">Ramassages</div>
                  <div className="v">{st.picks}</div>
                  <small>Colis marqués prêts · {formatMinutes(st.pickMinutes)} de magasin.</small>
                </div>
                <div className="card stat">
                  <div className="k">Livrées</div>
                  <div className="v">{st.deliveriesOk}</div>
                  <small>Remises avec code · {formatMinutes(st.deliveryMinutes)} de course.</small>
                </div>
                <div className="card stat">
                  <div className="k">Échecs</div>
                  <div className="v">{st.deliveriesFail}</div>
                  <small>Incidents client / accès / colis.</small>
                </div>
                <div className="card stat">
                  <div className="k">Succès</div>
                  <div className="v">{successRate == null ? '—' : `${successRate} %`}</div>
                  <small>Livrées / (livrées + échecs).</small>
                </div>
                <div className="card stat">
                  <div className="k">Temps en ligne</div>
                  <div className="v">{formatMinutes(st.onlineMinutes)}</div>
                  <small>Minutes radar (pings GPS / présence), sinon temps de mission.</small>
                </div>
                <div className="card stat">
                  <div className="k">Gains</div>
                  <div className="v">{formatFcfa(earned)}</div>
                  <small>
                    Ramass. {formatFcfa(st.earnPick)} · livr. {formatFcfa(st.earnDeliver)} · pourboires{' '}
                    {formatFcfa(st.earnTip)}
                  </small>
                </div>
                <div className="card stat">
                  <div className="k">Avis</div>
                  <div className="v">{st.ratingCount ? st.ratingAvg.toFixed(1) : '—'}</div>
                  <small>{st.ratingCount ? `${st.ratingCount} notes clients` : 'Aucun avis sur la période.'}</small>
                </div>
              </div>

              <div className="staff-board-split">
                <div>
                  <h4>Missions</h4>
                  <ul className="dash-list">
                    {board.missions.map((m) => (
                      <li key={`${m.kind}-${m.orderId}-${m.at}`}>
                        <span>
                          {m.kind === 'ramassage' ? 'Ramassage' : 'Livraison'} · {missionStatusLabel(m.kind, m.status)}
                          <small style={{ display: 'block' }}>
                            {formatWhen(m.at)} · {m.orderId.slice(0, 10)}…
                          </small>
                        </span>
                        <span>
                          {m.amount ? formatFcfa(m.amount) : ''}
                          <Link to={`/commandes/${encodeURIComponent(m.orderId)}`}>ouvrir</Link>
                        </span>
                      </li>
                    ))}
                    {!board.missions.length ? <li style={{ color: 'var(--muted)' }}>Aucune mission sur cette période.</li> : null}
                  </ul>
                </div>
                <div>
                  <h4>Avis</h4>
                  <ul className="dash-list">
                    {board.ratings.map((r) => (
                      <li key={r.id} style={{ alignItems: 'flex-start' }}>
                        <span>
                          <strong>{stars(r.rating)}</strong> {r.customerName || 'Client'}
                          <small style={{ display: 'block' }}>
                            {formatWhen(r.createdAt)}
                            {r.comment ? ` — ${r.comment}` : ''}
                          </small>
                        </span>
                        {r.tipAmount > 0 ? <strong>{formatFcfa(r.tipAmount)}</strong> : null}
                      </li>
                    ))}
                    {!board.ratings.length ? <li style={{ color: 'var(--muted)' }}>Pas d’avis sur cette période.</li> : null}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
