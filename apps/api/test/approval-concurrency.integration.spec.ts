/**
 * Arden.AS API — concorrência de decisões (ARDEN-BE-004 §35).
 *
 * Dois votos finais SIMULTÂNEOS em um passo de quórum 2 devem produzir UMA única
 * transição terminal e UMA única autorização — nunca duas. A trava de linha
 * (FOR UPDATE) na solicitação serializa os votos.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthorityProfile } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const base = (orgId: string) => `/api/v1/organizations/${orgId}`;

function profile(flowId: string): AuthorityProfile {
  return {
    level: 4,
    allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_with_approval', destructive: false }],
    approvalRequired: true,
    approvalPolicyId: flowId,
    financialLimit: null,
    destructiveActionsAllowed: false,
    justificationRequired: false,
  };
}

describe('concorrência de aprovação (§35)', () => {
  let orgId: string;
  let admin: Actor;
  let approver1: Actor;
  let approver2: Actor;

  beforeEach(async () => {
    await resetIdentity();
    orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    admin = await seedActor('gov-admin', orgId);
    approver1 = await seedActor('approver-1', orgId, ['approver']);
    approver2 = await seedActor('approver-2', orgId, ['approver']);
  });

  it('dois votos finais simultâneos → uma aprovação e uma autorização', async () => {
    // Fluxo de quórum 2.
    const flow = await request(server).post(`${base(orgId)}/approval-flows`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('flow'))
      .send({ key: `q-${idemKey('k')}`, name: 'Quórum', steps: [{ sequence: 1, name: 'E1', decisionMode: 'QUORUM', quorum: 2, eligibleRoleKey: 'approver', requesterCannotApprove: true }] });
    const flowId = flow.body.data.id as string;
    await request(server).post(`${base(orgId)}/approval-flows/${flowId}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: flow.body.data.revision });

    // Operação nível 4.
    const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op' });
    const operationId = op.body.data.id as string;
    const versionId = op.body.data.currentDraftVersionId as string;
    const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', admin.auth).send({ definition: validDefinition(), expectedRevision: 1 });
    const authRes = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', admin.auth).send({ authorityProfile: profile(flowId), expectedRevision: def.body.data.revision });
    await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${versionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: authRes.body.data.revision, changeSummary: 'v1' });

    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    const requestId = created.body.data.id as string;
    const rev = created.body.data.revision as number;

    // Dois aprovadores votam AO MESMO TEMPO.
    const [a, b] = await Promise.all([
      request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: rev }),
      request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver2.auth).send({ expectedRevision: rev }),
    ]);

    // Ambos os votos aceitos (200); nenhum 5xx.
    expect([a.status, b.status].every((s) => s === 200)).toBe(true);

    // Exatamente uma transição terminal e uma autorização.
    const fresh = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(fresh.status).toBe('APPROVED');
    expect(await prisma.actionAuthorization.count({ where: { approvalRequestId: requestId } })).toBe(1);
    expect(await prisma.approvalDecision.count({ where: { approvalRequestId: requestId, decision: 'APPROVE' } })).toBe(2);
    // Apenas um dos dois retornos traz a autorização.
    const withAuth = [a, b].filter((r) => r.body?.data?.authorization).length;
    expect(withAuth).toBe(1);
  });
});
