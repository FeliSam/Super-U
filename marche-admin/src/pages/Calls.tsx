import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useStreamReload } from '@/lib/adminStream';
import { formatWhen } from '@/lib/orderLabels';

type CallRow = {
  id: string;
  threadKind: string | null;
  orderId: string | null;
  media: string;
  status: string;
  startedAt: string;
  durationS: number | null;
  missed: boolean;
  live: boolean;
  caller: { kind: string; name: string };
  callee: { kind: string; name: string };
};

const STATUS: Record<string, string> = {
  initiated: 'Appel en cours',
  ringing: 'Sonne',
  accepted: 'En communication',
  rejected: 'Refusé',
  canceled: 'Annulé',
  missed: 'Manqué',
  ended: 'Terminé',
  failed: 'Échec',
};

function duration(s: number | null) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

export function CallsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, missed: 0, live: 0 });
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api<{ calls: CallRow[]; counts: typeof counts }>(`/admin/calls?filter=${filter}`)
      .then((r) => {
        setCalls(r.calls);
        setCounts(r.counts);
        setErr('');
      })
      .catch((e: Error) => setErr(e.message));
  }, [filter]);
  useEffect(load, [load]);
  useStreamReload(['call.'], load);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Journal d’appels</h2>
          <p>Appels in-app (client ↔ coursier, client ↔ support). Mis à jour en direct.</p>
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="seg" style={{ marginBottom: 14 }}>
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
          Tous
        </button>
        <button type="button" className={filter === 'missed' ? 'on' : ''} onClick={() => setFilter('missed')}>
          Manqués{filter === 'all' && counts.missed ? ` (${counts.missed})` : ''}
        </button>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Quand</th>
              <th>Appelant</th>
              <th>Appelé</th>
              <th>Contexte</th>
              <th>Durée</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((k) => (
              <tr key={k.id} className={k.missed ? 'call-missed' : ''}>
                <td>{formatWhen(k.startedAt)}</td>
                <td>
                  <strong>{k.caller.name}</strong>
                  <small>{k.caller.kind === 'customer' ? 'Client' : 'Équipe'}</small>
                </td>
                <td>
                  <strong>{k.callee.name}</strong>
                  <small>{k.callee.kind === 'customer' ? 'Client' : 'Équipe'}</small>
                </td>
                <td>
                  {k.orderId ? <Link to={`/commandes/${encodeURIComponent(k.orderId)}`}>{k.orderId}</Link> : k.threadKind === 'support' ? 'Support' : '—'}
                  <small>{k.media === 'video' ? 'Vidéo' : 'Audio'}</small>
                </td>
                <td>{duration(k.durationS)}</td>
                <td>
                  <span className={`pill ${k.missed ? 'out' : k.live ? 'warn' : 'ok'}`}>{STATUS[k.status] ?? k.status}</span>
                </td>
              </tr>
            ))}
            {!calls.length ? (
              <tr>
                <td colSpan={6} className="dash-empty">
                  Aucun appel.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
