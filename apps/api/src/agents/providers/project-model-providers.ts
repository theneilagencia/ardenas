/**
 * Arden.AS API — projeção PURA do catálogo canônico de providers (ARDEN-BE-007.2 §12).
 *
 * Reutilizada pelo SEED (PrismaClient standalone) e pelo projector Nest (via transação).
 * Idempotente: cria ausentes; atualiza campos system-managed só quando o `catalogHash`
 * muda; marca providers removidos do canônico como DEPRECATED — sem apagar histórico e
 * sem tocar dados tenant-scoped. `internal.test-model` permanece `productionAllowed=false`.
 */

import { projectModelProviders, type ModelProviderDefinition } from '@arden/contracts';
import { stableHash } from '../hashing/stable-hash';

/** Subconjunto do PrismaClient necessário à projeção (também satisfeito por tx). */
export interface ModelProviderDbClient {
  modelProviderDefinition: {
    findFirst(args: unknown): Promise<{ id: string; catalogHash: string; status: string } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; key: string; version: string; status: string; systemManaged: boolean }>>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
}

export interface ModelProviderProjectionResult {
  providersCreated: number;
  providersUpdated: number;
  providersUnchanged: number;
  providersDeprecated: number;
}

function providerData(def: ModelProviderDefinition) {
  return {
    key: def.key,
    version: def.version,
    name: def.name,
    description: def.description ?? null,
    // Honra o status canônico: providers comerciais entram DISABLED (ex.: anthropic.direct,
    // ARDEN-BE-008.2) enquanto verificação/execução estão pendentes. `internal.test-model`
    // permanece ACTIVE. Nunca inferir ACTIVE por conveniência.
    status: def.status,
    capabilities: def.capabilities,
    productionAllowed: def.productionAllowed,
    systemManaged: def.systemManaged,
    catalogHash: stableHash(def),
  };
}

export async function runModelProviderCatalogProjection(
  db: ModelProviderDbClient,
): Promise<ModelProviderProjectionResult> {
  const definitions = projectModelProviders();
  const result: ModelProviderProjectionResult = {
    providersCreated: 0,
    providersUpdated: 0,
    providersUnchanged: 0,
    providersDeprecated: 0,
  };

  const canonicalKeys = new Set(definitions.map((d) => `${d.key}@${d.version}`));

  for (const def of definitions) {
    const data = providerData(def);
    const existing = await db.modelProviderDefinition.findFirst({
      where: { key: def.key, version: def.version },
    });
    if (!existing) {
      await db.modelProviderDefinition.create({ data });
      result.providersCreated++;
    } else if (existing.catalogHash === data.catalogHash && existing.status === data.status) {
      result.providersUnchanged++;
    } else {
      await db.modelProviderDefinition.update({ where: { id: existing.id }, data });
      result.providersUpdated++;
    }
  }

  // Providers system-managed removidos do canônico → DEPRECATED (nunca apagados).
  for (const existing of await db.modelProviderDefinition.findMany({ orderBy: { key: 'asc' } })) {
    if (
      existing.systemManaged &&
      !canonicalKeys.has(`${existing.key}@${existing.version}`) &&
      existing.status === 'ACTIVE'
    ) {
      await db.modelProviderDefinition.update({ where: { id: existing.id }, data: { status: 'DEPRECATED' } });
      result.providersDeprecated++;
    }
  }

  return result;
}
