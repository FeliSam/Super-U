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
import { OrdersPage } from '@/pages/Orders';
import { OrderDetailPage } from '@/pages/OrderDetail';
import { ProductsPage } from '@/pages/Products';
import { ProductEditPage } from '@/pages/ProductEdit';
import { StockPage } from '@/pages/Stock';
import { PromotionsPage } from '@/pages/Promotions';
import { MerchPage } from '@/pages/Merch';
import { CategoriesPage } from '@/pages/Categories';
import { PersonnelPage } from '@/pages/Personnel';
import { PersonnelDetailPage } from '@/pages/PersonnelDetail';
import { PersonnelNewPage } from '@/pages/PersonnelNew';
import { RecrutementPage } from '@/pages/Recrutement';
import { RolesHelpPage } from '@/pages/RolesHelp';

function Guard({ children }: { children: ReactNode }) {
  const staff = useAppSelector((s) => s.auth.staff);
  const status = useAppSelector((s) => s.auth.status);
  if (!getToken()) return <Navigate to="/login" replace />;
  if (status !== 'ready' && !staff) return <p style={{ padding: 40 }}>Ouverture du magasin…</p>;
  if (!staff) return <Navigate to="/login" replace />;
  return children;
}

function CatalogGuard({ children }: { children: ReactNode }) {
  const staff = useAppSelector((s) => s.auth.staff);
  if (staff && !staff.canEditStock) return <Navigate to="/personnel" replace />;
  return children;
}

function HrGuard({ children }: { children: ReactNode }) {
  const staff = useAppSelector((s) => s.auth.staff);
  if (staff && !staff.canHr && !staff.canReadHr) return <Navigate to="/" replace />;
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
        <Route
          path="produits"
          element={
            <CatalogGuard>
              <ProductsPage />
            </CatalogGuard>
          }
        />
        <Route
          path="produits/:id"
          element={
            <CatalogGuard>
              <ProductEditPage />
            </CatalogGuard>
          }
        />
        <Route
          path="stock"
          element={
            <CatalogGuard>
              <StockPage />
            </CatalogGuard>
          }
        />
        <Route
          path="promotions"
          element={
            <CatalogGuard>
              <PromotionsPage />
            </CatalogGuard>
          }
        />
        <Route
          path="vitrine"
          element={
            <CatalogGuard>
              <MerchPage />
            </CatalogGuard>
          }
        />
        <Route
          path="rayons"
          element={
            <CatalogGuard>
              <CategoriesPage />
            </CatalogGuard>
          }
        />
        <Route
          path="commandes"
          element={
            <CatalogGuard>
              <OrdersPage />
            </CatalogGuard>
          }
        />
        <Route
          path="commandes/:id"
          element={
            <CatalogGuard>
              <OrderDetailPage />
            </CatalogGuard>
          }
        />
        <Route
          path="personnel"
          element={
            <HrGuard>
              <PersonnelPage />
            </HrGuard>
          }
        />
        <Route
          path="personnel/nouveau"
          element={
            <HrGuard>
              <PersonnelNewPage />
            </HrGuard>
          }
        />
        <Route
          path="personnel/recrutement"
          element={
            <HrGuard>
              <RecrutementPage />
            </HrGuard>
          }
        />
        <Route
          path="personnel/roles"
          element={
            <HrGuard>
              <RolesHelpPage />
            </HrGuard>
          }
        />
        <Route
          path="personnel/:id"
          element={
            <HrGuard>
              <PersonnelDetailPage />
            </HrGuard>
          }
        />
      </Route>
    </Routes>
  );
}
