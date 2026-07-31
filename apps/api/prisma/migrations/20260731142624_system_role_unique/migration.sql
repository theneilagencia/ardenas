-- Garante unicidade dos PAPÉIS DE SISTEMA (organization_id IS NULL).
-- O índice único composto ([organization_id, key]) não cobre este caso porque, em
-- SQL, NULL é distinto de NULL — então duas linhas (NULL, 'analyst') seriam
-- permitidas. Este índice PARCIAL fecha a lacuna: no máximo um papel de sistema
-- por chave.
CREATE UNIQUE INDEX "uniq_system_role_key"
  ON "roles" ("key")
  WHERE "organization_id" IS NULL;
