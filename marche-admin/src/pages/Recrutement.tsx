import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useLiveSync } from '@/lib/live';
import { isPendingStaff, roleLabel } from '@/lib/staffLabels';
import { useAppSelector } from '@/app/hooks';
import type { HrStaff } from '@/pages/Personnel';

export function RecrutementPage() {
  const me = useAppSelector((s) => s.auth.staff);
  const [rows, setRows] = useState<HrStaff[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ staff: HrStaff[] }>('/admin/staff?onboard=draft,invited')
      .then((r) => setRows(r.staff))
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(load, true, 'staff');

  const activate = async (s: HrStaff) => {
    setErr('');
    setMsg('');
    setBusyId(s.id);
    try {
      await api(`/admin/staff/${s.id}/enable`, { method: 'POST' });
      setMsg(`${s.firstName} ${s.lastName} est activé(e) : connexion CourseGO possible.`);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Activation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = rows.filter(isPendingStaff).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Recrutement</h2>
          <p>
            Inscriptions CourseGO et fiches en attente d’activation. Un compte en attente ne peut pas se connecter
            tant qu’il n’est pas activé.
          </p>
        </div>
        <Link className="btn gold" to="/personnel/nouveau">
          Nouvelle fiche
        </Link>
      </div>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="pill ok">{msg}</p> : null}
      {pendingCount ? (
        <p style={{ color: 'var(--muted)' }}>
          {pendingCount} compte{pendingCount > 1 ? 's' : ''} en attente de validation.
        </p>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {rows.map((s) => (
          <div key={s.id} className="card">
            <Link to={`/personnel/${s.id}`} style={{ display: 'block' }}>
              <p className="pill">
                {s.onboardStatus === 'draft' ? 'Inscription / brouillon' : 'Invité'} · en attente
              </p>
              <h3 style={{ margin: '10px 0 4px' }}>
                {s.firstName} {s.lastName}
              </h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                {roleLabel(s.role)}
                <br />
                {s.email}
                {s.phone ? (
                  <>
                    <br />
                    {s.phone}
                  </>
                ) : null}
              </p>
            </Link>
            {me?.canHr ? (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn gold" type="button" disabled={busyId === s.id} onClick={() => void activate(s)}>
                  {busyId === s.id ? 'Activation…' : 'Activer'}
                </button>
                <Link className="btn ghost" to={`/personnel/${s.id}`}>
                  Voir la fiche
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {!rows.length && !err ? (
        <p style={{ color: 'var(--muted)' }}>File vide — tout le monde est actif, ou pas encore de candidat.</p>
      ) : null}
    </>
  );
}
