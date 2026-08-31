import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { ONBOARD_LABELS, ROLE_HELP, roleLabel } from '@/lib/staffLabels';
import { useAppSelector } from '@/app/hooks';
import type { HrStaff } from '@/pages/Personnel';

type Doc = { id: string; kind: string; label: string | null; urlOrPath: string | null; verifiedAt: string | null };

export function PersonnelDetailPage() {
  const { id } = useParams();
  const me = useAppSelector((s) => s.auth.staff);
  const [staff, setStaff] = useState<(HrStaff & { notes?: string | null; documents?: Doc[] }) | null>(null);
  const [stores, setStores] = useState<{ id: string; payload: { name?: string } }[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [tempPwd, setTempPwd] = useState('');
  const [docKind, setDocKind] = useState('cip');
  const [docLabel, setDocLabel] = useState('');

  const load = () => {
    if (!id) return;
    api<{ staff: HrStaff & { notes?: string | null; documents?: Doc[] } }>(`/admin/staff/${id}`)
      .then((r) => setStaff(r.staff))
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
    api<{ stores: { id: string; payload: { name?: string } }[] }>('/admin/stores')
      .then((r) => setStores(r.stores))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!staff) return <p style={{ padding: 24 }}>{err || 'Chargement…'}</p>;

  const save = async () => {
    setErr('');
    setMsg('');
    try {
      const r = await api<{ staff: HrStaff }>(`/admin/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          storeId: staff.storeId,
          vehicle: staff.vehicle,
          notes: staff.notes,
        }),
      });
      setStaff({ ...staff, ...r.staff });
      setMsg('Fiche enregistrée.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const act = async (path: string) => {
    setErr('');
    try {
      const r = await api<{ staff?: HrStaff; temporaryPassword?: string }>(`/admin/staff/${staff.id}/${path}`, {
        method: 'POST',
        body: path === 'reset-password' ? JSON.stringify({}) : undefined,
      });
      if (r.temporaryPassword) setTempPwd(r.temporaryPassword);
      load();
      setMsg(path === 'disable' ? 'Compte suspendu, sessions révoquées.' : path === 'enable' ? 'Compte réactivé.' : 'Mot de passe temporaire généré.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const addDoc = async () => {
    try {
      await api(`/admin/staff/${staff.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({ kind: docKind, label: docLabel, verified: true }),
      });
      setDocLabel('');
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const fieldLocked = staff.role === 'coursier' || staff.role === 'picker' || staff.role === 'courier';

  return (
    <>
      <div className="topbar">
        <div>
          <p className="pill">{roleLabel(staff.role)}</p>
          <h2>
            {staff.firstName} {staff.lastName}
          </h2>
          <p>
            {staff.email} · {staff.phone}
          </p>
        </div>
        <Link className="btn ghost" to="/personnel">
          Annuaire
        </Link>
      </div>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="pill ok">{msg}</p> : null}
      {tempPwd ? (
        <div className="card" style={{ marginBottom: 16 }}>
          Mot de passe temporaire à communiquer une seule fois : <strong>{tempPwd}</strong>
        </div>
      ) : null}

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Identité</h3>
          <label className="field">
            Prénom
            <input value={staff.firstName} onChange={(e) => setStaff({ ...staff, firstName: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            Nom
            <input value={staff.lastName} onChange={(e) => setStaff({ ...staff, lastName: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            E-mail
            <input value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            Téléphone
            <input value={staff.phone} onChange={(e) => setStaff({ ...staff, phone: e.target.value })} />
          </label>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Rôle & magasin</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{ROLE_HELP[staff.role]}</p>
          <label className="field">
            Rôle
            <select value={staff.role} onChange={(e) => setStaff({ ...staff, role: e.target.value })}>
              {['coursier', 'picker', 'courier', 'dispatcher', 'manager', 'magasinier', 'admin', 'recruteur', 'support'].map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            Magasin
            <select value={staff.storeId ?? ''} onChange={(e) => setStaff({ ...staff, storeId: e.target.value || null })}>
              <option value="">National</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.payload?.name ?? s.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            Véhicule
            <select
              value={staff.vehicle ?? ''}
              onChange={(e) => setStaff({ ...staff, vehicle: e.target.value || null })}
              disabled={!fieldLocked || staff.role === 'picker'}>
              <option value="">Aucun</option>
              <option value="moto">Moto</option>
              <option value="voiture">Voiture</option>
              <option value="velo">Vélo</option>
              <option value="pied">À pied</option>
            </select>
          </label>
          <div className="row" style={{ marginTop: 14 }}>
            <span className={`pill${staff.canPick ? ' ok' : ''}`}>Ramassage {staff.canPick ? 'oui' : 'non'}</span>
            <span className={`pill${staff.canDeliver ? ' ok' : ''}`}>Livraison {staff.canDeliver ? 'oui' : 'non'}</span>
            <span className={`pill${staff.isActive ? ' ok' : ' out'}`}>{ONBOARD_LABELS[staff.onboardStatus]}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Les flags ramassage / livraison sont imposés par le rôle. CourseGO : {staff.canPick || staff.canDeliver ? 'oui' : 'non'}.
          </p>
          <label className="field" style={{ marginTop: 10 }}>
            Notes internes
            <textarea value={staff.notes ?? ''} onChange={(e) => setStaff({ ...staff, notes: e.target.value })} />
          </label>
        </div>
      </div>

      {me?.canHr ? (
        <div className="row" style={{ marginBottom: 20 }}>
          <button className="btn gold" type="button" onClick={() => void save()}>
            Enregistrer
          </button>
          {staff.isActive ? (
            <button className="btn danger" type="button" onClick={() => void act('disable')}>
              Suspendre
            </button>
          ) : (
            <button className="btn" type="button" onClick={() => void act('enable')}>
              Réactiver
            </button>
          )}
          <button className="btn ghost" type="button" onClick={() => void act('reset-password')}>
            Reset mot de passe
          </button>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Documents</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(staff.documents ?? []).map((d) => (
            <li key={d.id}>
              {d.kind} {d.label ? `· ${d.label}` : ''} {d.verifiedAt ? '· vérifié' : ''}
            </li>
          ))}
          {!(staff.documents ?? []).length ? <li style={{ color: 'var(--muted)' }}>Aucun document encore.</li> : null}
        </ul>
        {me?.canHr ? (
          <div className="row" style={{ marginTop: 12 }}>
            <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
              <option value="cip">CIP</option>
              <option value="permis">Permis</option>
              <option value="photo">Photo</option>
              <option value="contrat">Contrat</option>
              <option value="autre">Autre</option>
            </select>
            <input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="Libellé" />
            <button className="btn ghost" type="button" onClick={() => void addDoc()}>
              Marquer reçu
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
