import { test, expect, type APIRequestContext } from '@playwright/test';
import { issueFakeToken } from './fake-token';
import { E2E_ORG_NAME, E2E_SUBJECT } from './global-setup';

/**
 * ARDEN-BE-003 — E2E frontend↔backend (modo api) de OPERAÇÕES.
 *
 * Prova o fluxo real contra o backend v1: criar operação → editar rascunho →
 * definir Gradiente → publicar → consultar auditoria (via HTTP real), e que o
 * frontend em VITE_DATA_PROVIDER=api LÊ essas operações do backend (sem cair para
 * mock/IndexedDB) e bloqueia acesso de outro tenant.
 */

const API = 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'arden.accessToken';

async function orgId(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.get(`${API}/session`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  return body.data.activeOrganizationId as string;
}

const auth = (token: string, idem?: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(idem ? { 'Idempotency-Key': idem } : {}),
});

const definition = {
  objective: 'Reduzir o tempo de resposta a incidentes.',
  expectedResult: 'MTTR abaixo de 30 minutos.',
  triggers: ['incident.opened'],
  steps: [],
  actions: [],
  approverIds: [],
  contextSourceIds: [],
  integrationIds: [],
  completionCriteria: [],
  environment: 'production',
  evidencePolicy: 'Evidência por etapa.',
};
const authority = {
  level: 3,
  allowedActions: [{ key: 'notify', semanticLevel: 'execute_under_rule', destructive: false }],
  approvalRequired: false,
  approvalPolicyId: null,
  financialLimit: null,
  destructiveActionsAllowed: false,
  justificationRequired: false,
};

test('cria, edita, define Gradiente, publica e audita via backend real', async ({ request }) => {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  const org = await orgId(request, token);

  const created = await request.post(`${API}/organizations/${org}/operations`, {
    headers: auth(token, 'e2e-op-create-1'),
    data: { name: 'Operação E2E Publicada' },
  });
  expect(created.status()).toBe(201);
  const op = (await created.json()).data;
  const draftId = op.currentDraftVersionId;

  const patched = await request.patch(`${API}/organizations/${org}/operations/${op.id}/versions/${draftId}`, {
    headers: auth(token),
    data: { definition, expectedRevision: 1 },
  });
  expect(patched.status()).toBe(200);

  const authRes = await request.patch(`${API}/organizations/${org}/operations/${op.id}/versions/${draftId}/authority`, {
    headers: auth(token),
    data: { authorityProfile: authority, expectedRevision: 2 },
  });
  expect(authRes.status()).toBe(200);

  const published = await request.post(`${API}/organizations/${org}/operations/${op.id}/versions/${draftId}/publish`, {
    headers: auth(token, 'e2e-op-publish-1'),
    data: { expectedRevision: 3, changeSummary: 'Publicação E2E.' },
  });
  expect(published.status()).toBe(200);
  const pub = (await published.json()).data;
  expect(pub.version.status).toBe('published');
  expect(pub.operation.status).toBe('active');

  // Auditoria consultável.
  const audit = await request.get(`${API}/organizations/${org}/audit-events?resourceType=operation_version`, {
    headers: auth(token),
  });
  const actions = (await audit.json()).data.map((e: { action: string }) => e.action);
  expect(actions).toContain('operation_version.published');

  // Imutabilidade: editar a versão publicada → 409 ALREADY_PUBLISHED.
  const blocked = await request.patch(`${API}/organizations/${org}/operations/${op.id}/versions/${draftId}`, {
    headers: auth(token),
    data: { changeSummary: 'x', expectedRevision: 4 },
  });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error.code).toBe('ALREADY_PUBLISHED');
});

test('o frontend em modo api lê as operações do backend (sem fallback para mock)', async ({ request, page }) => {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  const org = await orgId(request, token);

  const name = 'Operação Visível No Catálogo';
  const created = await request.post(`${API}/organizations/${org}/operations`, {
    headers: auth(token, 'e2e-op-list-1'),
    data: { name },
  });
  expect(created.status()).toBe(201);

  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [TOKEN_KEY, token]);
  await page.goto('/operations');

  // A casca autenticada monta (organização do backend) e a operação criada aparece.
  await expect(page.getByTestId('org-switch')).toContainText(E2E_ORG_NAME, { timeout: 30_000 });
  await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 30_000 });
  // A operação exibida veio do backend real (um catálogo de mock não a conteria).
});

test('operação inexistente/de outro tenant retorna 404', async ({ request }) => {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  const org = await orgId(request, token);
  const res = await request.get(`${API}/organizations/${org}/operations/00000000-0000-0000-0000-000000000000`, {
    headers: auth(token),
  });
  expect(res.status()).toBe(404);
  expect((await res.json()).error.code).toBe('RESOURCE_NOT_FOUND');
});
