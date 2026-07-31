import { test, expect } from '@playwright/test';
import { issueFakeToken } from './fake-token';
import { E2E_ORG_NAME, E2E_ORG_SLUG, E2E_SUBJECT } from './global-setup';

/**
 * ARDEN-BE-002 — E2E frontend↔backend em MODO API (session + organizações).
 *
 * O frontend (VITE_DATA_PROVIDER=api) consulta o backend REAL: um usuário
 * autenticado vê a sua organização e as permissões computadas no servidor. Sem
 * token, o modo `api` mostra o estado explícito de sessão e NÃO cai para dados
 * simulados (nenhuma organização de mock aparece).
 */

const TOKEN_KEY = 'arden.accessToken';

test('usuário autenticado vê a sua organização vinda do backend real', async ({ page }) => {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  );

  await page.goto('/');

  // A casca autenticada monta e o seletor mostra a organização do backend.
  const orgSwitch = page.getByTestId('org-switch');
  await expect(orgSwitch).toBeVisible({ timeout: 30_000 });
  await expect(orgSwitch).toContainText(E2E_ORG_NAME);

  // A sessão veio do backend: a organização real está presente ao abrir o seletor.
  await orgSwitch.click();
  await expect(page.getByTestId(`org-option-${E2E_ORG_SLUG}`)).toBeVisible();
});

test('o backend do modo api serve o endpoint canônico de logout (session.logout)', async ({
  request,
}) => {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  const base = 'http://localhost:3000/api/v1';

  // Endpoint canônico do contrato/OpenAPI.
  const logout = await request.post(`${base}/session/logout`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(logout.status()).toBe(204);

  // A rota antiga não existe (sem endpoint duplicado nem alias).
  const legacy = await request.post(`${base}/session/sign-out`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(legacy.status()).toBe(404);
});

test('sem token, o modo api NÃO cai para mock (estado de sessão explícito)', async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.removeItem(key), TOKEN_KEY);

  await page.goto('/');

  // Estado de sessão explícito (não autenticado/erro) — nunca a aplicação com dados.
  await expect(page.getByTestId('session-state-title')).toBeVisible({ timeout: 30_000 });

  // Nenhuma organização de mock (semente do frontend) vaza no modo api.
  await expect(page.getByText('Grupo Atlas')).toHaveCount(0);
  await expect(page.getByText('Horizonte Holdings')).toHaveCount(0);
  await expect(page.getByTestId('org-switch')).toHaveCount(0);
});
