/**
 * Arden.AS — badges de status do domínio de agentes (ARDEN-BE-007.7).
 * Reaproveita a linguagem visual `.badge` + `.state-dot` (mesmo estilo de operações/
 * execuções). Rótulos por i18n; cor por status. Sem lógica de dados.
 */

import { useTranslation } from 'react-i18next';
import type {
  AgentStatus,
  AgentVersionStatus,
  ModelConfigurationStatus,
  ModelProviderStatus,
  AgentResultStatus,
  AgentEvaluationStatusEnum,
  AgentGovernanceStatus,
} from '@/contracts';

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

const LIFECYCLE_COLOR: Record<string, string> = {
  DRAFT: 'var(--st-paused)',
  ACTIVE: 'var(--st-working)',
  SUSPENDED: 'var(--st-waiting)',
  REVOKED: 'var(--st-failed)',
  PUBLISHED: 'var(--st-completed)',
  RETIRED: 'var(--tx2)',
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const { t } = useTranslation();
  return <Badge color={LIFECYCLE_COLOR[status] ?? 'var(--tx2)'} label={t(`agents.status.${status}`)} />;
}

export function AgentVersionStatusBadge({ status }: { status: AgentVersionStatus }) {
  const { t } = useTranslation();
  return <Badge color={LIFECYCLE_COLOR[status] ?? 'var(--tx2)'} label={t(`agents.versionStatus.${status}`)} />;
}

export function ModelConfigStatusBadge({ status }: { status: ModelConfigurationStatus }) {
  const { t } = useTranslation();
  return <Badge color={LIFECYCLE_COLOR[status] ?? 'var(--tx2)'} label={t(`agents.status.${status}`)} />;
}

const PROVIDER_COLOR: Record<ModelProviderStatus, string> = {
  ACTIVE: 'var(--st-working)',
  DEPRECATED: 'var(--st-waiting)',
  DISABLED: 'var(--st-failed)',
};
export function ModelProviderStatusBadge({ status }: { status: ModelProviderStatus }) {
  const { t } = useTranslation();
  return <Badge color={PROVIDER_COLOR[status]} label={t(`agents.providerStatus.${status}`)} />;
}

const RESULT_COLOR: Record<AgentResultStatus, string> = {
  SUCCEEDED: 'var(--st-completed)',
  FAILED: 'var(--st-failed)',
  SUSPENDED: 'var(--st-paused)',
  REQUIRES_APPROVAL: 'var(--st-waiting)',
  UNKNOWN: 'var(--st-waiting)',
};
export function AgentResultStatusBadge({ status }: { status: AgentResultStatus }) {
  const { t } = useTranslation();
  return <Badge color={RESULT_COLOR[status]} label={t(`agents.resultStatus.${status}`)} />;
}

const EVAL_COLOR: Record<AgentEvaluationStatusEnum, string> = {
  PASSED: 'var(--st-completed)',
  FAILED: 'var(--st-failed)',
  PARTIAL: 'var(--st-waiting)',
  NOT_RUN: 'var(--tx2)',
};
export function AgentEvaluationBadge({ status }: { status: AgentEvaluationStatusEnum }) {
  const { t } = useTranslation();
  return <Badge color={EVAL_COLOR[status]} label={t(`agents.evaluationStatus.${status}`)} />;
}

const GOV_COLOR: Record<AgentGovernanceStatus, string> = {
  WITHIN_LIMITS: 'var(--st-completed)',
  LIMIT_WARNING: 'var(--st-waiting)',
  LIMIT_EXCEEDED: 'var(--st-failed)',
  BLOCKED: 'var(--st-failed)',
};
export function AgentGovernanceBadge({ status }: { status: AgentGovernanceStatus }) {
  const { t } = useTranslation();
  return <Badge color={GOV_COLOR[status]} label={t(`agents.governanceStatus.${status}`)} />;
}
