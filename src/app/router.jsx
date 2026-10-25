import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Layout
import AppShell from '../components/layout/AppShell';
import RoleGuard from '../components/common/RoleGuard';

// Auth & Shared Pages
import LoginPage from '../pages/auth/LoginPage';
import RoleSelectionPage from '../pages/auth/RoleSelectionPage';
import NotFoundPage from '../pages/NotFoundPage';

// Owner Portal Pages
import OwnerOverviewPage from '../pages/owner/OwnerOverviewPage';
import ApplicationsListPage from '../pages/owner/ApplicationsListPage';
import ApplicationFormPage from '../pages/owner/ApplicationFormPage';
import ApplicationDetailsPage from '../pages/owner/ApplicationDetailsPage';
import SecurityEventsPage from '../pages/owner/SecurityEventsPage';
import SecurityEventDetailsPage from '../pages/owner/SecurityEventDetailsPage';
import IntegrationsPage from '../pages/owner/IntegrationsPage';
import OwnerSettingsPage from '../pages/owner/OwnerSettingsPage';

// Admin Pages
import AdminOverviewPage from '../pages/admin/AdminOverviewPage';

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

      {/* Application Owner Routes - Protected by RoleGuard */}
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

      <Route
        path="/owner/applications"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <ApplicationsListPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/applications/new"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <ApplicationFormPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/applications/:applicationId"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <ApplicationDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/events"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <SecurityEventsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/events/:eventId"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <SecurityEventDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/integrations"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <IntegrationsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/owner/settings"
        element={
          <RoleGuard requiredRole={ROLES.OWNER}>
            <AppShell>
              <OwnerSettingsPage />
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
