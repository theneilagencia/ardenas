import { test, expect } from '@playwright/test';

test.describe('Command palette (⌘K)', () => {
  test('abre pela busca, filtra e navega para um módulo', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Abre pelo gatilho de busca da topbar
    await page.getByRole('button', { name: /Buscar operações|Search operations/ }).click();
    const search = page.getByPlaceholder(/Buscar módulos|Search modules/);
    await expect(search).toBeVisible();

    // Filtra por "Governança" e seleciona
    await search.fill('Govern');
    await page.getByRole('button', { name: /^Governança$|^Governance$/ }).click();

    await expect(page).toHaveURL(/\/governance$/);
    await expect(page.getByRole('heading', { name: /Governança|Governance/ })).toBeVisible();
  });

  test('atalho de teclado abre a paleta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading').first().click();
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/Buscar módulos|Search modules/)).toBeVisible();
  });
});
