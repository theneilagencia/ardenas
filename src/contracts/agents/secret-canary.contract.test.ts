/**
 * Arden.AS — testes CRÍTICOS do runtime de agentes (ARDEN-BE-007.1):
 *  (1) canário de segredo jamais vaza por contrato de saída/OpenAPI/cliente;
 *  (2) NÃO existe endpoint de execução direta de agente/modelo — a execução ocorre
 *      exclusivamente pela etapa de operação `agent.execute`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildOpenApiDocument } from '../openapi/build-openapi';
import { endpoints } from '../registry';
import { agentDefinition } from './agent-definition.schema';
import { agentVersion } from './agent-version.schema';
import { modelConfiguration } from './model-configuration.schema';

const CANARY = 'ARDEN_BE007_CONTRACT_SECRET_CANARY';

describe('canário de segredo — contratos de saída do runtime de agentes', () => {
  it('o documento OpenAPI não contém o canário nem segredos em exemplo', () => {
    const doc = JSON.stringify(buildOpenApiDocument());
    expect(doc.includes(CANARY)).toBe(false);
    expect(doc.toLowerCase().includes('"apikey":"')).toBe(false);
    expect(doc.toLowerCase().includes('"secret":"')).toBe(false);
  });

  it('o cliente gerado não contém o canário', () => {
    for (const file of [
      'src/services/api/generated/api-v1-client.ts',
      'src/services/api/v1-http-client.ts',
    ]) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes(CANARY), file).toBe(false);
    }
  });

  it('a resposta de agente descarta qualquer segredo injetado', () => {
    const parsed = agentDefinition.parse({
      id: 'agent_1', organizationId: 'org_1', key: 'classifier', name: 'X', description: null,
      status: 'DRAFT', currentPublishedVersionId: null, createdByUserId: 'user_1', revision: 0,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      apiKey: CANARY, secret: CANARY, credential: CANARY,
    } as never);
    expect(JSON.stringify(parsed).includes(CANARY)).toBe(false);
  });

  it('a configuração de modelo descarta qualquer credencial injetada', () => {
    const parsed = modelConfiguration.parse({
      id: 'cfg_1', organizationId: 'org_1', providerKey: 'internal.test-model', providerVersion: '1',
      name: 'X', modelId: 'test', credentialConnectionId: null,
      parameters: { maximumOutputTokens: 256 }, status: 'DRAFT', createdByUserId: 'user_1', revision: 0,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      apiKey: CANARY, secret: CANARY, credential: CANARY,
    } as never);
    expect(JSON.stringify(parsed).includes(CANARY)).toBe(false);
  });

  it('a versão de agente não declara campos de segredo/provider bruto', () => {
    const keys = Object.keys((agentVersion as { shape: Record<string, unknown> }).shape);
    for (const forbidden of ['apiKey', 'secret', 'credential', 'providerSecret', 'rawProvider']) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
  });
});

describe('ausência de execução direta — só via etapa agent.execute', () => {
  const FORBIDDEN = [
    /\/agents\/\{[^}]+\}\/run\b/,
    /\/agents\/\{[^}]+\}\/execute\b/,
    /\/agents\/\{[^}]+\}\/chat\b/,
    /\/models\/generate\b/,
    /^\/api\/v1\/chat\b/,
    /\/chat\/completions\b/,
  ];

  it('nenhum endpoint contratado casa com um padrão de execução direta', () => {
    for (const e of endpoints) {
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(e.path), `${e.id} → ${e.path}`).toBe(false);
      }
    }
  });

  it('o documento OpenAPI não expõe paths de execução direta', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown> };
    for (const path of Object.keys(doc.paths)) {
      expect(/\/(run|execute|chat)\b/.test(path) && path.includes('/agents/'), path).toBe(false);
      expect(path.includes('/models/generate'), path).toBe(false);
    }
  });

  it('a única action key de execução de agente é agent.execute', () => {
    const list = endpoints.map((e) => e.path).join('\n');
    expect(list.includes('/agents/') && list.includes('/run')).toBe(false);
    // agent.execute NÃO é um endpoint HTTP — é resolvido pelo motor de execuções.
    expect(endpoints.some((e) => e.path.includes('agent.execute'))).toBe(false);
  });
});

describe('tipos internos — sem SDK de provider', () => {
  it('os arquivos de contrato de agente não importam SDKs de LLM', () => {
    const files = [
      'src/contracts/agents/agent-execution-result.schema.ts',
      'src/contracts/agents/agent-prompt.schema.ts',
      'src/contracts/agents/agent-tool-policy.schema.ts',
      'src/contracts/agents/model-provider.schema.ts',
      'src/contracts/agents/agent-runtime.interfaces.ts',
    ];
    const forbidden = ['@anthropic-ai', 'openai', 'bedrock', 'vertexai', 'langchain', 'llamaindex'];
    for (const file of files) {
      const src = readFileSync(file, 'utf8').toLowerCase();
      for (const dep of forbidden) expect(src.includes(`from '${dep}`), `${file} imports ${dep}`).toBe(false);
    }
  });
});
