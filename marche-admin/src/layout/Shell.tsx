import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Tags,
  Sparkles,
  Grid3x3,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { logout } from '@/features/auth/authSlice';
import { applyTheme, toggleTheme } from '@/features/ui/uiSlice';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useEffect } from 'react';

const links = [
  { to: '/', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { to: '/produits', label: 'Catalogue', icon: Package },
  { to: '/stock', label: 'Stocks', icon: Warehouse },
  { to: '/promotions', label: 'Promotions', icon: Tags },
  { to: '/vitrine', label: 'Populaires & tendances', icon: Sparkles },
  { to: '/rayons', label: 'Rayons', icon: Grid3x3 },
];

export function Shell() {
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const staff = useAppSelector((s) => s.auth.staff);
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    dispatch(applyTheme());
  }, [dispatch, theme]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Marché Admin</h1>
            <p>Catalogue · stock · vitrine</p>
          </div>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <l.icon size={18} />
            {l.label}
          </NavLink>
        ))}
        <div className="side-foot">
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '0 8px 8px' }}>
            {staff?.firstName} {staff?.lastName}
            <br />
            {staff?.role} · {staff?.storeId || 'tous magasins'}
          </div>
          <button className="btn ghost" type="button" onClick={() => dispatch(toggleTheme())}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Clair' : 'Sombre'}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              dispatch(logout());
              nav('/login');
            }}>
            <LogOut size={16} />
            Sortir
          </button>
        </div>
      </aside>
      <main className="main">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
