import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { needleOf, textMatch, useCachedResource } from '@/lib/cachedApi';
import { isPendingStaff, roleLabel, staffStatusLabel } from '@/lib/staffLabels';
import { useAppSelector } from '@/app/hooks';

export type HrStaff = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  canPick: boolean;
  canDeliver: boolean;
  storeId: string | null;
  vehicle: string | null;
  isActive: boolean;
  onboardStatus: string;
  lastSessionAt: string | null;
  courseGo: boolean;
};

export function PersonnelPage() {
  const me = useAppSelector((s) => s.auth.staff);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [onboard, setOnboard] = useState('');
  const { data: staffData, refresh } = useCachedResource<{ staff: HrStaff[] }>('staff', '/admin/staff', 'staff');
  const { data: storeData } = useCachedResource<{ stores: { id: string; payload: { name?: string } }[] }>(
    'stores',
    '/admin/stores',
    'catalog',
  );
  const allRows = staffData?.staff ?? [];
  const stores = storeData?.stores ?? [];
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const pendingCount = useMemo(() => allRows.filter(isPendingStaff).length, [allRows]);

  const activate = async (s: HrStaff) => {
    setErr('');
    setBusyId(s.id);
    try {
      await api(`/admin/staff/${s.id}/enable`, { method: 'POST' });
      await refresh(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Activation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => {
    const needle = needleOf(q);
    return allRows.filter((s) => {
      if (!textMatch(needle, s.firstName, s.lastName, s.email, s.phone)) return false;
      if (role && s.role !== role) return false;
      if (onboard === 'pending') return isPendingStaff(s);
      if (onboard === 'suspended' && (s.isActive || isPendingStaff(s))) return false;
      if (onboard && onboard !== 'suspended' && s.onboardStatus !== onboard) return false;
      return true;
    });
  }, [allRows, q, role, onboard]);

  const storeName = useMemo(() => {
    const m = new Map(stores.map((s) => [s.id, String(s.payload?.name ?? s.id)]));
    return (id: string | null) => (id ? m.get(id) || id : 'National');
  }, [stores]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Personnel</h2>
          <p>Annuaire des comptes magasin et CourseGO — jamais les clients boutique.</p>
        </div>
        {me?.canHr ? (
          <Link className="btn gold" to="/personnel/nouveau">
            <Plus size={16} /> Nouveau collaborateur
          </Link>
        ) : null}
      </div>
      {err ? <p className="err">{err}</p> : null}
      {pendingCount ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>
            {pendingCount} compte{pendingCount > 1 ? 's' : ''} CourseGO en attente de validation
          </strong>{' '}
          <button className="btn ghost sm" type="button" onClick={() => setOnboard('pending')}>
            Afficher
          </button>
        </div>
      ) : null}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <label className="field" style={{ flex: 2 }}>
            Recherche
            <span className="row" style={{ gap: 8 }}>
              <Search size={16} style={{ opacity: 0.5 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, téléphone" />
            </span>
          </label>
          <label className="field">
            Rôle
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Tous</option>
              {['coursier', 'picker', 'courier', 'manager', 'magasinier', 'admin', 'recruteur', 'dispatcher', 'support'].map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Onboarding
            <select value={onboard} onChange={(e) => setOnboard(e.target.value)}>
              <option value="">Tous</option>
              <option value="pending">En attente de validation</option>
              <option value="draft">Brouillon</option>
              <option value="invited">Invité</option>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={() => void refresh(true)}>
            Actualiser
          </button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'auto', padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Personne</th>
              <th>Rôle</th>
              <th>Magasin</th>
              <th>CourseGO</th>
              <th>Statut</th>
              <th>Dernière session</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/personnel/${s.id}`} style={{ fontWeight: 650 }}>
                    {s.firstName} {s.lastName}
                  </Link>
                  <div className="sku">{s.email}</div>
                </td>
                <td>{roleLabel(s.role)}</td>
                <td>{storeName(s.storeId)}</td>
                <td>
                  <span className={`pill${s.canPick ? ' ok' : ''}`}>{s.canPick ? 'Ramasse' : '—'}</span>{' '}
                  <span className={`pill${s.canDeliver ? ' ok' : ''}`}>{s.canDeliver ? 'Livre' : '—'}</span>
                </td>
                <td>
                  <span className={`pill${s.isActive ? ' ok' : isPendingStaff(s) ? '' : ' out'}`}>{staffStatusLabel(s)}</span>
                  {isPendingStaff(s) && me?.canHr ? (
                    <>
                      {' '}
                      <button
                        className="btn gold sm"
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void activate(s)}>
                        {busyId === s.id ? '…' : 'Activer'}
                      </button>
                    </>
                  ) : null}
                </td>
                <td className="sku">
                  {s.lastSessionAt ? new Date(s.lastSessionAt).toLocaleString('fr-FR') : 'Jamais'}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)', padding: 24 }}>
                  Personne pour ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
