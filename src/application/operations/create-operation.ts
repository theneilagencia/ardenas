import type { Operation } from '@/domain/types';
import type { CreateFromAssessmentInput, CreateOperationInput } from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError, assertValid } from '@/services/errors';
import { buildAuditEvent, type AuditContext } from '../audit/audit-context';

export async function createOperation(
  input: CreateOperationInput,
  ctx: AuditContext,
): Promise<Operation> {
  assertValid(input.name?.trim(), 'Nome da operação é obrigatório', 'name');
  try {
    const op = await getServices().operations.create(input);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'operation.create',
        objectType: 'Operation',
        objectId: op.id,
        newValue: { status: op.status },
        relatedOperationId: op.id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function duplicateOperation(id: string, ctx: AuditContext): Promise<Operation> {
  try {
    const copy = await getServices().operations.duplicate(id);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'operation.duplicate',
        objectType: 'Operation',
        objectId: copy.id,
        previousValue: { sourceId: id },
        newValue: { status: 'draft', name: copy.name },
        relatedOperationId: copy.id,
      }),
    );
    return copy;
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export async function createOperationFromAssessment(
  input: CreateFromAssessmentInput,
  ctx: AuditContext,
): Promise<Operation> {
  try {
    const op = await getServices().operations.createFromAssessment(input);
    await getServices().audit.append(
      buildAuditEvent(ctx, {
        action: 'assessment.to_operation',
        objectType: 'Operation',
        objectId: op.id,
        previousValue: { assessmentId: input.assessmentId },
        newValue: { status: 'draft', name: op.name },
        relatedOperationId: op.id,
      }),
    );
    return op;
  } catch (err) {
    throw toRepositoryError(err);
  }
}
