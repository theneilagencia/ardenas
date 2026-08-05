/**
 * Arden.AS — testes de contrato do runtime de agentes (ARDEN-BE-007.1).
 *
 * Validam o domínio canônico, políticas, structured output, usage, resultado, action
 * key, permissões, erros e a formalização dos endpoints/OpenAPI. Sem persistência, sem
 * runtime, sem SDK — apenas contratos.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/domain/permissions';
import { apiErrorCode, ERROR_HTTP_STATUS } from '../common/api-error';
import { endpoints, schemaRegistry } from '../registry';
import { executorActionKey, isAgentExecutorActionKey } from '../executions/executions.schemas';
import {
  agentStatus,
  agentVersionStatus,
  modelConfigurationStatus,
  modelProviderKey,
  AGENT_EXECUTE_ACTION_KEY,
  agentDefinition,
  createAgentRequest,
  updateAgentRequest,
  agentVersion,
  agentContextPolicy,
  agentExecutionPolicy,
  agentToolPolicy,
  agentEvaluationPolicy,
  agentCostPolicy,
  agentStructuredOutput,
  agentUsage,
  agentExecutionResult,
  agentExecutionResultInvariants,
  modelParameters,
  modelConfiguration,
  createModelConfigurationRequest,
  MODEL_PROVIDER_DEFINITIONS,
  projectModelProviders,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
} from './index';

const SENSITIVE_KEYS = ['secret', 'apiKey', 'ciphertext', 'encryptedSecret', 'encryptedDataKey', 'nonce', 'authTag', 'masterKey', 'password', 'token', 'credential'];

function shapeKeys(schema: z.ZodTypeAny): string[] {
  return schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
}

describe('domínio canônico — status e chaves', () => {
  it('status de agente válido e REVOKED presente (terminal)', () => {
    expect(agentStatus.options).toEqual(['DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
  });

  it('status de versão inclui PUBLISHED e RETIRED', () => {
    expect(agentVersionStatus.options).toEqual(['DRAFT', 'PUBLISHED', 'RETIRED']);
  });

  it('status de configuração de modelo inclui REVOKED (terminal)', () => {
    expect(modelConfigurationStatus.options).toContain('REVOKED');
  });

  it('providerKey aceita slug estável e rejeita texto livre', () => {
    expect(modelProviderKey.safeParse('internal.test-model').success).toBe(true);
    expect(modelProviderKey.safeParse('Bad Key!').success).toBe(false);
  });

  it('agentKey é validado (slug) na request de criação', () => {
    expect(createAgentRequest.safeParse({ key: 'classifier.v1', name: 'X' }).success).toBe(true);
    expect(createAgentRequest.safeParse({ key: 'NOT VALID', name: 'X' }).success).toBe(false);
  });
});

describe('provider de modelo — teste bloqueado em produção', () => {
  it('o provider de teste existe e NÃO é permitido em produção', () => {
    const test = MODEL_PROVIDER_DEFINITIONS.find((p) => p.key === 'internal.test-model')!;
    expect(test.productionAllowed).toBe(false);
    expect(test.systemManaged).toBe(true);
  });

  it('projeção pura valida o catálogo de providers', () => {
    expect(projectModelProviders().length).toBe(MODEL_PROVIDER_DEFINITIONS.length);
  });
});

describe('configuração de modelo — parâmetros e segredo', () => {
  it('maximumOutputTokens deve ser positivo', () => {
    expect(modelParameters.safeParse({ maximumOutputTokens: 0 }).success).toBe(false);
    expect(modelParameters.safeParse({ maximumOutputTokens: 1024 }).success).toBe(true);
  });

  it('temperature/topP dentro dos limites', () => {
    expect(modelParameters.safeParse({ maximumOutputTokens: 10, temperature: 3 }).success).toBe(false);
    expect(modelParameters.safeParse({ maximumOutputTokens: 10, topP: 1.5 }).success).toBe(false);
  });

  it('a resposta de configuração NÃO declara credencial/segredo', () => {
    const keys = shapeKeys(modelConfiguration);
    for (const k of SENSITIVE_KEYS) expect(keys, k).not.toContain(k);
    // Referência à conexão do cofre é permitida (não é o segredo).
    expect(keys).toContain('credentialConnectionId');
  });

  it('requests não trazem organizationId (tenant no path)', () => {
    expect(shapeKeys(createModelConfigurationRequest)).not.toContain('organizationId');
    expect(shapeKeys(createAgentRequest)).not.toContain('organizationId');
    expect(shapeKeys(updateAgentRequest)).not.toContain('organizationId');
  });
});

describe('políticas — limites e defaults seguros', () => {
  it('context policy exige tetos positivos e allowlist limitada', () => {
    const ok = agentContextPolicy.safeParse({
      includeExecutionInput: true, includeOperationMetadata: true,
      previousStepOutputs: { enabled: false, allowedStepKeys: [] },
      linkedDocuments: { enabled: false, documentReferenceIds: [] },
      toolResults: { enabled: false, allowedToolAliases: [] },
      maximumContextBytes: 1024, maximumInputTokens: 1000, redactSensitiveFields: true,
    });
    expect(ok.success).toBe(true);
    const bad = agentContextPolicy.safeParse({
      includeExecutionInput: true, includeOperationMetadata: true,
      previousStepOutputs: { enabled: false, allowedStepKeys: [] },
      linkedDocuments: { enabled: false, documentReferenceIds: [] },
      toolResults: { enabled: false, allowedToolAliases: [] },
      maximumContextBytes: 0, maximumInputTokens: 1000, redactSensitiveFields: true,
    });
    expect(bad.success).toBe(false);
  });

  it('execution policy: toolCalling=false implica maximumToolCalls=0', () => {
    const base = {
      maximumTurns: 1, maximumDurationMs: 1000, maximumInputTokens: 100, maximumOutputTokens: 100,
      structuredOutputRequired: true, retryInvalidOutput: false, maximumOutputRepairAttempts: 0,
      timeoutBehavior: 'FAIL' as const, unknownResultBehavior: 'FAIL' as const,
    };
    expect(agentExecutionPolicy.safeParse({ ...base, toolCallingAllowed: false, maximumToolCalls: 0 }).success).toBe(true);
    expect(agentExecutionPolicy.safeParse({ ...base, toolCallingAllowed: false, maximumToolCalls: 2 }).success).toBe(false);
  });

  it('execution policy: maximumTurns deve ser positivo', () => {
    const base = {
      maximumTurns: 0, maximumToolCalls: 0, maximumDurationMs: 1000, maximumInputTokens: 100, maximumOutputTokens: 100,
      structuredOutputRequired: true, toolCallingAllowed: false, retryInvalidOutput: false, maximumOutputRepairAttempts: 0,
      timeoutBehavior: 'FAIL' as const, unknownResultBehavior: 'FAIL' as const,
    };
    expect(agentExecutionPolicy.safeParse(base).success).toBe(false);
  });

  it('tool policy: destructive/financial/security-critical são false no default seguro', () => {
    const parsed = agentToolPolicy.parse(AGENT_TOOL_POLICY_SAFE_DEFAULT);
    expect(parsed.allowDestructive).toBe(false);
    expect(parsed.allowFinancial).toBe(false);
    expect(parsed.allowSecurityCritical).toBe(false);
  });

  it('tool policy: maximumCallsPerAlias só aceita aliases allowlistados', () => {
    const bad = agentToolPolicy.safeParse({
      allowedAliases: ['a'], maximumCallsPerAlias: { b: 1 },
      allowRead: true, allowWrite: false, allowDestructive: false, allowFinancial: false,
      allowSecurityCritical: false, requireAuthorizationFor: [],
    });
    expect(bad.success).toBe(false);
  });

  it('evaluation policy: judge não-advisory sozinho é rejeitado; default é advisory', () => {
    // Default seguro tem verificação determinística.
    expect(agentEvaluationPolicy.safeParse(AGENT_EVALUATION_POLICY_SAFE_DEFAULT).success).toBe(true);
    // Judge não-advisory sem nenhuma verificação determinística → rejeitado.
    const bad = agentEvaluationPolicy.safeParse({
      requireValidOutputSchema: false, requireCompletionCriteria: false, requireEvidenceReferences: false,
      forbiddenOutputPaths: [], requiredOutputPaths: [], deterministicChecks: [],
      llmJudge: { enabled: true, advisoryOnly: false },
    });
    expect(bad.success).toBe(false);
  });

  it('cost policy: custo estimado exige currency ISO', () => {
    const bad = agentCostPolicy.safeParse({
      maximumEstimatedCostMinor: 100, currency: null,
      maximumInputTokens: 10, maximumOutputTokens: 10, maximumToolCalls: 0, actionOnLimit: 'FAIL',
    });
    expect(bad.success).toBe(false);
    const ok = agentCostPolicy.safeParse({
      maximumEstimatedCostMinor: 100, currency: 'BRL',
      maximumInputTokens: 10, maximumOutputTokens: 10, maximumToolCalls: 0, actionOnLimit: 'FAIL',
    });
    expect(ok.success).toBe(true);
  });
});

describe('structured output e usage', () => {
  it('structured output limita repair attempts e bytes', () => {
    expect(agentStructuredOutput.safeParse({ schema: {}, rawOutputRetained: true, acceptedOutputRetained: true, maximumOutputBytes: 1024, maximumRepairAttempts: 1 }).success).toBe(true);
    expect(agentStructuredOutput.safeParse({ schema: {}, rawOutputRetained: true, acceptedOutputRetained: true, maximumOutputBytes: 0, maximumRepairAttempts: 1 }).success).toBe(false);
    expect(agentStructuredOutput.safeParse({ schema: {}, rawOutputRetained: true, acceptedOutputRetained: true, maximumOutputBytes: 1024, maximumRepairAttempts: 99 }).success).toBe(false);
  });

  it('usage não aceita tokens negativos; currency ISO quando presente', () => {
    expect(agentUsage.safeParse({ providerKey: 'internal.test-model', modelId: 'm', inputTokens: -1, outputTokens: 0, toolCallCount: 0, modelCallCount: 0, durationMs: 0 }).success).toBe(false);
    expect(agentUsage.safeParse({ providerKey: 'internal.test-model', modelId: 'm', inputTokens: 1, outputTokens: 1, toolCallCount: 0, modelCallCount: 1, durationMs: 10, currency: 'usd' }).success).toBe(false);
  });
});

describe('resultado de execução — invariantes', () => {
  const base = { usage: agentUsage.parse({ providerKey: 'internal.test-model', modelId: 'm', inputTokens: 0, outputTokens: 0, toolCallCount: 0, modelCallCount: 0, durationMs: 0 }), modelCallCount: 0, toolCallCount: 0, turnCount: 0, evidenceReferenceIds: [], durationMs: 0 };

  it('SUCCEEDED exige output', () => {
    const r = agentExecutionResult.parse({ status: 'SUCCEEDED', output: { ok: true }, ...base });
    expect(agentExecutionResultInvariants(r)).toEqual([]);
    const noOutput = agentExecutionResult.parse({ status: 'SUCCEEDED', ...base });
    expect(agentExecutionResultInvariants(noOutput).length).toBeGreaterThan(0);
  });

  it('FAILED exige erro', () => {
    const r = agentExecutionResult.parse({ status: 'FAILED', ...base });
    expect(agentExecutionResultInvariants(r).length).toBeGreaterThan(0);
    const ok = agentExecutionResult.parse({ status: 'FAILED', errorCode: 'AGENT_OUTPUT_INVALID', ...base });
    expect(agentExecutionResultInvariants(ok)).toEqual([]);
  });

  it('UNKNOWN não vira sucesso silencioso', () => {
    const bad = agentExecutionResult.parse({ status: 'UNKNOWN', output: { x: 1 }, ...base });
    expect(agentExecutionResultInvariants(bad).length).toBeGreaterThan(0);
  });
});

describe('action key — agent.execute conhecida; sem chat direto', () => {
  it('agent.execute está no executorActionKey', () => {
    expect(executorActionKey.options).toContain(AGENT_EXECUTE_ACTION_KEY);
    expect(isAgentExecutorActionKey('agent.execute')).toBe(true);
    expect(isAgentExecutorActionKey('system.noop')).toBe(false);
  });

  it('nenhuma action key de chat/model.generate/agent.run existe', () => {
    for (const forbidden of ['model.generate', 'model.chat', 'model.complete', 'agent.run', 'agent.chat']) {
      expect(executorActionKey.options).not.toContain(forbidden);
    }
  });
});

describe('permissões — sincronia e sem duplicação', () => {
  it('ALL_PERMISSIONS não tem duplicatas', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('as permissões de agente foram adicionadas', () => {
    const expected = [
      'agent.view', 'agent.create', 'agent.edit', 'agent.publish', 'agent.suspend', 'agent.revoke',
      'agent.execute', 'agent.cost.view', 'model_provider.view', 'model_provider.manage',
      'model_configuration.view', 'model_configuration.create', 'model_configuration.edit', 'model_configuration.revoke',
    ];
    expect(ALL_PERMISSIONS).toEqual(expect.arrayContaining(expected));
  });

  it('todo papel referencia apenas permissões existentes', () => {
    const catalog = new Set<string>(ALL_PERMISSIONS);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(catalog.has(p), `${role} → ${p}`).toBe(true);
    }
  });

  it('auditor não recebe agent.execute (sem execução)', () => {
    expect(ROLE_PERMISSIONS.auditor).not.toContain('agent.execute');
    expect(ROLE_PERMISSIONS.auditor).toContain('agent.view');
  });
});

describe('erros — novos códigos sem duplicação e com status válido', () => {
  it('apiErrorCode não tem duplicatas', () => {
    expect(new Set(apiErrorCode.options).size).toBe(apiErrorCode.options.length);
  });

  it('os códigos de agente foram adicionados com status coerente', () => {
    expect(ERROR_HTTP_STATUS.AGENT_NOT_FOUND).toBe(404);
    expect(ERROR_HTTP_STATUS.AGENT_VERSION_NOT_PUBLISHED).toBe(409);
    expect(ERROR_HTTP_STATUS.AGENT_OUTPUT_INVALID).toBe(502);
    expect(ERROR_HTTP_STATUS.AGENT_TOOL_NOT_ALLOWED).toBe(403);
    expect(ERROR_HTTP_STATUS.MODEL_RESULT_UNKNOWN).toBe(502);
    expect(ERROR_HTTP_STATUS.AGENT_PROMPT_INJECTION_DETECTED).toBe(403);
  });

  it('todo código de agente tem status >= 400', () => {
    for (const code of apiErrorCode.options) {
      if (code.startsWith('AGENT_') || code.startsWith('MODEL_')) {
        expect(ERROR_HTTP_STATUS[code], code).toBeGreaterThanOrEqual(400);
      }
    }
  });
});

describe('endpoints — operationIds únicos e schemas existentes', () => {
  const agentEndpoints = endpoints.filter((e) => e.tag === 'Agents');

  it('operationIds são únicos em TODA a API', () => {
    const ids = endpoints.map((e) => e.id);
    expect(new Set(ids).size, 'operationIds duplicados').toBe(ids.length);
  });

  it('há endpoints de agente formalizados', () => {
    expect(agentEndpoints.length).toBeGreaterThanOrEqual(16);
  });

  it('todo endpoint de agente referencia schemas registrados', () => {
    for (const e of agentEndpoints) {
      expect(schemaRegistry[e.responseSchema], `${e.id} response ${e.responseSchema}`).toBeDefined();
      if (e.requestSchema) expect(schemaRegistry[e.requestSchema], `${e.id} request ${e.requestSchema}`).toBeDefined();
      if (e.querySchema) expect(schemaRegistry[e.querySchema], `${e.id} query ${e.querySchema}`).toBeDefined();
    }
  });

  it('comandos de estado usam idempotência e concorrência otimista', () => {
    const suspend = endpoints.find((e) => e.id === 'agents.suspend')!;
    expect(suspend.idempotent).toBe(true);
    expect(suspend.optimisticConcurrency).toBe(true);
    const publish = endpoints.find((e) => e.id === 'agentVersions.publish')!;
    expect(publish.idempotent).toBe(true);
    expect(publish.optimisticConcurrency).toBe(true);
  });

  it('create/version.create são idempotentes', () => {
    expect(endpoints.find((e) => e.id === 'agents.create')!.idempotent).toBe(true);
    expect(endpoints.find((e) => e.id === 'agentVersions.create')!.idempotent).toBe(true);
    expect(endpoints.find((e) => e.id === 'modelConfigurations.create')!.idempotent).toBe(true);
  });

  it('providers são leitura pública tenant-agnostic (sem organizationId no path)', () => {
    const list = endpoints.find((e) => e.id === 'modelProviders.list')!;
    expect(list.pathParams).not.toContain('organizationId');
    expect(list.permission).toBe('model_provider.view');
  });
});

describe('OperationVersion — integração contratual da etapa de agente', () => {
  it('agentVersion carrega objetivo, instruções e políticas versionadas', () => {
    const keys = shapeKeys(agentVersion);
    for (const k of ['objective', 'systemInstructions', 'modelConfigurationId', 'contextPolicy', 'executionPolicy', 'toolPolicy', 'evaluationPolicy', 'costPolicy', 'outputSchema']) {
      expect(keys, k).toContain(k);
    }
  });

  it('agentDefinition não expõe versão como mutável (revision presente)', () => {
    expect(shapeKeys(agentDefinition)).toContain('revision');
    expect(shapeKeys(agentDefinition)).toContain('currentPublishedVersionId');
  });
});
