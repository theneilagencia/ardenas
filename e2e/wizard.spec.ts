import { test, expect } from '@playwright/test';

test.describe('Wizard — bloqueio real na publicação', () => {
  test('publicar fica indisponível com bloqueadores e habilita ao resolvê-los', async ({ page }) => {
    await page.goto('/operations/new');

    const publish = page.getByTestId('wizard-publish');
    await expect(publish).toBeDisabled();

    // Etapa de revisão (19) lista os bloqueadores.
    await page.getByRole('tab', { name: /19|Revisão|Review/ }).click();
    await expect(page.getByText(/Publicação indisponível|Publish unavailable/)).toBeVisible();

    // Resolve os campos que destravam a publicação.
    await page.getByRole('tab', { name: /^1\b|Identidade|Identity/ }).click();
    await page.getByLabel(/Nome da operação|Operation name/).fill('Operação E2E');

    await page.getByRole('tab', { name: /Resultado esperado|Expected result/ }).click();
    await page.getByLabel(/Resultado esperado|Expected result/).fill('Resultado verificável.');

    await page.getByRole('tab', { name: /Responsáveis|Responsibles/ }).click();
    await page.getByLabel(/Responsável|Owner/).selectOption({ index: 1 });

    await page.getByRole('tab', { name: /Limites|Limits/ }).click();
    await page.getByLabel(/Ambiente|Environment/).selectOption('production');
    await page.getByLabel(/Orçamento|Budget/).fill('5000');
    await page.getByLabel(/Política de evidência|Evidence policy/).fill('Evidência por etapa.');

    await expect(publish).toBeEnabled();
  });
});
