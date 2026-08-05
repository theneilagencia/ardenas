import type { Operation } from '@/domain/types';
import type { Permission } from '@/domain/permissions';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { appendAuditEvent } from '../audit/audit-context';
import { assertPermission, type RequestContext } from '../request-context';

const ACTION_PERMISSION: Record<'pause' | 'resume' | 'archive', Permission> = {
  pause: 'operation.pause',
  resume: 'operation.pause',
  archive: 'operation.edit',
};

async function transition(
  ctx: RequestContext,
  id: string,
  action: 'pause' | 'resume' | 'archive',
): Promise<Operation | void> {
  assertPermission(ctx, ACTION_PERMISSION[action]);
  const ops = getServices().operations;
  try {
    if (action === 'archive') {
      await ops.archive(id);
      await appendAuditEvent(ctx, {
        action: 'operation.archive',
        objectType: 'Operation',
        objectId: id,
        newValue: { status: 'archived' },
        relatedOperationId: id,
      });
      return;
    }
    const op = action === 'pause' ? await ops.pause(id) : await ops.resume(id);
    await appendAuditEvent(ctx, {
      action: `operation.${action}`,
      objectType: 'Operation',
      objectId: id,
      newValue: { status: op.status },
      relatedOperationId: id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export function pauseOperation(ctx: RequestContext, id: string) {
  return transition(ctx, id, 'pause') as Promise<Operation>;
}
export function resumeOperation(ctx: RequestContext, id: string) {
  return transition(ctx, id, 'resume') as Promise<Operation>;
}
export function archiveOperation(ctx: RequestContext, id: string) {
  return transition(ctx, id, 'archive') as Promise<void>;
}

const ENV_ORDER = ['sandbox', 'staging', 'production'] as const;

async function moveEnvironment(
  ctx: RequestContext,
  id: string,
  direction: 'promote' | 'rollback',
): Promise<Operation> {
  assertPermission(ctx, 'operation.edit');
  const ops = getServices().operations;
  try {
    const op = await ops.getById(id);
    const idx = op.environment ? ENV_ORDER.indexOf(op.environment) : direction === 'promote' ? -1 : 0;
    const next =
      direction === 'promote'
        ? ENV_ORDER[Math.min(ENV_ORDER.length - 1, idx + 1)]
        : ENV_ORDER[Math.max(0, idx - 1)];
    const updated = await ops.updateDraft(id, { environment: next });
    await appendAuditEvent(ctx, {
      action: `environment.${direction}`,
      objectType: 'Operation',
      objectId: id,
      previousValue: { environment: op.environment },
      newValue: { environment: next },
      relatedOperationId: id,
    });
    return updated;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export function promoteOperationEnvironment(ctx: RequestContext, id: string) {
  return moveEnvironment(ctx, id, 'promote');
}
export function rollbackOperationEnvironment(ctx: RequestContext, id: string) {
  return moveEnvironment(ctx, id, 'rollback');
}
