import type { Operation } from '@/domain/types';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { buildAuditEvent, type AuditContext } from '../audit/audit-context';

async function transition(
  id: string,
  action: 'pause' | 'resume' | 'archive',
  ctx: AuditContext,
): Promise<Operation | void> {
  const ops = getServices().operations;
  try {
    if (action === 'archive') {
      await ops.archive(id);
      await getServices().audit.append(
        buildAuditEvent(ctx, {
          action: 'operation.archive',
          objectType: 'Operation',
          objectId: id,
          newValue: { status: 'archived' },
          relatedOperationId: id,
        }),
      );
      return;
    }
    const op = action === 'pause' ? await ops.pause(id) : await ops.resume(id);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: `operation.${action}`,
        objectType: 'Operation',
        objectId: id,
        newValue: { status: op.status },
        relatedOperationId: id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export function pauseOperation(id: string, ctx: AuditContext) {
  return transition(id, 'pause', ctx) as Promise<Operation>;
}
export function resumeOperation(id: string, ctx: AuditContext) {
  return transition(id, 'resume', ctx) as Promise<Operation>;
}
export function archiveOperation(id: string, ctx: AuditContext) {
  return transition(id, 'archive', ctx) as Promise<void>;
}

const ENV_ORDER = ['sandbox', 'staging', 'production'] as const;

async function moveEnvironment(
  id: string,
  direction: 'promote' | 'rollback',
  ctx: AuditContext,
): Promise<Operation> {
  const ops = getServices().operations;
  try {
    const op = await ops.getById(id);
    const idx = op.environment ? ENV_ORDER.indexOf(op.environment) : direction === 'promote' ? -1 : 0;
    const next =
      direction === 'promote'
        ? ENV_ORDER[Math.min(ENV_ORDER.length - 1, idx + 1)]
        : ENV_ORDER[Math.max(0, idx - 1)];
    const updated = await ops.updateDraft(id, { environment: next });
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: `environment.${direction}`,
        objectType: 'Operation',
        objectId: id,
        previousValue: { environment: op.environment },
        newValue: { environment: next },
        relatedOperationId: id,
      }),
    );
    return updated;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export function promoteOperationEnvironment(id: string, ctx: AuditContext) {
  return moveEnvironment(id, 'promote', ctx);
}
export function rollbackOperationEnvironment(id: string, ctx: AuditContext) {
  return moveEnvironment(id, 'rollback', ctx);
}
