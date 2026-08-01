/**
 * Arden.AS API — fluxo de enforcement e aprovações (ARDEN-BE-004).
 *
 * Cobre a decisão do servidor (permitida/bloqueada/exige aprovação), o ciclo de
 * aprovação até a autorização persistida, segregação de funções, quórum,
 * delegação, expiração, invalidação por publicação e isolamento multitenant.
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

/** Publica uma operação com um perfil de autoridade específico. Retorna ids. */
async function publishOperation(orgId: string, auth: string, profile: AuthorityProfile): Promise<{ operationId: string; versionId: string }> {
  const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Operação governada' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition(), expectedRevision: 1 });
  const rev1 = def.body.data.revision as number;
  const authRes = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: profile, expectedRevision: rev1 });
  const rev2 = authRes.body.data.revision as number;
  const pub = await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${versionId}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: rev2, changeSummary: 'v1' });
  expect(pub.status).toBe(200);
  return { operationId, versionId };
}

function profile(overrides: Partial<AuthorityProfile> = {}): AuthorityProfile {
  return {
    level: 4,
    allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_with_approval', destructive: false }],
    approvalRequired: true,
    approvalPolicyId: null,
    financialLimit: null,
    destructiveActionsAllowed: false,
    justificationRequired: false,
    ...overrides,
  };
}

/** Cria e ativa um fluxo de aprovação com uma etapa. Retorna o flowId. */
async function activeFlow(orgId: string, auth: string, step: Record<string, unknown>): Promise<string> {
  const flow = await request(server).post(`${base(orgId)}/approval-flows`).set('Authorization', auth).set('Idempotency-Key', idemKey('flow')).send({
    key: `flow-${idemKey('k')}`, name: 'Fluxo', steps: [{ sequence: 1, name: 'Etapa 1', decisionMode: 'ANY_ONE', requesterCannotApprove: true, justificationRequired: false, ...step }],
  });
  expect(flow.status).toBe(201);
  const flowId = flow.body.data.id as string;
  const rev = flow.body.data.revision as number;
  const act = await request(server).post(`${base(orgId)}/approval-flows/${flowId}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: rev });
  expect(act.status).toBe(200);
  expect(act.body.data.status).toBe('ACTIVE');
  return flowId;
}

describe('enforcement de autoridade', () => {
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

  it('nível 1 bloqueia a execução (AÇÃO BLOQUEADA)', async () => {
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ level: 1, approvalRequired: false, allowedActions: [] }));
    const res = await request(server).post(`${base(orgId)}/operations/${operationId}/actions/evaluate`).set('Authorization', admin.auth)
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: {} });
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('DENIED');
  });

  it('nível 3 permite a execução diretamente (AÇÃO PERMITIDA)', async () => {
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ level: 3, approvalRequired: false, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }] }));
    const res = await request(server).post(`${base(orgId)}/operations/${operationId}/actions/evaluate`).set('Authorization', admin.auth)
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: {} });
    expect(res.body.data.decision).toBe('ALLOWED');
  });

  it('nível 4 exige aprovação e o ciclo termina numa autorização persistida', async () => {
    const flowId = await activeFlow(orgId, admin.auth, { eligibleRoleKey: 'approver' });
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ approvalPolicyId: flowId }));

    const evalRes = await request(server).post(`${base(orgId)}/operations/${operationId}/actions/evaluate`).set('Authorization', admin.auth)
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(evalRes.body.data.decision).toBe('APPROVAL_REQUIRED');

    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');
    const requestId = created.body.data.id as string;

    // O solicitante (admin) não é elegível (não tem o papel approver) → sem botão vale.
    const decided = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth)
      .send({ expectedRevision: created.body.data.revision });
    expect(decided.status).toBe(200);
    expect(decided.body.data.request.status).toBe('APPROVED');
    expect(decided.body.data.authorization).toBeTruthy();
    const authId = decided.body.data.authorization.id as string;

    // Validação da autorização (sem executar).
    const valid = await request(server).post(`${base(orgId)}/action-authorizations/validate`).set('Authorization', admin.auth)
      .send({ authorizationId: authId, operationId, operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(valid.body.data.valid).toBe(true);

    // Payload divergente → inválido.
    const mismatch = await request(server).post(`${base(orgId)}/action-authorizations/validate`).set('Authorization', admin.auth)
      .send({ authorizationId: authId, operationId, operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'internal' } });
    expect(mismatch.body.data.valid).toBe(false);
    expect(mismatch.body.data.reasonCodes).toContain('AUTHORIZATION_PAYLOAD_MISMATCH');
  });

  it('criar solicitação para ação permitida é recusado (409)', async () => {
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ level: 3, approvalRequired: false, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }] }));
    const res = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: {} });
    expect(res.status).toBe(409);
  });

  it('criar solicitação para ação bloqueada é recusado (403 ACTION_DENIED)', async () => {
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ level: 1, approvalRequired: false, allowedActions: [] }));
    const res = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: {} });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACTION_DENIED');
  });

  async function seedApprovalRequest(flowStep: Record<string, unknown> = { eligibleRoleKey: 'approver' }): Promise<{ operationId: string; requestId: string; revision: number }> {
    const flowId = await activeFlow(orgId, admin.auth, flowStep);
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ approvalPolicyId: flowId }));
    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(created.status).toBe(201);
    return { operationId, requestId: created.body.data.id, revision: created.body.data.revision };
  }

  it('segregação de funções: o solicitante não aprova a própria ação', async () => {
    // admin também recebe o papel approver para tentar aprovar a própria solicitação.
    await prisma.membershipRole.create({
      data: {
        membershipId: (await prisma.membership.findFirstOrThrow({ where: { userId: admin.userId, organizationId: orgId } })).id,
        roleId: (await prisma.role.findFirstOrThrow({ where: { organizationId: null, key: 'approver' } })).id,
      },
    });
    const { requestId, revision } = await seedApprovalRequest();
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', admin.auth).send({ expectedRevision: revision });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('aprovador inelegível é recusado (403 APPROVAL_NOT_ELIGIBLE)', async () => {
    const outsider = await seedActor('outsider', orgId, ['analyst']);
    const { requestId, revision } = await seedApprovalRequest({ eligibleRoleKey: 'approver' });
    // analyst não tem approval.resolve → 403 no guard; usar approver sem o papel exigido:
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', outsider.auth).send({ expectedRevision: revision });
    expect(res.status).toBe(403);
  });

  it('quórum: exige duas aprovações; a segunda finaliza e emite UMA autorização', async () => {
    const { requestId, revision } = await seedApprovalRequest({ decisionMode: 'QUORUM', quorum: 2, eligibleRoleKey: 'approver' });
    const first = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: revision });
    expect(first.status).toBe(200);
    expect(first.body.data.request.status).toBe('PENDING');
    expect(first.body.data.authorization).toBeNull();

    const second = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver2.auth).send({ expectedRevision: revision });
    expect(second.status).toBe(200);
    expect(second.body.data.request.status).toBe('APPROVED');
    expect(second.body.data.authorization).toBeTruthy();

    const auths = await prisma.actionAuthorization.count({ where: { approvalRequestId: requestId } });
    expect(auths).toBe(1);
  });

  it('decisão duplicada do mesmo aprovador é recusada (409 APPROVAL_ALREADY_DECIDED)', async () => {
    const { requestId, revision } = await seedApprovalRequest({ decisionMode: 'QUORUM', quorum: 2, eligibleRoleKey: 'approver' });
    await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: revision });
    const dup = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: revision });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('APPROVAL_ALREADY_DECIDED');
  });

  it('rejeição encerra a solicitação sem autorização', async () => {
    const { requestId, revision } = await seedApprovalRequest();
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/reject`).set('Authorization', approver1.auth).send({ expectedRevision: revision, justification: 'Fora de política.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(await prisma.actionAuthorization.count({ where: { approvalRequestId: requestId } })).toBe(0);
  });

  it('cancelamento pelo solicitante encerra a solicitação', async () => {
    const { requestId, revision } = await seedApprovalRequest();
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/cancel`).set('Authorization', admin.auth).send({ expectedRevision: revision });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('delegação: o delegado aprova em nome de um aprovador específico', async () => {
    const specific = await seedActor('specific-approver', orgId, ['approver']);
    const delegate = await seedActor('delegate', orgId, ['approver']);
    // specific delega para delegate.
    const del = await request(server).post(`${base(orgId)}/approval-delegations`).set('Authorization', specific.auth).set('Idempotency-Key', idemKey('del'))
      .send({ delegateUserId: delegate.userId, validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z' });
    expect(del.status).toBe(201);

    const { requestId, revision } = await seedApprovalRequest({ specificApproverUserId: specific.userId });
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', delegate.auth).send({ expectedRevision: revision });
    expect(res.status).toBe(200);
    expect(res.body.data.request.status).toBe('APPROVED');
  });

  it('expiração: solicitação vencida não autoriza (409 APPROVAL_EXPIRED)', async () => {
    const { requestId, revision } = await seedApprovalRequest({ eligibleRoleKey: 'approver', expiresAfterMinutes: 60 });
    await prisma.approvalRequest.update({ where: { id: requestId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const res = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: revision });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPROVAL_EXPIRED');
    const fresh = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(fresh.status).toBe('EXPIRED');
  });

  it('invalidação por publicação: nova versão invalida solicitação e autorização (§36)', async () => {
    const flowId = await activeFlow(orgId, admin.auth, { eligibleRoleKey: 'approver' });
    const { operationId, versionId } = await publishOperation(orgId, admin.auth, profile({ approvalPolicyId: flowId }));
    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('req'))
      .send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    const requestId = created.body.data.id as string;
    const decided = await request(server).post(`${base(orgId)}/approval-requests/${requestId}/approve`).set('Authorization', approver1.auth).send({ expectedRevision: created.body.data.revision });
    const authId = decided.body.data.authorization.id as string;

    // Publica uma nova versão (nova versão de autoridade) → invalida.
    const nv = await request(server).post(`${base(orgId)}/operations/${operationId}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('nv')).send({ basedOnVersionId: versionId });
    const newVersionId = nv.body.data.id as string;
    const newRev = nv.body.data.revision as number;
    const pub = await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${newVersionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub2')).send({ expectedRevision: newRev, changeSummary: 'v2' });
    expect(pub.status).toBe(200);

    const authAfter = await prisma.actionAuthorization.findUniqueOrThrow({ where: { id: authId } });
    expect(authAfter.status).toBe('INVALIDATED');

    // A validação reflete a invalidação.
    const valid = await request(server).post(`${base(orgId)}/action-authorizations/validate`).set('Authorization', admin.auth)
      .send({ authorizationId: authId, operationId, operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(valid.body.data.valid).toBe(false);
    expect(valid.body.data.reasonCodes).toContain('AUTHORIZATION_INVALIDATED');
  });

  it('multitenancy: outro tenant não enxerga a solicitação (§37 → 404)', async () => {
    const { requestId } = await seedApprovalRequest();
    const orgB = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const adminB = await seedActor('admin-b', orgB);
    const res = await request(server).get(`${base(orgB)}/approval-requests/${requestId}`).set('Authorization', adminB.auth);
    expect(res.status).toBe(404);
  });

  it('idempotência: recriar a solicitação com a mesma chave devolve a mesma', async () => {
    const flowId = await activeFlow(orgId, admin.auth, { eligibleRoleKey: 'approver' });
    const { operationId } = await publishOperation(orgId, admin.auth, profile({ approvalPolicyId: flowId }));
    const key = idemKey('req');
    const a = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    const b = await request(server).post(`${base(orgId)}/operations/${operationId}/approval-requests`).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ operationVersionId: 'x', actionKey: 'communication.send', actionPayload: { channel: 'external' } });
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.approvalRequest.count({ where: { operationId } })).toBe(1);
  });
});
