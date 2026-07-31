import type { Operation } from '@/domain/types';
import type { CreateFromAssessmentInput, CreateOperationInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError, assertValid } from '@/services/errors';
import { appendAuditEvent } from '../audit/audit-context';
import { assertPermission, type RequestContext } from '../request-context';

export async function createOperation(
  ctx: RequestContext,
  input: CreateOperationInput,
): Promise<Operation> {
  assertPermission(ctx, 'operation.create');
  assertValid(input.name?.trim(), 'Nome da operação é obrigatório', 'name');
  try {
    // O tenant vem da sessão — não confiamos no organizationId do formulário.
    const op = await getServices().operations.create({
      ...input,
      organizationId: ctx.organizationId,
    });
    await appendAuditEvent(ctx, {
      action: 'operation.create',
      objectType: 'Operation',
      objectId: op.id,
      newValue: { status: op.status },
      relatedOperationId: op.id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function duplicateOperation(ctx: RequestContext, id: string): Promise<Operation> {
  assertPermission(ctx, 'operation.create');
  try {
    const copy = await getServices().operations.duplicate(id);
    await appendAuditEvent(ctx, {
      action: 'operation.duplicate',
      objectType: 'Operation',
      objectId: copy.id,
      previousValue: { sourceId: id },
      newValue: { status: 'draft', name: copy.name },
      relatedOperationId: copy.id,
    });
    return copy;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createOperationFromAssessment(
  ctx: RequestContext,
  input: CreateFromAssessmentInput,
): Promise<Operation> {
  assertPermission(ctx, 'operation.create');
  try {
    const op = await getServices().operations.createFromAssessment({
      ...input,
      organizationId: ctx.organizationId,
    });
    await appendAuditEvent(ctx, {
      action: 'assessment.to_operation',
      objectType: 'Operation',
      objectId: op.id,
      previousValue: { assessmentId: input.assessmentId },
      newValue: { status: 'draft', name: op.name },
      relatedOperationId: op.id,
    });
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
