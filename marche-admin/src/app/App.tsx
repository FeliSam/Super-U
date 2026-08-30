import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { bootstrapAuth } from '@/features/auth/authSlice';
import { applyTheme } from '@/features/ui/uiSlice';
import { getToken } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Shell } from '@/layout/Shell';
import { LoginPage } from '@/pages/Login';
import { OverviewPage } from '@/pages/Overview';
import { ProductsPage } from '@/pages/Products';
import { ProductEditPage } from '@/pages/ProductEdit';
import { StockPage } from '@/pages/Stock';
import { PromotionsPage } from '@/pages/Promotions';
import { MerchPage } from '@/pages/Merch';
import { CategoriesPage } from '@/pages/Categories';

function Guard({ children }: { children: ReactNode }) {
  const staff = useAppSelector((s) => s.auth.staff);
  const status = useAppSelector((s) => s.auth.status);
  if (!getToken()) return <Navigate to="/login" replace />;
  if (status !== 'ready' && !staff) return <p style={{ padding: 40 }}>Ouverture du magasin…</p>;
  if (!staff) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(applyTheme());
    if (getToken()) void dispatch(bootstrapAuth());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Guard>
            <Shell />
          </Guard>
        }>
        <Route index element={<OverviewPage />} />
        <Route path="produits" element={<ProductsPage />} />
        <Route path="produits/:id" element={<ProductEditPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="vitrine" element={<MerchPage />} />
        <Route path="rayons" element={<CategoriesPage />} />
      </Route>
    </Routes>
  );
}
