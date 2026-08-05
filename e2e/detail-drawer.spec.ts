import { test, expect } from '@playwright/test';

test.describe('Drawer de detalhe', () => {
  test('clicar numa linha da matriz de risco abre o painel lateral', async ({ page }) => {
    await page.goto('/risk');
    await expect(page.getByRole('heading', { name: /Matriz de risco|Risk matrix/ })).toBeVisible();

    // Clica na primeira linha da tabela
    await page.locator('tbody tr').first().click();

    // O drawer é um dialog com o nome da ação como título
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Mitiga|Mitigation/i)).toBeVisible();
  });
});
