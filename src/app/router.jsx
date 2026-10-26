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

// Gateway Administrator Pages (Stage 2B.1, 2B.2, 2B.3, 2B.4)
import AdminOverviewPage from '../pages/admin/AdminOverviewPage';
import TenantsListPage from '../pages/admin/TenantsListPage';
import TenantDetailsPage from '../pages/admin/TenantDetailsPage';
import GatewayHealthPage from '../pages/admin/GatewayHealthPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';
import InvestigationsListPage from '../pages/admin/InvestigationsListPage';
import InvestigationDetailsPage from '../pages/admin/InvestigationDetailsPage';
import AttackerProfilesListPage from '../pages/admin/AttackerProfilesListPage';
import AttackerProfileDetailsPage from '../pages/admin/AttackerProfileDetailsPage';
import DeceptionEnvironmentsPage from '../pages/admin/DeceptionEnvironmentsPage';
import DeceptionEnvironmentDetailsPage from '../pages/admin/DeceptionEnvironmentDetailsPage';
import DeceptionStateGraphPage from '../pages/admin/DeceptionStateGraphPage';
import DeceptionPoliciesPage from '../pages/admin/DeceptionPoliciesPage';
import DeceptionPolicyFormPage from '../pages/admin/DeceptionPolicyFormPage';
import DeceptionPolicyDetailsPage from '../pages/admin/DeceptionPolicyDetailsPage';
import DeceptionStrategiesPage from '../pages/admin/DeceptionStrategiesPage';
import DeceptionStrategyDetailsPage from '../pages/admin/DeceptionStrategyDetailsPage';

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

      {/* Threat Investigations & Attacker Profiles (Stage 2B.2) */}
      <Route
        path="/admin/investigations"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <InvestigationsListPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/investigations/:investigationId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <InvestigationDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/attacker-profiles"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <AttackerProfilesListPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/attacker-profiles/:profileId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <AttackerProfileDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* Deception Environments & Deception State Graph Explorer (Stage 2B.3) */}
      <Route
        path="/admin/deception-environments"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionEnvironmentsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-environments/:environmentId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionEnvironmentDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-state-graph"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionStateGraphPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-state-graph/:environmentId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionStateGraphPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* Deception Policies & Strategy Management (Stage 2B.4) */}
      <Route
        path="/admin/deception-policies"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionPoliciesPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-policies/new"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionPolicyFormPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-policies/:policyId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionPolicyDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-policies/:policyId/edit"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionPolicyFormPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-strategies"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionStrategiesPage />
            </AppShell>
          </RoleGuard>
        }
      />

      <Route
        path="/admin/deception-strategies/:strategyId"
        element={
          <RoleGuard requiredRole={ROLES.ADMIN}>
            <AppShell>
              <DeceptionStrategyDetailsPage />
            </AppShell>
          </RoleGuard>
        }
      />

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
