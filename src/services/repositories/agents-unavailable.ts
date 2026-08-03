/**
 * Arden.AS — stub de agentes para os modos mock/IndexedDB (ARDEN-BE-007.7).
 *
 * O domínio de agentes (definições, versões, configurações de modelo, resultados
 * e uso) é API-ONLY: não há persistência local. Leituras (listas) retornam vazio
 * — a UI trata como estado vazio, nunca inventa resultado, custo ou usage.
 * Escritas lançam `ArdenRepositoryError('UNAVAILABLE')`. NUNCA quebra a
 * inicialização do app nos modos mock/indexeddb; NUNCA há execução local de agente.
 */

import type { AgentsRepository, CursorPage } from '@/services/contracts';
import { ArdenRepositoryError } from '@/services/errors';

function unavailable(action: string): never {
  throw new ArdenRepositoryError(
    'UNAVAILABLE',
    `Agentes (${action}) só estão disponíveis no modo api (VITE_DATA_PROVIDER=api).`,
  );
}

const emptyPage: CursorPage<never> = { items: [], cursor: null, hasNextPage: false };

/** Repositório de agentes indisponível fora do modo api (sem fallback silencioso). */
export function createUnavailableAgentsRepository(): AgentsRepository {
  return {
    listAgents: async () => emptyPage,
    getAgent: async () => unavailable('agents.get'),
    createAgent: async () => unavailable('agents.create'),
    updateAgent: async () => unavailable('agents.update'),
    suspendAgent: async () => unavailable('agents.suspend'),
    reactivateAgent: async () => unavailable('agents.reactivate'),
    revokeAgent: async () => unavailable('agents.revoke'),

    listAgentVersions: async () => emptyPage,
    getAgentVersion: async () => unavailable('agentVersions.get'),
    createAgentVersion: async () => unavailable('agentVersions.create'),
    updateAgentVersion: async () => unavailable('agentVersions.update'),
    publishAgentVersion: async () => unavailable('agentVersions.publish'),
    retireAgentVersion: async () => unavailable('agentVersions.retire'),

    listModelProviders: async () => [],
    getModelProvider: async () => unavailable('modelProviders.get'),

    listModelConfigurations: async () => emptyPage,
    getModelConfiguration: async () => unavailable('modelConfigurations.get'),
    createModelConfiguration: async () => unavailable('modelConfigurations.create'),
    updateModelConfiguration: async () => unavailable('modelConfigurations.update'),
    activateModelConfiguration: async () => unavailable('modelConfigurations.activate'),
    suspendModelConfiguration: async () => unavailable('modelConfigurations.suspend'),
    revokeModelConfiguration: async () => unavailable('modelConfigurations.revoke'),

    listAgentResults: async () => emptyPage,
    getAgentResult: async () => unavailable('agentResults.get'),
    getAgentUsage: async () => [],
    getExecutionAgentUsage: async () => [],
  };
}
