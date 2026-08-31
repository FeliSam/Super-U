import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Tags,
  Sparkles,
  Grid3x3,
  ShoppingBag,
  Users,
  UserPlus,
  Shield,
  Moon,
  Sun,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { logout } from '@/features/auth/authSlice';
import { applyTheme, toggleTheme } from '@/features/ui/uiSlice';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useEffect, useMemo, useState } from 'react';
import { roleLabel } from '@/lib/staffLabels';

const SIDE_KEY = 'marche-admin-sidebar';

function readCollapsed() {
  try {
    return localStorage.getItem(SIDE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function initials(first?: string, last?: string) {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || '?';
}

export function Shell() {
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const staff = useAppSelector((s) => s.auth.staff);
  const theme = useAppSelector((s) => s.ui.theme);
  const catalog = Boolean(staff?.canEditStock);
  const hr = Boolean(staff?.canReadHr || staff?.canHr);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const setCollapsedPersist = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(SIDE_KEY, next ? 'collapsed' : 'open');
    } catch {
      /* ignore */
    }
  };

  const links = useMemo(() => {
    const items: { to: string; label: string; icon: typeof Users; end?: boolean }[] = [
      { to: '/', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
    ];
    if (catalog) {
      items.push(
        { to: '/produits', label: 'Catalogue', icon: Package },
        { to: '/stock', label: 'Stocks', icon: Warehouse },
        { to: '/promotions', label: 'Promotions', icon: Tags },
        { to: '/vitrine', label: 'Populaires & tendances', icon: Sparkles },
        { to: '/rayons', label: 'Rayons', icon: Grid3x3 },
        { to: '/commandes', label: 'Commandes', icon: ShoppingBag },
      );
    }
    if (hr) {
      items.push(
        { to: '/personnel', label: 'Personnel', icon: Users },
        { to: '/personnel/recrutement', label: 'Recrutement', icon: UserPlus },
        { to: '/personnel/roles', label: 'Rôles', icon: Shield },
      );
    }
    return items;
  }, [catalog, hr]);

  useEffect(() => {
    dispatch(applyTheme());
  }, [dispatch, theme]);

  const who = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim();
  const roleLine = `${roleLabel(staff?.role ?? '')} · ${staff?.storeId || 'tous magasins'}`;

  return (
    <div className={`shell${collapsed ? ' side-collapsed' : ''}`}>
      <aside className={`side${collapsed ? ' collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-mark" />
          <div className="brand-copy">
            <h1>Marché Admin</h1>
            <p>{catalog && hr ? 'Catalogue · RH' : hr ? 'Personnel & rôles' : 'Catalogue · stock · vitrine'}</p>
          </div>
          <button
            className="side-toggle"
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier' : 'Replier'}
            onClick={() => setCollapsedPersist(!collapsed)}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end ?? l.to === '/'}
            title={collapsed ? l.label : undefined}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <l.icon size={18} />
            <span className="nav-label">{l.label}</span>
          </NavLink>
        ))}
        <div className="side-foot">
          <div className="side-who" title={`${who}\n${roleLine}`}>
            <span className="side-avatar">{initials(staff?.firstName, staff?.lastName)}</span>
            <div className="foot-copy">
              <strong>{who || 'Compte'}</strong>
              <span>{roleLabel(staff?.role ?? '')}</span>
              <em>{staff?.storeId || 'tous magasins'}</em>
            </div>
          </div>
          <div className="side-actions">
            <button
              className="btn ghost"
              type="button"
              title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
              onClick={() => dispatch(toggleTheme())}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="foot-text">{theme === 'dark' ? 'Clair' : 'Sombre'}</span>
            </button>
            <button
              className="btn ghost"
              type="button"
              title="Se déconnecter"
              onClick={() => {
                dispatch(logout());
                nav('/login');
              }}>
              <LogOut size={16} />
              <span className="foot-text">Sortir</span>
            </button>
          </div>
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
