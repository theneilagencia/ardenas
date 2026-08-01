/**
 * Arden.AS — API v1 · gerador do OpenAPI (ARDEN-FE-003).
 *
 * Constrói o documento OpenAPI 3.0.3 a partir do REGISTRO de schemas Zod e dos
 * descritores de endpoint (fonte única). Sem handlers, sem servidor. A saída é
 * serializada para docs/api/openapi-v1.yaml pelo script de geração.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { schemaRegistry, endpoints } from '../registry';
import { apiErrorResponse } from '../common/api-error';
import type { EndpointContract } from '../endpoint';

type JsonObject = Record<string, unknown>;

const API_BASE = '/api/v1';

/** Respostas de erro padronizadas presentes na maioria dos endpoints. */
const COMMON_ERROR_STATUSES = [401, 403, 404, 409, 422, 429, 503] as const;

function jsonSchema(schema: z.ZodTypeAny): JsonObject {
  return zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as JsonObject;
}

function components(): JsonObject {
  const schemas: JsonObject = {};
  for (const [name, schema] of Object.entries(schemaRegistry)) {
    schemas[name] = jsonSchema(schema);
  }
  return {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Bearer token OU sessão equivalente. Não amarrado a fornecedor; implementado no backend.',
      },
    },
    schemas,
  };
}

function queryParameters(endpoint: EndpointContract): JsonObject[] {
  if (!endpoint.querySchema) return [];
  const schema = schemaRegistry[endpoint.querySchema];
  if (!(schema instanceof z.ZodObject)) return [];
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([name, field]) => ({
    name,
    in: 'query',
    required: false,
    schema: jsonSchema(field),
  }));
}

function pathParameters(endpoint: EndpointContract): JsonObject[] {
  return endpoint.pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    description: name === 'organizationId'
      ? 'Identifica o recurso organizacional. A autorização é derivada da sessão e validada no backend.'
      : undefined,
    schema: { type: 'string' },
  }));
}

function headerParameters(endpoint: EndpointContract): JsonObject[] {
  const headers: JsonObject[] = [
    {
      name: 'X-Correlation-Id',
      in: 'header',
      required: false,
      description: 'Rastreio fim a fim. O servidor gera quando ausente e ecoa na resposta.',
      schema: { type: 'string' },
    },
  ];
  if (endpoint.idempotent) {
    headers.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      description: 'Obrigatório em comandos críticos. Mesma chave + mesmo body → mesma resposta.',
      schema: { type: 'string', minLength: 8 },
    });
  }
  if (endpoint.optimisticConcurrency) {
    headers.push({
      name: 'If-Match',
      in: 'header',
      required: false,
      description: 'Concorrência otimista (revisão esperada). Conflito → 409 VERSION_CONFLICT.',
      schema: { type: 'string' },
    });
  }
  return headers;
}

function responses(endpoint: EndpointContract): JsonObject {
  const out: JsonObject = {};
  if (endpoint.successStatus === 204) {
    out['204'] = { description: 'Sem conteúdo.' };
  } else {
    out[String(endpoint.successStatus)] = {
      description: 'Sucesso.',
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${endpoint.responseSchema}` },
        },
      },
    };
  }
  for (const status of COMMON_ERROR_STATUSES) {
    out[String(status)] = {
      description: 'Erro padronizado.',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } },
      },
    };
  }
  return out;
}

function operationObject(endpoint: EndpointContract): JsonObject {
  const obj: JsonObject = {
    operationId: endpoint.id,
    summary: endpoint.summary,
    tags: [endpoint.tag],
    parameters: [
      ...pathParameters(endpoint),
      ...queryParameters(endpoint),
      ...headerParameters(endpoint),
    ],
    responses: responses(endpoint),
    security: [{ bearerAuth: [] }],
    'x-permission': endpoint.permission,
    'x-idempotent': endpoint.idempotent,
    'x-optimistic-concurrency': endpoint.optimisticConcurrency,
  };
  if (endpoint.description) obj.description = endpoint.description;
  if (endpoint.requestSchema) {
    obj.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${endpoint.requestSchema}` },
        },
      },
    };
  }
  return obj;
}

function paths(): JsonObject {
  const out: JsonObject = {};
  for (const endpoint of endpoints) {
    const path = endpoint.path.startsWith(API_BASE)
      ? endpoint.path.slice(API_BASE.length)
      : endpoint.path;
    const item = (out[path] as JsonObject | undefined) ?? {};
    item[endpoint.method.toLowerCase()] = operationObject(endpoint);
    out[path] = item;
  }
  return out;
}

const TAGS = [
  { name: 'Session', description: 'Identidade e sessão. O servidor deriva usuário/org/permissões.' },
  { name: 'Operations', description: 'Operações (org-scoped).' },
  { name: 'OperationVersions', description: 'Versões de operação; publicada é imutável.' },
  { name: 'Authority', description: 'Gradiente de Autoridade da versão.' },
  { name: 'Audit', description: 'Trilha de auditoria (somente leitura).' },
  { name: 'Policies', description: 'Políticas de governança versionadas e vínculos.' },
  { name: 'Approvals', description: 'Fluxos, solicitações, decisões e delegações de aprovação.' },
  { name: 'Enforcement', description: 'Avaliação de ações e autorizações de ação.' },
  { name: 'Executions', description: 'Execuções assíncronas, etapas, eventos e evidências.' },
];

/** Constrói o documento OpenAPI 3.0.3 completo. */
export function buildOpenApiDocument(): JsonObject {
  // Garante que o schema de erro está registrado (usado por todas as respostas).
  void apiErrorResponse;
  return {
    openapi: '3.0.3',
    info: {
      title: 'Arden.AS API',
      version: '1.0.0',
      description:
        'Contratos definitivos da API v1 do Arden.AS (ARDEN-FE-003). Sem backend nesta issue — ' +
        'apenas o contrato compartilhado por frontend e futuro backend. O backend é a fonte de verdade: ' +
        'deriva usuário, organização e permissões da sessão; o cliente não envia permissões nem escolhe ' +
        'o tenant arbitrariamente.',
    },
    servers: [{ url: API_BASE, description: 'API v1' }],
    security: [{ bearerAuth: [] }],
    tags: TAGS,
    paths: paths(),
    components: components(),
  };
}
