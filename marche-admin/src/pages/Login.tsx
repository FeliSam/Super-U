import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '@/features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '@/app/hooks';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const { status, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('admin@marchedore.bj');
  const [password, setPassword] = useState('marche2024');

  return (
    <div className="login-wrap">
      <form
        className="card login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await dispatch(loginAdmin({ email, password }));
          if (loginAdmin.fulfilled.match(res)) nav('/');
        }}>
        <p className="pill">Back-office magasin</p>
        <h2>Marché Admin</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>Catalogue, stocks et personnel — même base que la boutique, comptes ops.staff.</p>
        <label className="field">
          E-mail staff
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="field" style={{ marginTop: 10 }}>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={status === 'loading'}>
          {status === 'loading' ? 'Entrée…' : 'Entrer dans le magasin'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
          Compte démo admin@marchedore.bj · RH rh@marchedore.bj / marche2024. Le login client boutique ne fonctionne pas ici.
        </p>
      </form>
    </div>
  );
}
