/**
 * Arden.AS API — seed idempotente do catálogo (ARDEN-BE-002).
 *
 * Semeia o CATÁLOGO ESTÁVEL de permissões e os papéis de sistema a partir da
 * FONTE ÚNICA do frontend (`src/domain/permissions`, ARDEN-FE-002) — sem
 * duplicar. Idempotente (upsert + convergência). NÃO cria usuário/organização de
 * demonstração. Executado fora da API pública (`npm run db:seed`).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../../../src/domain/permissions';
import type { RoleKey } from '../../../src/domain/types';
import { runCatalogProjection, type CatalogDbClient } from '../src/connectors/catalog/project-catalog';
import {
  runModelProviderCatalogProjection,
  type ModelProviderDbClient,
} from '../src/agents/providers/project-model-providers';
import {
  runModelCatalogProjection,
  type ModelCatalogDbClient,
} from '../src/agents/providers/project-model-catalog';
import { runRateCardProjection, type RateCardDbClient } from '../src/agents/governance/rate-card.projector';

/** Nomes legíveis dos papéis de sistema (chaves = catálogo do frontend). */
export const SYSTEM_ROLE_NAMES: Record<RoleKey, string> = {
  corporate_admin: 'Administrador corporativo',
  financial_admin: 'Administrador financeiro',
  operation_owner: 'Proprietário da operação',
  supervisor: 'Supervisor',
  approver: 'Aprovador',
  security_admin: 'Administrador de segurança',
  analyst: 'Analista',
  auditor: 'Auditor',
};

export interface SeedResult {
  permissions: number;
  roles: number;
}

/** Semeia permissões + papéis de sistema + relação papel→permissão (idempotente). */
export async function seedIdentityCatalog(prisma: PrismaClient): Promise<SeedResult> {
  // 1. Permissões (idempotente e concorrência-segura — ARDEN-SCOPE-002 GAP-008).
  // `createMany` com `skipDuplicates` emite INSERT ... ON CONFLICT DO NOTHING numa única
  // instrução atômica, eliminando a corrida do `upsert` por-chave (SELECT-then-write) sob
  // re-seed concorrente. `description` = key (imutável; nada a atualizar).
  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({ key, description: key })),
    skipDuplicates: true,
  });

  // 2. Papéis de sistema + suas permissões.
  const roleKeys = Object.keys(ROLE_PERMISSIONS) as RoleKey[];
  for (const key of roleKeys) {
    // Concorrência-segura (GAP-008): sob re-seed simultâneo, dois `create` para a mesma
    // system-role colidiriam no índice único parcial `uniq_system_role_key`. Tratamos a
    // colisão (P2002) re-buscando o papel já criado pelo outro processo — idempotente.
    let role = await prisma.role.findFirst({ where: { organizationId: null, key } });
    if (!role) {
      try {
        role = await prisma.role.create({
          data: {
            organizationId: null,
            key,
            name: SYSTEM_ROLE_NAMES[key] ?? key,
            system: true,
            status: 'ACTIVE',
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          role = await prisma.role.findFirstOrThrow({ where: { organizationId: null, key } });
        } else {
          throw err;
        }
      }
    }

    const permKeys = ROLE_PERMISSIONS[key];
    const perms = await prisma.permission.findMany({ where: { key: { in: permKeys } } });
    // Idempotente e concorrência-segura: INSERT ... ON CONFLICT DO NOTHING em lote.
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    // Convergência: remove permissões que não pertencem mais ao papel.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { key: { notIn: permKeys } } },
    });
  }

  return { permissions: ALL_PERMISSIONS.length, roles: roleKeys.length };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await seedIdentityCatalog(prisma);
    // Projeta o catálogo canônico de conectores DEPOIS das permissões (idempotente;
    // não toca dados tenant-scoped; internal.test permanece productionAllowed=false).
    const catalog = await prisma.$transaction((tx) => runCatalogProjection(tx as unknown as CatalogDbClient));
    // Projeta o catálogo canônico de providers de modelo (idempotente; system-managed;
    // internal.test-model permanece productionAllowed=false).
    const providers = await prisma.$transaction((tx) =>
      runModelProviderCatalogProjection(tx as unknown as ModelProviderDbClient),
    );
    // Projeta o catálogo persistido de modelos (008.2): Anthropic DISABLED / não executável.
    const models = await prisma.$transaction((tx) =>
      runModelCatalogProjection(tx as unknown as ModelCatalogDbClient),
    );
    // Projeta o catálogo INTERNO de rate cards estimados (007.6): internal.test-model = 0 USD.
    // Rate cards comerciais Anthropic NÃO são projetados (preço UNVERIFIED — 008.2A).
    const rateCards = await prisma.$transaction((tx) =>
      runRateCardProjection(tx as unknown as RateCardDbClient),
    );
    // eslint-disable-next-line no-console
    console.log(
      `Seed do catálogo concluído: ${result.permissions} permissões, ${result.roles} papéis, ` +
        `conectores (+${catalog.connectorsCreated}/~${catalog.connectorsUnchanged}), ferramentas (+${catalog.toolsCreated}/~${catalog.toolsUnchanged}), ` +
        `providers (+${providers.providersCreated}/~${providers.providersUnchanged}), ` +
        `modelos (+${models.created}/~${models.unchanged}), ` +
        `rate cards (+${rateCards.created}/~${rateCards.unchanged}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Executa como CLI apenas quando invocado pelo script `db:seed` (guarda explícita
// — não depende de require.main, que não é confiável sob vite-node/ESM).
if (process.env.ARDEN_CLI === 'seed') {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Falha no seed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
