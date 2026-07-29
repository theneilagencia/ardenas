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
import { PeoplePage } from '@/features/people/PeoplePage';
import { RolesPage } from '@/features/roles/RolesPage';
import { PoliciesPage } from '@/features/policies/PoliciesPage';
import { IntegrationsPage } from '@/features/integrations/IntegrationsPage';
import { ContextPage } from '@/features/context/ContextPage';
import { WorkUnitsPage } from '@/features/work-units/WorkUnitsPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { EnvironmentsPage } from '@/features/environments/EnvironmentsPage';
import { ExceptionsPage } from '@/features/exceptions/ExceptionsPage';
import { EvidencePage } from '@/features/evidence/EvidencePage';
import { SecurityPage } from '@/features/security/SecurityPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
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

      {
        path: 'exceptions',
        element: (
          <RequirePermission permission="execution.view">
            <ExceptionsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'evidence',
        element: (
          <RequirePermission permission="audit.view">
            <EvidencePage />
          </RequirePermission>
        ),
      },
      {
        path: 'people',
        element: (
          <RequirePermission permission="people.view">
            <PeoplePage />
          </RequirePermission>
        ),
      },
      {
        path: 'roles',
        element: (
          <RequirePermission permission="role.view">
            <RolesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'policies',
        element: (
          <RequirePermission permission="policy.view">
            <PoliciesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'integrations',
        element: (
          <RequirePermission permission="integration.view">
            <IntegrationsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'context',
        element: (
          <RequirePermission permission="context.view">
            <ContextPage />
          </RequirePermission>
        ),
      },
      {
        path: 'work-units',
        element: (
          <RequirePermission permission="budget.view">
            <WorkUnitsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'budget',
        element: (
          <RequirePermission permission="budget.view">
            <BudgetPage />
          </RequirePermission>
        ),
      },
      {
        path: 'environments',
        element: (
          <RequirePermission permission="operation.view">
            <EnvironmentsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'security',
        element: (
          <RequirePermission permission="security.view">
            <SecurityPage />
          </RequirePermission>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequirePermission permission="report.export">
            <ReportsPage />
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
