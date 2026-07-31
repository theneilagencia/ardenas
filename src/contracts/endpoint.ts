/**
 * Arden.AS — API v1 · descritor de endpoint (ARDEN-FE-003).
 *
 * Descreve cada endpoint de forma declarativa: método, path, permissão exigida
 * (do catálogo estável do ARDEN-FE-002), idempotência e concorrência otimista, e
 * as referências de schema (por nome) usadas para request/response. Este descritor
 * alimenta a geração do OpenAPI, a matriz de autorização e os testes de contrato.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface EndpointContract {
  /** Identificador estável, ex.: `operations.publish`. */
  id: string;
  method: HttpMethod;
  /** Path versionado, ex.: `/api/v1/organizations/{organizationId}/operations`. */
  path: string;
  summary: string;
  tag: string;
  /**
   * Permissão exigida (catálogo estável do ARDEN-FE-002) ou `null` para endpoints
   * de sessão (autenticação, não autorização por permissão). O CLIENTE não envia
   * permissões; o servidor valida.
   */
  permission: string | null;
  /** Exige header `Idempotency-Key` (comando crítico). */
  idempotent: boolean;
  /** Usa concorrência otimista (`If-Match`/`expectedRevision`). */
  optimisticConcurrency: boolean;
  /** Nome do schema (no registro) do corpo da requisição, se houver. */
  requestSchema?: string;
  /** Nome do schema (no registro) dos parâmetros de query, se houver. */
  querySchema?: string;
  /** Parâmetros de path (ex.: organizationId, operationId). */
  pathParams: string[];
  /** Status HTTP de sucesso. */
  successStatus: number;
  /** Nome do schema (no registro) do corpo da resposta de sucesso. */
  responseSchema: string;
  /** Descrição adicional (ex.: efeitos transacionais, imutabilidade). */
  description?: string;
}
