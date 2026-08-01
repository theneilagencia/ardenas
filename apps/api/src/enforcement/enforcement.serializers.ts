/**
 * Arden.AS API — serialização DB→contrato de autorizações de ação (ARDEN-BE-004).
 */

import type { ActionAuthorization as DbAuthorization } from '@prisma/client';
import { actionAuthorization as authorizationSchema, type ActionAuthorization } from '@arden/contracts';

export function toAuthorizationContract(row: DbAuthorization): ActionAuthorization {
  return authorizationSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    approvalRequestId: row.approvalRequestId ?? null,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    actionKey: row.actionKey,
    actionPayloadHash: row.actionPayloadHash,
    grantedToUserId: row.grantedToUserId ?? null,
    status: row.status,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    grantedAt: row.grantedAt.toISOString(),
    usedAt: row.usedAt ? row.usedAt.toISOString() : null,
    authoritySnapshot: row.authoritySnapshot,
    policySnapshot: row.policySnapshot,
    correlationId: row.correlationId,
    revision: row.revision,
  });
}
