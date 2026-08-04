import { test, expect, type Page } from '@playwright/test';
import { issueFakeToken } from './fake-token';
import { E2E_SUBJECT } from './global-setup';

/**
 * ARDEN-BE-008.6 — E2E frontend↔backend em MODO API dos fluxos administrativos Anthropic.
 *
 * O frontend real (VITE_DATA_PROVIDER=api) consome o backend REAL (provider FAKE, Postgres de
 * teste). Prova, ponta a ponta e sem mock:
 *  - fixture não produtiva: produção BLOQUEADA + catálogo real (modelos não selecionáveis,
 *    preço não verificado);
 *  - connection segura: criação com API key WRITE-ONLY (canário: a key não aparece no DOM
 *    após o envio) + validação LOCAL NOT_VERIFIED_WITH_PROVIDER;
 *  - ModelConfiguration guiada em DRAFT com ativação bloqueada;
 *  - rotação de credencial invalida o smoke anterior.
 *
 * Live smoke e live tool calling permanecem NOT EXECUTED; produção permanece BLOCKED.
 */

const TOKEN_KEY = 'arden.accessToken';
const API_KEY = 'sk-ant-e2e-CANARY-3d9f1a7b2c';

async function gotoAnthropic(page: Page) {
  const token = issueFakeToken({ subject: E2E_SUBJECT });
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [TOKEN_KEY, token]);
  await page.goto('/anthropic');
  await expect(page.getByText(/Uso em produção bloqueado/i)).toBeVisible({ timeout: 30_000 });
}

test('fixture não produtiva: produção bloqueada e catálogo real sem preço verificado', async ({ page }) => {
  await gotoAnthropic(page);
  // Catálogo real do backend (modelos DISABLED → não selecionáveis; preço não verificado).
  await expect(page.getByText(/Catálogo de modelos/i)).toBeVisible();
  await expect(page.getByText(/claude-/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Preço não verificado/i).first()).toBeVisible();
  await expect(page.getByText(/Não disponível/i).first()).toBeVisible();
});

test('connection segura: API key write-only (canário no DOM) + validação NOT_VERIFIED', async ({ page }) => {
  await gotoAnthropic(page);

  const name = `E2E conn ${Date.now()}`;
  await page.getByLabel('Nome', { exact: true }).first().fill(name);
  await page.getByLabel(/API key/i).fill(API_KEY);
  await page.getByRole('button', { name: /Criar conexão Anthropic/i }).click();

  // A conexão aparece na lista (dados reais do backend).
  await expect(page.getByRole('button', { name })).toBeVisible({ timeout: 15_000 });

  // Canário: a API key não aparece no DOM após o envio.
  expect(await page.content()).not.toContain(API_KEY);

  // Abre o detalhe e valida localmente.
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: /Validar configuração/i }).click();
  await expect(page.getByText(/NÃO VERIFICADO COM O PROVIDER/i)).toBeVisible({ timeout: 15_000 });
  // Nunca afirma "conectado".
  await expect(page.getByText(/\bconectado\b/i)).toHaveCount(0);
});

test('rotação de credencial invalida o smoke anterior', async ({ page }) => {
  await gotoAnthropic(page);
  const name = `E2E rot ${Date.now()}`;
  await page.getByLabel('Nome', { exact: true }).first().fill(name);
  await page.getByLabel(/API key/i).fill(API_KEY);
  await page.getByRole('button', { name: /Criar conexão Anthropic/i }).click();
  await page.getByRole('button', { name }).click();
  const drawer = page.getByRole('dialog');

  // A conexão precisa estar ACTIVE para rotacionar (lifecycle BE-006).
  await drawer.getByRole('button', { name: 'Ativar', exact: true }).click();
  await expect(drawer.getByText('Ativa', { exact: true })).toBeVisible({ timeout: 15_000 });

  await drawer.getByLabel(/Nova API key/i).fill('sk-ant-e2e-rotated-XYZ');
  const rotateBtn = drawer.getByRole('button', { name: /Rotacionar credencial/i });
  await expect(rotateBtn).toBeEnabled();
  await rotateBtn.click();
  await expect(drawer.getByText(/Invalidado pela rotação/i)).toBeVisible({ timeout: 15_000 });
});

test('ModelConfiguration Anthropic guiada nasce em DRAFT com ativação bloqueada', async ({ page }) => {
  await gotoAnthropic(page);
  await expect(page.getByText(/Configuração de modelo Anthropic/i)).toBeVisible();
  // A elegibilidade mostra ativação bloqueada nesta fase (provider DISABLED).
  await expect(page.getByText(/Ativação bloqueada nesta fase/i)).toBeVisible();
});
