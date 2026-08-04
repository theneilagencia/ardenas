import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequirePermission } from '@/components/RequirePermission';
import type { Permission } from '@/domain/permissions';
import type { ReactNode } from 'react';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OperationsPage } from '@/features/operations/OperationsPage';
import { OperationDetailPage } from '@/features/operations/OperationDetailPage';
import { WizardPage } from '@/features/operations/wizard/WizardPage';
import { ExecutionsPage, ExecutionDetailPage } from '@/features/executions/ExecutionsPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { DeploymentPage } from '@/features/deployment/DeploymentPage';
import { FilesPage } from '@/features/files/FilesPage';
import { RiskPage } from '@/features/risk/RiskPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { PeoplePage } from '@/features/people/PeoplePage';
import { RolesPage } from '@/features/roles/RolesPage';
import { GovernancePage } from '@/features/governance/GovernancePage';
import { AuthorityPage } from '@/features/authority/AuthorityPage';
import { IntegrationsPage } from '@/features/integrations/IntegrationsPage';
import { AnthropicAdminPage } from '@/features/anthropic/AnthropicAdminPage';
import { ContextPage } from '@/features/context/ContextPage';
import { WorkUnitsPage } from '@/features/work-units/WorkUnitsPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { EnvironmentsPage } from '@/features/environments/EnvironmentsPage';
import { ExceptionsPage } from '@/features/exceptions/ExceptionsPage';
import { EvidencePage } from '@/features/evidence/EvidencePage';
import { SecurityPage } from '@/features/security/SecurityPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { AssessmentPage } from '@/features/assessment/AssessmentPage';
import { EvaluatorPage } from '@/features/assessment/EvaluatorPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { AgentsPage } from '@/features/agents/AgentsPage';
import { AgentDetailPage } from '@/features/agents/AgentDetailPage';
import { AgentVersionEditorPage } from '@/features/agents/AgentVersionEditorPage';
import { ModelConfigurationsPage } from '@/features/model-configurations/ModelConfigurationsPage';
import { AgentResultsPage } from '@/features/agent-results/AgentResultsPage';
import { AgentUsagePage } from '@/features/agent-results/AgentUsagePage';

const guard = (permission: Permission, element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },

      // OPERAÇÃO
      { path: 'operations', element: guard('operation.view', <OperationsPage />) },
      { path: 'operations/new', element: guard('operation.create', <WizardPage />) },
      { path: 'operations/:id', element: guard('operation.view', <OperationDetailPage />) },
      { path: 'executions', element: guard('execution.view', <ExecutionsPage />) },
      { path: 'executions/:id', element: guard('execution.view', <ExecutionDetailPage />) },
      { path: 'approvals', element: guard('approval.view', <ApprovalsPage />) },

      // RESULTADO
      { path: 'results', element: guard('operation.view', <ResultsPage />) },
      { path: 'evidence', element: guard('audit.view', <EvidencePage />) },
      { path: 'exceptions', element: guard('execution.view', <ExceptionsPage />) },

      // CONTROLE
      { path: 'work-units', element: guard('budget.view', <WorkUnitsPage />) },
      { path: 'authority', element: guard('risk.view', <AuthorityPage />) },
      { path: 'governance', element: guard('policy.view', <GovernancePage />) },
      { path: 'risk', element: guard('risk.view', <RiskPage />) },
      { path: 'context', element: guard('context.view', <ContextPage />) },
      { path: 'integrations', element: guard('integration.view', <IntegrationsPage />) },
      { path: 'anthropic', element: guard('model_provider.view', <AnthropicAdminPage />) },
      { path: 'files', element: guard('file.view', <FilesPage />) },

      // AGENTES (ARDEN-BE-007)
      { path: 'agents', element: guard('agent.view', <AgentsPage />) },
      { path: 'agents/:agentId', element: guard('agent.view', <AgentDetailPage />) },
      { path: 'agents/:agentId/versions/new', element: guard('agent.edit', <AgentVersionEditorPage />) },
      { path: 'agents/:agentId/versions/:agentVersionId', element: guard('agent.view', <AgentVersionEditorPage />) },
      { path: 'model-configurations', element: guard('model_configuration.view', <ModelConfigurationsPage />) },
      { path: 'agent-results', element: guard('agent.view', <AgentResultsPage />) },
      { path: 'agent-usage', element: guard('agent.cost.view', <AgentUsagePage />) },

      // AVALIAÇÃO
      { path: 'assessment', element: guard('operation.view', <AssessmentPage />) },
      { path: 'evaluator', element: guard('operation.view', <EvaluatorPage />) },

      // EMPRESA
      { path: 'deployment', element: guard('onboarding.execute', <DeploymentPage />) },
      { path: 'people', element: guard('people.view', <PeoplePage />) },
      { path: 'security', element: guard('security.view', <SecurityPage />) },
      { path: 'environments', element: guard('operation.view', <EnvironmentsPage />) },
      { path: 'audit', element: guard('audit.view', <AuditPage />) },
      { path: 'reports', element: guard('report.export', <ReportsPage />) },
      { path: 'admin', element: guard('organization.manage', <AdminPage />) },

      // Rotas auxiliares (acessíveis por link, dobradas na navegação do mockup)
      { path: 'roles', element: guard('role.view', <RolesPage />) },
      { path: 'budget', element: guard('budget.view', <BudgetPage />) },
      { path: 'policies', element: <Navigate to="/governance" replace /> },
      { path: 'organizations', element: <Navigate to="/admin" replace /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
