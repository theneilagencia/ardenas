import { useTranslation } from 'react-i18next';
import type { ExecutionState, OperationStatus } from '@/domain/types';

const OP_STATE_COLOR: Record<OperationStatus, string> = {
  draft: 'var(--st-paused)',
  awaiting_approval: 'var(--st-waiting)',
  scheduled: 'var(--st-working)',
  running: 'var(--st-working)',
  paused: 'var(--st-paused)',
  archived: 'var(--tx2)',
};

const EXEC_STATE_COLOR: Record<ExecutionState, string> = {
  preparing: 'var(--st-working)',
  running: 'var(--st-working)',
  awaiting_approval: 'var(--st-waiting)',
  paused: 'var(--st-paused)',
  exception: 'var(--st-failed)',
  completed: 'var(--st-completed)',
  failed: 'var(--st-failed)',
  cancelled: 'var(--st-paused)',
};

export function OperationStateBadge({ status }: { status: OperationStatus }) {
  const { t } = useTranslation();
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: OP_STATE_COLOR[status] }} aria-hidden />
      {t(`opStatus.${status}`)}
    </span>
  );
}

export function ExecutionStateBadge({ state }: { state: ExecutionState }) {
  const { t } = useTranslation();
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: EXEC_STATE_COLOR[state] }} aria-hidden />
      {t(`execState.${state}`)}
    </span>
  );
}
