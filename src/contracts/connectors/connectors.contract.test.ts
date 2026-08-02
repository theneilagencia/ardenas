/**
 * Arden.AS — testes de contrato dos conectores (ARDEN-BE-006.2).
 * Validam o catálogo canônico, a segurança dos schemas (request ≠ response; sem
 * segredo em saída), permissões, erros e a formalização dos endpoints/OpenAPI.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/domain/permissions';
import { apiErrorCode, ERROR_HTTP_STATUS } from '../common/api-error';
import { endpoints, schemaRegistry } from '../registry';
import {
  CONNECTOR_DEFINITIONS,
  CONNECTOR_TOOLS,
  projectConnectorCatalog,
  externalActionKey,
  connection,
  createConnectionRequest,
  updateConnectionRequest,
  credentialMetadataResponseItem,
  createConnectionCredentialRequest,
  createWebhookEndpointRequest,
  PRODUCTION_NETWORK_POLICY_DEFAULTS,
  connectorToolDefinitionCanonical,
} from './index';

const SENSITIVE_KEYS = ['secret', 'ciphertext', 'encryptedSecret', 'encryptedDataKey', 'nonce', 'authTag', 'masterKey', 'password', 'token'];

function shapeKeys(schema: z.ZodTypeAny): string[] {
  return schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
}

describe('catálogo canônico — invariantes', () => {
  it('nenhum connector key+version duplicado', () => {
    const seen = new Set<string>();
    for (const c of CONNECTOR_DEFINITIONS) {
      const k = `${c.key}@${c.version}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });

  it('nenhuma tool duplicada dentro do mesmo conector/versão', () => {
    const seen = new Set<string>();
    for (const t of CONNECTOR_TOOLS) {
      const k = `${t.connectorKey}@${t.connectorVersion}::${t.key}@${t.version}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });

  it('toda tool referencia um conector existente', () => {
    for (const t of CONNECTOR_TOOLS) {
      const exists = CONNECTOR_DEFINITIONS.some((c) => c.key === t.connectorKey && c.version === t.connectorVersion);
      expect(exists, `${t.connectorKey}@${t.connectorVersion}`).toBe(true);
    }
  });

  it('toda actionKey é conhecida (enum externo)', () => {
    const known = new Set<string>(externalActionKey.options);
    for (const t of CONNECTOR_TOOLS) expect(known.has(t.actionKey), t.actionKey).toBe(true);
  });

  it('timeouts válidos (default>0, max>=default)', () => {
    for (const t of CONNECTOR_TOOLS) {
      expect(t.defaultTimeoutMs).toBeGreaterThan(0);
      expect(t.maximumTimeoutMs).toBeGreaterThanOrEqual(t.defaultTimeoutMs);
    }
  });

  it('conector de teste não é permitido em produção', () => {
    const test = CONNECTOR_DEFINITIONS.find((c) => c.key === 'internal.test')!;
    expect(test.productionAllowed).toBe(false);
    expect(test.category).toBe('INTERNAL_TEST');
  });

  it('nenhuma tool destrutiva/financeira/crítica com retry inseguro (SAFE) por default', () => {
    const unsafe = new Set(['DESTRUCTIVE', 'FINANCIAL', 'SECURITY_CRITICAL']);
    for (const t of CONNECTOR_TOOLS) {
      if (unsafe.has(t.riskLevel)) expect(t.retryMode).not.toBe('SAFE');
    }
  });

  it('o schema canônico REJEITA tool destrutiva com retryMode=SAFE', () => {
    const bad = { ...CONNECTOR_TOOLS[0], riskLevel: 'DESTRUCTIVE' as const, retryMode: 'SAFE' as const };
    expect(connectorToolDefinitionCanonical.safeParse(bad).success).toBe(false);
  });

  it('o schema canônico REJEITA maximumTimeoutMs < defaultTimeoutMs', () => {
    const bad = { ...CONNECTOR_TOOLS[0], defaultTimeoutMs: 60_000, maximumTimeoutMs: 10_000 };
    expect(connectorToolDefinitionCanonical.safeParse(bad).success).toBe(false);
  });

  it('projeção pura retorna o catálogo validado', () => {
    const projection = projectConnectorCatalog();
    expect(projection.definitions.length).toBe(CONNECTOR_DEFINITIONS.length);
    expect(projection.tools.length).toBe(CONNECTOR_TOOLS.length);
    expect(projection.definitions.length).toBeGreaterThanOrEqual(3);
  });
});

describe('network policy — defaults de produção restritivos', () => {
  it('só https, sem redirects, sem redes privadas/loopback/link-local', () => {
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowedProtocols).toEqual(['https']);
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowRedirects).toBe(false);
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.maximumRedirects).toBe(0);
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowPrivateNetworks).toBe(false);
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowLoopback).toBe(false);
    expect(PRODUCTION_NETWORK_POLICY_DEFAULTS.allowLinkLocal).toBe(false);
  });
});

describe('schemas — segredo nunca em saída; request ≠ response', () => {
  it('a resposta de conexão não declara nenhum campo sensível', () => {
    const keys = shapeKeys(connection);
    for (const k of SENSITIVE_KEYS) expect(keys, k).not.toContain(k);
  });

  it('metadata de credencial não declara campo sensível', () => {
    const keys = shapeKeys(credentialMetadataResponseItem);
    for (const k of SENSITIVE_KEYS) expect(keys, k).not.toContain(k);
    // Metadados esperados presentes.
    expect(keys).toEqual(expect.arrayContaining(['fingerprint', 'keyVersion', 'versionNumber', 'status']));
  });

  it('o request de credencial CONTÉM secret; o response NÃO', () => {
    expect(shapeKeys(createConnectionCredentialRequest)).toContain('secret');
    expect(shapeKeys(credentialMetadataResponseItem)).not.toContain('secret');
    // São schemas distintos (não reutiliza o sensível como resposta).
    expect(createConnectionCredentialRequest).not.toBe(credentialMetadataResponseItem);
  });

  it('requests de conexão não trazem organizationId (tenant no path)', () => {
    expect(shapeKeys(createConnectionRequest)).not.toContain('organizationId');
    expect(shapeKeys(updateConnectionRequest)).not.toContain('organizationId');
  });

  it('webhook: NONE não é default e exige reconhecimento explícito', () => {
    // Default é HMAC_SHA256.
    const ok = createWebhookEndpointRequest.safeParse({ connectionId: 'c1', key: 'k' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.signatureScheme).toBe('HMAC_SHA256');
    // NONE sem flag → rejeitado.
    expect(createWebhookEndpointRequest.safeParse({ connectionId: 'c1', key: 'k', signatureScheme: 'NONE' }).success).toBe(false);
    // NONE com flag → aceito.
    expect(createWebhookEndpointRequest.safeParse({ connectionId: 'c1', key: 'k', signatureScheme: 'NONE', allowInsecureNoSignature: true }).success).toBe(true);
  });
});

describe('permissões — sincronia e sem duplicação', () => {
  it('ALL_PERMISSIONS não tem duplicatas', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it('as permissões de conector foram adicionadas', () => {
    const expected = [
      'connector.view', 'connector.manage', 'connection.view', 'connection.create', 'connection.edit',
      'connection.test', 'connection.rotate_credentials', 'connection.revoke', 'tool.view', 'tool.bind',
      'webhook.view', 'webhook.manage', 'integration.execute',
    ];
    expect(ALL_PERMISSIONS).toEqual(expect.arrayContaining(expected));
  });

  it('todo papel referencia apenas permissões existentes', () => {
    const catalog = new Set<string>(ALL_PERMISSIONS);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(catalog.has(p), `${role} → ${p}`).toBe(true);
    }
  });
});

describe('erros — novos códigos sem duplicação e com status válido', () => {
  it('apiErrorCode não tem duplicatas', () => {
    expect(new Set(apiErrorCode.options).size).toBe(apiErrorCode.options.length);
  });

  it('todo código tem status HTTP >= 400', () => {
    for (const code of apiErrorCode.options) expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
  });

  it('os códigos de conector foram adicionados com status coerente', () => {
    expect(ERROR_HTTP_STATUS.SSRF_BLOCKED).toBe(403);
    expect(ERROR_HTTP_STATUS.PRIVATE_NETWORK_DENIED).toBe(403);
    expect(ERROR_HTTP_STATUS.EXTERNAL_RESULT_UNKNOWN).toBe(502);
    expect(ERROR_HTTP_STATUS.WEBHOOK_REPLAYED).toBe(409);
    expect(ERROR_HTTP_STATUS.CREDENTIAL_ROTATION_CONFLICT).toBe(409);
  });
});

describe('endpoints — operationIds únicos e schemas existentes', () => {
  const connectorEndpoints = endpoints.filter((e) => e.tag === 'Connectors');

  it('operationIds são únicos em TODA a API', () => {
    const ids = endpoints.map((e) => e.id);
    expect(new Set(ids).size, 'operationIds duplicados').toBe(ids.length);
  });

  it('há endpoints de conector formalizados', () => {
    expect(connectorEndpoints.length).toBeGreaterThanOrEqual(30);
  });

  it('todo endpoint de conector referencia schemas registrados', () => {
    for (const e of connectorEndpoints) {
      expect(schemaRegistry[e.responseSchema], `${e.id} response ${e.responseSchema}`).toBeDefined();
      if (e.requestSchema) expect(schemaRegistry[e.requestSchema], `${e.id} request ${e.requestSchema}`).toBeDefined();
      if (e.querySchema) expect(schemaRegistry[e.querySchema], `${e.id} query ${e.querySchema}`).toBeDefined();
    }
  });

  it('o webhook de entrada é público (permission null)', () => {
    const receive = endpoints.find((e) => e.id === 'webhooks.receive')!;
    expect(receive.public).toBe(true);
    expect(receive.permission).toBeNull();
  });

  it('comandos de estado usam idempotência e concorrência otimista', () => {
    const activate = endpoints.find((e) => e.id === 'connections.activate')!;
    expect(activate.idempotent).toBe(true);
    expect(activate.optimisticConcurrency).toBe(true);
    const create = endpoints.find((e) => e.id === 'connections.create')!;
    expect(create.idempotent).toBe(true);
  });
});
