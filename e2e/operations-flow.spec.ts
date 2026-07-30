import { test, expect } from '@playwright/test';

/**
 * Fluxo de prova ARDEN-FE-001: criar → publicar → recarregar → recuperar,
 * usando o provider padrão (IndexedDB). Prova que a UI persiste pelo contrato e
 * recupera após recarga, sem depender da store.
 */
test('operação criada e publicada persiste após recarregar', async ({ page }) => {
  const name = `Operação Fluxo ${Date.now()}`;

  await page.goto('/operations/new');

  await page.getByRole('tab', { name: /^1\b|Identidade|Identity/ }).click();
  await page.getByLabel(/Nome da operação|Operation name/).fill(name);

  await page.getByRole('tab', { name: /Resultado esperado|Expected result/ }).click();
  await page.getByLabel(/Resultado esperado|Expected result/).fill('Resultado verificável.');

  await page.getByRole('tab', { name: /Responsáveis|Responsibles/ }).click();
  await page.getByLabel(/Responsável|Owner/).selectOption({ index: 1 });

  await page.getByRole('tab', { name: /Limites|Limits/ }).click();
  await page.getByLabel(/Ambiente|Environment/).selectOption('production');
  await page.getByLabel(/Orçamento|Budget/).fill('5000');
  await page.getByLabel(/Política de evidência|Evidence policy/).fill('Evidência por etapa.');

  const publish = page.getByTestId('wizard-publish');
  await expect(publish).toBeEnabled();
  await publish.click();

  // Aterrissa no detalhe da operação publicada.
  await expect(page).toHaveURL(/\/operations\/op_/);
  await expect(page.getByRole('heading', { name })).toBeVisible();

  // Recarrega: os dados vêm do provider (IndexedDB), não da store em memória.
  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  // Aparece no catálogo.
  await page.goto('/operations');
  await expect(page.getByRole('link', { name })).toBeVisible();
});
