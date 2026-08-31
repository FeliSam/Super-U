import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { ROLE_HELP, roleLabel } from '@/lib/staffLabels';
import { useAppSelector } from '@/app/hooks';

const STEPS = ['Identité', 'Rôle & magasin', 'Accès'];

export function PersonnelNewPage() {
  const nav = useNavigate();
  const me = useAppSelector((s) => s.auth.staff);
  const recruiterOnly = me?.role === 'recruteur';
  const roles = recruiterOnly
    ? ['coursier', 'picker', 'courier']
    : ['coursier', 'picker', 'courier', 'dispatcher', 'manager', 'magasinier', 'admin', 'recruteur', 'support'];
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [stores, setStores] = useState<{ id: string; payload: { name?: string } }[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'coursier',
    storeId: 'su-aeroport',
    vehicle: 'moto',
    temporaryPassword: '',
    notes: '',
  });
  const [created, setCreated] = useState<{ id: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    api<{ stores: { id: string; payload: { name?: string } }[] }>('/admin/stores')
      .then((r) => setStores(r.stores))
      .catch(() => undefined);
  }, []);

  const courseGo = form.role === 'coursier' || form.role === 'picker' || form.role === 'courier';
  const storeName = stores.find((s) => s.id === form.storeId)?.payload?.name ?? form.storeId;

  const submit = async () => {
    setErr('');
    try {
      const r = await api<{ staff: { id: string }; temporaryPassword: string }>('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          activateNow: me?.role === 'admin',
        }),
      });
      setCreated({ id: r.staff.id, temporaryPassword: r.temporaryPassword });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Création impossible.');
    }
  };

  if (created) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="pill ok">Compte créé</p>
        <h2>Bienvenue dans l’équipe</h2>
        <p>
          Mot de passe temporaire à transmettre de vive voix ou par SMS : <strong>{created.temporaryPassword}</strong>
        </p>
        <p style={{ color: 'var(--muted)' }}>
          {me?.role === 'admin'
            ? 'Le compte est actif. CourseGO demandera de changer le mot de passe à la première connexion.'
            : 'Statut invité : un manager ou un admin activera le compte avant la première course.'}
        </p>
        <button className="btn gold" type="button" onClick={() => nav(`/personnel/${created.id}`)}>
          Ouvrir la fiche
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Nouveau collaborateur</h2>
          <p>Trois étapes, un compte ops.staff — jamais un client boutique.</p>
        </div>
      </div>
      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <button key={label} type="button" className={`wizard-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} onClick={() => setStep(i)}>
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
      {err ? <p className="err">{err}</p> : null}
      <AnimatePresence mode="wait">
        <motion.div key={step} className="card" style={{ maxWidth: 640 }} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          {step === 0 ? (
            <div className="form-grid">
              <label className="field">
                Prénom
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </label>
              <label className="field">
                Nom
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </label>
              <label className="field">
                E-mail staff
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="prenom@marchedore.bj" />
              </label>
              <label className="field">
                Téléphone Bénin
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01 40 00 00 00" />
              </label>
            </div>
          ) : null}
          {step === 1 ? (
            <>
              <label className="field">
                Rôle
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>{ROLE_HELP[form.role]}</p>
              <label className="field" style={{ marginTop: 10 }}>
                Magasin Super U
                <select value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {String(s.payload?.name ?? s.id)}
                    </option>
                  ))}
                </select>
              </label>
              {form.role === 'courier' || form.role === 'coursier' ? (
                <label className="field" style={{ marginTop: 10 }}>
                  Véhicule
                  <select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                    <option value="moto">Moto</option>
                    <option value="voiture">Voiture</option>
                    <option value="velo">Vélo</option>
                    <option value="pied">À pied</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label className="field">
                Mot de passe temporaire (optionnel)
                <input
                  value={form.temporaryPassword}
                  onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                  placeholder="Généré automatiquement si vide"
                />
              </label>
              <label className="field" style={{ marginTop: 10 }}>
                Notes
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <div className="card" style={{ marginTop: 16, background: 'var(--bg)' }}>
                <strong>Récap</strong>
                <p>
                  {form.firstName} {form.lastName} · {roleLabel(form.role)}
                  <br />
                  {storeName} · {form.email} · {form.phone}
                  <br />
                  Pourra se connecter à CourseGO : <strong>{courseGo ? 'oui' : 'non'}</strong>
                </p>
              </div>
            </>
          ) : null}
          <div className="row" style={{ marginTop: 18 }}>
            {step > 0 ? (
              <button className="btn ghost" type="button" onClick={() => setStep(step - 1)}>
                Retour
              </button>
            ) : null}
            {step < 2 ? (
              <button className="btn gold" type="button" onClick={() => setStep(step + 1)}>
                Continuer
              </button>
            ) : (
              <button className="btn gold" type="button" onClick={() => void submit()}>
                Créer le compte
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
