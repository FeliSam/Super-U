import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/staffLabels';
import type { HrStaff } from '@/pages/Personnel';

export function RecrutementPage() {
  const [rows, setRows] = useState<HrStaff[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ staff: HrStaff[] }>('/admin/staff?onboard=draft,invited')
      .then((r) => setRows(r.staff))
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Recrutement</h2>
          <p>Fiches encore en brouillon ou en attente d’activation par un manager.</p>
        </div>
        <Link className="btn gold" to="/personnel/nouveau">
          Nouvelle fiche
        </Link>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {rows.map((s) => (
          <Link key={s.id} to={`/personnel/${s.id}`} className="card" style={{ display: 'block' }}>
            <p className="pill">{s.onboardStatus === 'draft' ? 'Brouillon' : 'Invité'}</p>
            <h3 style={{ margin: '10px 0 4px' }}>
              {s.firstName} {s.lastName}
            </h3>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              {roleLabel(s.role)}
              <br />
              {s.email}
            </p>
          </Link>
        ))}
      </div>
      {!rows.length && !err ? (
        <p style={{ color: 'var(--muted)' }}>File vide — tout le monde est actif, ou pas encore de candidat.</p>
      ) : null}
    </>
  );
}
