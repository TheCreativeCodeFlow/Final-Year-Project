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

// Gateway Administrator Pages (Stage 2B.1)
import AdminOverviewPage from '../pages/admin/AdminOverviewPage';
import TenantsListPage from '../pages/admin/TenantsListPage';
import TenantDetailsPage from '../pages/admin/TenantDetailsPage';
import GatewayHealthPage from '../pages/admin/GatewayHealthPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';

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

      {/* Gateway Administrator Routes - Protected by RoleGuard (Stage 2B.1) */}
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

      <Route
        path="/admin/tenants"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <TenantsListPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/tenants/:tenantId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <TenantDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/health"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <GatewayHealthPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/audit-logs"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <AuditLogsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
