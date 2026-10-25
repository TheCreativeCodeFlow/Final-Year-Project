import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Layout
import AppShell from '../components/layout/AppShell';
import RoleGuard from '../components/common/RoleGuard';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import RoleSelectionPage from '../pages/auth/RoleSelectionPage';
import OwnerOverviewPage from '../pages/owner/OwnerOverviewPage';
import AdminOverviewPage from '../pages/admin/AdminOverviewPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRouter() {
  const { isAuthenticated, role, ROLES } = useAuth();

  // Root redirect destination: if logged in, go to respective overview, otherwise to login
  const defaultHome = isAuthenticated
    ? (role === ROLES.ADMIN ? '/admin/overview' : '/owner/overview')
    : '/login';

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={defaultHome} replace />} />

      {/* Auth & Role Selection Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/select-role" element={<RoleSelectionPage />} />

      {/* Application Owner Routes */}
      <Route
        path="/owner/overview"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <OwnerOverviewPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* Gateway Administrator Routes */}
      <Route
        path="/admin/overview"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <AdminOverviewPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
