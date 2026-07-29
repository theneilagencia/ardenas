import { test, expect } from '@playwright/test';

test.describe('Implantação — trava sequencial', () => {
  test('a etapa 2 fica bloqueada até a 1 concluir', async ({ page }) => {
    await page.goto('/deployment');

    const step2Complete = page.getByTestId('deploy-complete-2');
    await expect(step2Complete).toBeDisabled();

    // Conclui a etapa 1 e a etapa 2 destrava.
    await page.getByTestId('deploy-complete-1').click();
    await expect(page.getByTestId('deploy-step-1')).toHaveAttribute('data-done', 'true');
    await expect(step2Complete).toBeEnabled();
  });
});
