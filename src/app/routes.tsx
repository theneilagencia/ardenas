import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequirePermission } from '@/components/RequirePermission';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OperationsPage } from '@/features/operations/OperationsPage';
import { OperationDetailPage } from '@/features/operations/OperationDetailPage';
import { WizardPage } from '@/features/operations/wizard/WizardPage';
import { ExecutionsPage, ExecutionDetailPage } from '@/features/executions/ExecutionsPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { DeploymentPage } from '@/features/deployment/DeploymentPage';
import { FilesPage } from '@/features/files/FilesPage';
import { RiskPage } from '@/features/risk/RiskPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { ModulePlaceholder } from '@/features/ModulePlaceholder';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      {
        path: 'operations',
        element: (
          <RequirePermission permission="operation.view">
            <OperationsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'operations/new',
        element: (
          <RequirePermission permission="operation.create">
            <WizardPage />
          </RequirePermission>
        ),
      },
      {
        path: 'operations/:id',
        element: (
          <RequirePermission permission="operation.view">
            <OperationDetailPage />
          </RequirePermission>
        ),
      },

      {
        path: 'executions',
        element: (
          <RequirePermission permission="execution.view">
            <ExecutionsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'executions/:id',
        element: (
          <RequirePermission permission="execution.view">
            <ExecutionDetailPage />
          </RequirePermission>
        ),
      },

      {
        path: 'approvals',
        element: (
          <RequirePermission permission="approval.view">
            <ApprovalsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'deployment',
        element: (
          <RequirePermission permission="onboarding.execute">
            <DeploymentPage />
          </RequirePermission>
        ),
      },
      {
        path: 'files',
        element: (
          <RequirePermission permission="file.view">
            <FilesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'risk',
        element: (
          <RequirePermission permission="risk.view">
            <RiskPage />
          </RequirePermission>
        ),
      },
      {
        path: 'audit',
        element: (
          <RequirePermission permission="audit.view">
            <AuditPage />
          </RequirePermission>
        ),
      },

      // Módulos mapeados, detalhamento na sequência da reconstrução.
      {
        path: 'exceptions',
        element: (
          <RequirePermission permission="execution.view">
            <ModulePlaceholder labelKey="nav.exceptions" />
          </RequirePermission>
        ),
      },
      {
        path: 'evidence',
        element: (
          <RequirePermission permission="audit.view">
            <ModulePlaceholder labelKey="nav.evidence" />
          </RequirePermission>
        ),
      },
      {
        path: 'people',
        element: (
          <RequirePermission permission="people.view">
            <ModulePlaceholder labelKey="nav.people" />
          </RequirePermission>
        ),
      },
      {
        path: 'roles',
        element: (
          <RequirePermission permission="role.view">
            <ModulePlaceholder labelKey="nav.roles" />
          </RequirePermission>
        ),
      },
      {
        path: 'policies',
        element: (
          <RequirePermission permission="policy.view">
            <ModulePlaceholder labelKey="nav.policies" />
          </RequirePermission>
        ),
      },
      {
        path: 'integrations',
        element: (
          <RequirePermission permission="integration.view">
            <ModulePlaceholder labelKey="nav.integrations" />
          </RequirePermission>
        ),
      },
      {
        path: 'context',
        element: (
          <RequirePermission permission="context.view">
            <ModulePlaceholder labelKey="nav.context" />
          </RequirePermission>
        ),
      },
      {
        path: 'work-units',
        element: (
          <RequirePermission permission="budget.view">
            <ModulePlaceholder labelKey="nav.workUnits" />
          </RequirePermission>
        ),
      },
      {
        path: 'budget',
        element: (
          <RequirePermission permission="budget.view">
            <ModulePlaceholder labelKey="nav.budget" />
          </RequirePermission>
        ),
      },
      {
        path: 'environments',
        element: (
          <RequirePermission permission="operation.view">
            <ModulePlaceholder labelKey="nav.environments" />
          </RequirePermission>
        ),
      },
      {
        path: 'security',
        element: (
          <RequirePermission permission="security.view">
            <ModulePlaceholder labelKey="nav.security" />
          </RequirePermission>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequirePermission permission="report.export">
            <ModulePlaceholder labelKey="nav.reports" />
          </RequirePermission>
        ),
      },
      {
        path: 'organizations',
        element: (
          <RequirePermission permission="organization.manage">
            <ModulePlaceholder labelKey="nav.settings" />
          </RequirePermission>
        ),
      },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
