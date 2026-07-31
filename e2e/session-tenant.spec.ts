import { test, expect, type Page } from '@playwright/test';

/**
 * ARDEN-FE-002 — sessão e tenant. Provas de ponta a ponta (provider IndexedDB):
 * isolamento entre organizações, estado de sessão expirada e defesa de UX por
 * permissão. Nada aqui é segurança de produção — o backend revalidará cada ação.
 */

async function switchOrg(page: Page, slug: string, expectedName: string) {
  await page.getByTestId('org-switch').click();
  await page.getByTestId(`org-option-${slug}`).click();
  // Aguarda a troca efetivar (e persistir a seleção) antes de navegar/recarregar.
  await expect(page.getByTestId('org-switch')).toContainText(expectedName);
}

async function createOperation(page: Page, name: string) {
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
  await expect(page).toHaveURL(/\/operations\/op_/);
}

test('Fluxo 1 — dados não vazam entre organizações ao trocar de tenant', async ({ page }) => {
  const name = `Operação Tenant ${Date.now()}`;

  // Organização A (Grupo Atlas): cria uma operação e confirma no catálogo.
  await createOperation(page, name);
  await page.goto('/operations');
  await expect(page.getByRole('link', { name })).toBeVisible();

  // Troca para a Organização B (Horizonte Holdings, vazia).
  await switchOrg(page, 'horizonte-holdings', 'Horizonte Holdings');

  // A operação da Organização A NÃO aparece na Organização B.
  await page.goto('/operations');
  await expect(page.getByRole('link', { name })).toHaveCount(0);

  // Volta para a Organização A: a operação aparece novamente.
  await switchOrg(page, 'grupo-atlas', 'Grupo Atlas');
  await page.goto('/operations');
  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('Fluxo 2 — sessão expirada bloqueia rota protegida e não carrega dados', async ({ page }) => {
  await page.goto('/operations?sim=expired');

  // Estado de sessão expirada é distinto e explícito.
  await expect(page.getByTestId('session-state-title')).toBeVisible();
  await expect(page.getByTestId('session-state-title')).toHaveText(/expirad|expired/i);

  // Não há dados organizacionais: o seletor de organização (casca) não é montado.
  await expect(page.getByTestId('org-switch')).toHaveCount(0);
});

test('Fluxo 3 — sem permissão de publicação, publicar fica indisponível', async ({ page }) => {
  // Papel simulado sem operation.publish (proprietário da operação).
  await page.goto('/operations/new?sim=role:operation_owner');

  // A ação de publicar não está disponível (defesa de experiência).
  await expect(page.getByTestId('publish-no-permission')).toBeVisible();
  await expect(page.getByTestId('wizard-publish')).toBeDisabled();
});
