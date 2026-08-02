/**
 * Arden.AS API — executor de ferramenta externa (ARDEN-BE-006.6).
 *
 * Orquestra: resolve binding → resolve conexão → resolve credencial (server-side, em
 * memória) → monta a requisição (sem URL absoluta arbitrária, sem header sensível do
 * input) → chama o SecureHttpClient → valida output → classifica retry/UNKNOWN. Nunca
 * retorna segredo, Authorization, URL completa ou corpo bruto sensível. O plaintext é
 * usado só para montar auth e imediatamente descartado. `internal.test` é determinístico
 * e não toca a rede. Sempre RETORNA um resultado tipado (não lança para falhas externas).
 */

import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiException, toolExecutionDenied, toolInputInvalid, toolOutputInvalid } from '../../common/errors/api-error';
import { sensitiveDataRedactor } from '../../common/redaction/sensitive-data-redactor';
import { SECURE_HTTP_CLIENT } from '../http/secure-http.types';
import type { SecureHttpClient, SecureHttpMethod, SecureHttpResponse } from '../http/secure-http.types';
import { CredentialResolver } from '../vault/credential-resolver';
import { ToolBindingResolver } from './tool-binding-resolver';
import { ConnectionResolver } from './connection-resolver';
import { applyMapping, ToolMappingError } from './tool-mapping';
import { validateAgainstSchema } from './json-schema-validator';
import { buildAuthHeaders, deriveAuthMode } from './auth-builder';
import { classifyError, classifyResponse, type HttpMethod, type IdempotencyMode, type RetryMode } from './retry-classifier';
import type { ExternalToolExecutionContext, ExternalToolExecutionResult, ResolvedToolBinding } from './tool-execution.types';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_INPUT_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'set-cookie', 'x-api-key']);

interface BaseIds {
  connectorKey: string;
  connectorVersion: string;
  toolKey: string;
  toolVersion: string;
  connectionId: string;
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex')}`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

@Injectable()
export class ExternalToolExecutor {
  constructor(
    private readonly bindingResolver: ToolBindingResolver,
    private readonly connectionResolver: ConnectionResolver,
    private readonly credentialResolver: CredentialResolver,
    @Inject(SECURE_HTTP_CLIENT) private readonly http: SecureHttpClient,
  ) {}

  async execute(ctx: ExternalToolExecutionContext): Promise<ExternalToolExecutionResult> {
    const startedAt = Date.now();
    const base = { connectorKey: '', connectorVersion: '', toolKey: '', toolVersion: '', connectionId: '' };
    let requestHash = sha256({ alias: ctx.alias, actionKey: ctx.actionKey, attempt: ctx.attemptNumber });
    try {
      const binding = await this.bindingResolver.resolveForExecution({
        organizationId: ctx.organizationId, operationId: ctx.operationId, operationVersionId: ctx.operationVersionId,
        alias: ctx.alias, actionKey: ctx.actionKey, correlationId: ctx.correlationId, nodeEnv: ctx.nodeEnv, actorUserId: ctx.actorUserId,
      });
      Object.assign(base, {
        connectorKey: binding.connectorKey, connectorVersion: binding.connectorVersion,
        toolKey: binding.toolKey, toolVersion: binding.toolVersion, connectionId: binding.connectionId,
      });

      if (ctx.actionKey.startsWith('connector.test.')) {
        return this.runInternalTest(ctx, binding, base, startedAt);
      }

      // (7) valida input (mapeado) contra o schema da ferramenta.
      const mappedInput = this.mapInput(binding, ctx);
      const inputViolations = validateAgainstSchema(mappedInput, binding.inputSchema);
      if (inputViolations.length) {
        throw toolInputInvalid(inputViolations.map((v) => ({ field: v.path || 'input', code: 'schema', message: v.message })));
      }

      // (4/8) resolve conexão ativa e credencial server-side (plaintext em memória).
      await this.connectionResolver.resolveActiveConnection({ organizationId: ctx.organizationId, connectionId: binding.connectionId, nodeEnv: ctx.nodeEnv });
      const resolvedCredential = await this.credentialResolver.resolveActiveCredential({
        organizationId: ctx.organizationId, connectionId: binding.connectionId, correlationId: ctx.correlationId, actorUserId: ctx.actorUserId,
      });
      binding.credentialFingerprint = resolvedCredential.fingerprint;

      // (9) monta a requisição SEM expor o segredo.
      const built = this.buildRequest(binding, ctx, asObject(mappedInput), resolvedCredential.secret);
      requestHash = built.requestHash;
      // Descarta a referência ao plaintext após montar a auth.
      resolvedCredential.secret = {};

      // (10) executa via SecureHttpClient.
      let response: SecureHttpResponse;
      try {
        response = await this.http.execute(
          { url: built.url, method: built.method, headers: built.headers, body: built.body, idempotencyKey: built.idempotencyKey },
          binding.policy,
          { organizationId: ctx.organizationId, correlationId: ctx.correlationId, connectionId: binding.connectionId, toolBindingId: binding.operationToolBindingId },
        );
      } catch (err) {
        return this.fromTransportError(err, binding, built, ctx, base, requestHash, startedAt);
      }

      return this.fromResponse(response, binding, built, ctx, base, requestHash, resolvedCredential.fingerprint, startedAt);
    } catch (err) {
      return this.toFailure(err, ctx, base, requestHash, startedAt);
    }
  }

  // ── Mapeamento de entrada ───────────────────────────────────────────────────────
  private mapInput(binding: ResolvedToolBinding, ctx: ExternalToolExecutionContext): unknown {
    try {
      return applyMapping(binding.inputMapping, { input: ctx.input ?? {}, steps: ctx.priorStepOutputs ?? {} }, ['input', 'steps'], 'input');
    } catch (err) {
      if (err instanceof ToolMappingError) throw toolInputInvalid([{ field: 'inputMapping', code: 'mapping', message: err.message }]);
      throw err;
    }
  }

  // ── Montagem da requisição ────────────────────────────────────────────────────────
  private buildRequest(
    binding: ResolvedToolBinding,
    ctx: ExternalToolExecutionContext,
    mappedInput: Record<string, unknown>,
    secret: Record<string, unknown>,
  ): { url: string; method: SecureHttpMethod; headers: Record<string, string>; body?: string; idempotencyKey?: string; requestHash: string; host: string; path: string } {
    const config = binding.configuration;
    const now = new Date();
    const isWebhook = binding.actionKey === 'external.webhook.send';

    // Endpoint FIXO da configuração (nunca URL absoluta arbitrária do input).
    const baseUrlRaw = isWebhook ? config.endpointUrl : config.baseUrl;
    if (typeof baseUrlRaw !== 'string' || baseUrlRaw.length === 0) {
      throw toolExecutionDenied('Configuração da ferramenta sem endpoint fixo.');
    }

    let method: SecureHttpMethod;
    let bodyValue: unknown;
    let relativePath = '';
    let query: Record<string, unknown> = {};
    let inputHeaders: Record<string, unknown> = {};
    let inputIdempotencyKey: string | undefined;

    if (isWebhook) {
      method = 'POST';
      const timestamp = Math.floor(now.getTime() / 1000);
      bodyValue = { event: mappedInput.event, payload: mappedInput.payload ?? {}, timestamp, correlationId: ctx.correlationId };
      inputIdempotencyKey = typeof mappedInput.idempotencyKey === 'string' ? mappedInput.idempotencyKey : undefined;
    } else {
      const rawMethod = typeof mappedInput.method === 'string' ? mappedInput.method.toUpperCase() : '';
      if (!HTTP_METHODS.has(rawMethod)) throw toolInputInvalid([{ field: 'method', code: 'enum', message: 'Método HTTP inválido.' }]);
      method = rawMethod as SecureHttpMethod;
      relativePath = typeof mappedInput.path === 'string' ? mappedInput.path : '';
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(relativePath) || relativePath.startsWith('//')) {
        throw toolExecutionDenied('URL absoluta no input não é permitida; use path relativo.');
      }
      query = asObject(mappedInput.query);
      inputHeaders = asObject(mappedInput.headers);
      bodyValue = mappedInput.body;
      inputIdempotencyKey = typeof mappedInput.idempotencyKey === 'string' ? mappedInput.idempotencyKey : undefined;
    }

    // URL: baseUrl + path relativo + query (nunca sobrescreve o host/base).
    const baseTrimmed = baseUrlRaw.replace(/\/+$/, '');
    const pathPart = relativePath ? (relativePath.startsWith('/') ? relativePath : `/${relativePath}`) : '';
    const url = new URL(`${baseTrimmed}${pathPart}`);
    for (const [k, v] of Object.entries(query)) {
      if (typeof v === 'string') url.searchParams.append(k, v);
    }

    // Headers: fixos (config) + input (validado, sem sensíveis) + auth (vence).
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputHeaders)) {
      if (SENSITIVE_INPUT_HEADERS.has(k.toLowerCase())) {
        throw toolExecutionDenied(`Header sensível não permitido no input: ${k}.`);
      }
      if (typeof v === 'string') headers[k] = v;
    }

    const bodyString = bodyValue === undefined ? undefined : JSON.stringify(bodyValue);
    const fixedHeaders = asObject(config.defaultHeaders) as Record<string, string>;
    const signPayload = isWebhook && config.signPayload === true;
    const authMode = deriveAuthMode(binding.connectorKey, secret, signPayload);
    const authHeaders = buildAuthHeaders({
      mode: authMode, secret, fixedHeaders,
      headerName: typeof secret.headerName === 'string' ? secret.headerName : undefined,
      bodyString, now, correlationId: ctx.correlationId,
    });
    Object.assign(headers, authHeaders);

    // Idempotência: envia Idempotency-Key conforme o modo da ferramenta.
    let idempotencyKey: string | undefined;
    if (binding.idempotencyMode !== 'NONE') {
      idempotencyKey = inputIdempotencyKey ?? ctx.idempotencyKey;
      if (binding.idempotencyMode === 'REQUIRED' && !idempotencyKey) {
        throw toolExecutionDenied('Idempotency-Key é obrigatória para esta ferramenta.');
      }
    }

    const requestHash = sha256({ method, host: url.host, path: url.pathname, query: url.search, bodyHash: bodyString ? sha256(bodyString) : null, idempotencyKey: idempotencyKey ?? null });
    return { url: url.toString(), method, headers, body: bodyString, idempotencyKey, requestHash, host: url.host, path: url.pathname };
  }

  // ── Resposta bem-sucedida/erro HTTP ───────────────────────────────────────────────
  private fromResponse(
    response: SecureHttpResponse,
    binding: ResolvedToolBinding,
    built: { method: SecureHttpMethod; host: string; path: string },
    ctx: ExternalToolExecutionContext,
    base: BaseIds,
    requestHash: string,
    fingerprint: string,
    startedAt: number,
  ): ExternalToolExecutionResult {
    const retryAfterMs = parseRetryAfter(response.headers['retry-after']);
    const classification = classifyResponse(response.status, built.method as HttpMethod, binding.idempotencyMode as IdempotencyMode, binding.retryMode as RetryMode, retryAfterMs);

    let output: unknown;
    let responseHash: string | undefined;
    if (classification.status === 'SUCCEEDED') {
      const parsedBody = safeJsonParse(response.body);
      // Formato do output conforme a ferramenta: webhook = {status,delivered}; http = {status,headers,body}.
      const rawOutput = binding.actionKey === 'external.webhook.send'
        ? { status: response.status, delivered: response.status >= 200 && response.status < 300 }
        : { status: response.status, headers: sanitizeHeaders(response.headers), body: parsedBody };
      responseHash = sha256(rawOutput);
      // (11) valida o output contra o schema da ferramenta ANTES de sucesso.
      const outputViolations = validateAgainstSchema(rawOutput, binding.outputSchema);
      if (outputViolations.length) {
        return this.result('FAILED', binding, base, requestHash, startedAt, {
          errorCode: 'TOOL_OUTPUT_INVALID', errorSummary: 'Saída não corresponde ao schema.', retryable: false,
          responseHash, fingerprint, method: built.method, host: built.host, path: built.path, status: response.status, bytes: response.body.length,
          resultClassification: 'FAILED', attempt: ctx.attemptNumber,
        });
      }
      output = this.mapOutput(binding, rawOutput);
    }

    return this.result(classification.status, binding, base, requestHash, startedAt, {
      output, errorCode: classification.errorCode, errorSummary: classification.errorSummary,
      retryable: classification.retryable, retryAfterMs: classification.retryAfterMs, responseHash, fingerprint,
      method: built.method, host: built.host, path: built.path, status: response.status, bytes: response.body.length,
      resultClassification: classification.status, attempt: ctx.attemptNumber,
    });
  }

  private mapOutput(binding: ResolvedToolBinding, rawOutput: Record<string, unknown>): unknown {
    try {
      return applyMapping(binding.outputMapping, { output: rawOutput }, ['output'], 'output');
    } catch (err) {
      if (err instanceof ToolMappingError) throw toolOutputInvalid([{ field: 'outputMapping', code: 'mapping', message: err.message }]);
      throw err;
    }
  }

  // ── Erro de transporte (timeout/drop/policy) ──────────────────────────────────────
  private fromTransportError(
    err: unknown,
    binding: ResolvedToolBinding,
    built: { method: SecureHttpMethod; host: string; path: string },
    ctx: ExternalToolExecutionContext,
    base: BaseIds,
    requestHash: string,
    startedAt: number,
  ): ExternalToolExecutionResult {
    const code = err instanceof ApiException ? err.code : 'EXTERNAL_PROVIDER_ERROR';
    const summary = sensitiveDataRedactor.redactError(err).message;
    const classification = classifyError(code, summary, built.method as HttpMethod, binding.idempotencyMode as IdempotencyMode, binding.retryMode as RetryMode);
    return this.result(classification.status, binding, base, requestHash, startedAt, {
      errorCode: classification.errorCode, errorSummary: classification.errorSummary, retryable: classification.retryable,
      method: built.method, host: built.host, path: built.path, resultClassification: classification.status, attempt: ctx.attemptNumber,
    });
  }

  // ── internal.test (determinístico, sem rede) ──────────────────────────────────────
  private runInternalTest(
    ctx: ExternalToolExecutionContext,
    binding: ResolvedToolBinding,
    base: BaseIds,
    startedAt: number,
  ): ExternalToolExecutionResult {
    const requestHash = sha256({ alias: ctx.alias, actionKey: ctx.actionKey });
    if (ctx.actionKey === 'connector.test.echo') {
      const output = { echoed: asObject(ctx.input) };
      return this.result('SUCCEEDED', binding, base, requestHash, startedAt, { output, responseHash: sha256(output), resultClassification: 'SUCCEEDED', attempt: ctx.attemptNumber });
    }
    if (ctx.actionKey === 'connector.test.timeout') {
      return this.result('FAILED', binding, base, requestHash, startedAt, { errorCode: 'EXTERNAL_TIMEOUT', errorSummary: 'Timeout determinístico de teste.', retryable: false, resultClassification: 'FAILED', attempt: ctx.attemptNumber });
    }
    // connector.test.failure
    return this.result('FAILED', binding, base, requestHash, startedAt, { errorCode: 'EXTERNAL_PROVIDER_ERROR', errorSummary: 'Falha determinística de teste.', retryable: false, resultClassification: 'FAILED', attempt: ctx.attemptNumber });
  }

  // ── Falha antes/na resolução (binding/conexão/credencial/input) ────────────────────
  private toFailure(
    err: unknown,
    ctx: ExternalToolExecutionContext,
    base: BaseIds,
    requestHash: string,
    startedAt: number,
  ): ExternalToolExecutionResult {
    const code = err instanceof ApiException ? err.code : 'EXTERNAL_PROVIDER_ERROR';
    const summary = sensitiveDataRedactor.redactError(err).message;
    // Resolução/validação: falha DEFINITIVA (não incerta), sem retry automático.
    const classification = classifyError(code, summary, 'GET', 'REQUIRED', 'NEVER');
    return {
      status: classification.status, errorCode: classification.errorCode ?? code, errorSummary: summary,
      retryable: false, requestHash,
      connectorKey: base.connectorKey, connectorVersion: base.connectorVersion, toolKey: base.toolKey, toolVersion: base.toolVersion,
      connectionId: base.connectionId, durationMs: Date.now() - startedAt,
      evidence: { actionKey: ctx.actionKey, alias: ctx.alias, resultClassification: classification.status, errorCode: classification.errorCode ?? code, attempt: ctx.attemptNumber },
    };
  }

  // ── Montagem do resultado + evidência sanitizada ──────────────────────────────────
  private result(
    status: ExternalToolExecutionResult['status'],
    binding: ResolvedToolBinding,
    base: BaseIds,
    requestHash: string,
    startedAt: number,
    extra: {
      output?: unknown; errorCode?: string; errorSummary?: string; retryable?: boolean; retryAfterMs?: number;
      responseHash?: string; fingerprint?: string; method?: string; host?: string; path?: string; status?: number; bytes?: number;
      resultClassification: string; attempt: number;
    },
  ): ExternalToolExecutionResult {
    const evidence: Record<string, unknown> = {
      connectorKey: base.connectorKey, connectorVersion: base.connectorVersion,
      toolKey: base.toolKey, toolVersion: base.toolVersion, connectionId: base.connectionId,
      operationToolBindingId: binding.operationToolBindingId, organizationToolBindingId: binding.organizationToolBindingId,
      actionKey: binding.actionKey, fingerprint: extra.fingerprint ?? binding.credentialFingerprint,
      method: extra.method, host: extra.host, path: extra.path,
      requestHash, responseHash: extra.responseHash, httpStatus: extra.status,
      status, resultClassification: extra.resultClassification, retryable: extra.retryable ?? false,
      errorCode: extra.errorCode, bytes: extra.bytes, attempt: extra.attempt, durationMs: Date.now() - startedAt,
    };
    return {
      status, output: extra.output, errorCode: extra.errorCode, errorSummary: extra.errorSummary,
      retryable: extra.retryable ?? false, retryAfterMs: extra.retryAfterMs, requestHash, responseHash: extra.responseHash,
      connectorKey: base.connectorKey, connectorVersion: base.connectorVersion, toolKey: base.toolKey, toolVersion: base.toolVersion,
      connectionId: base.connectionId, credentialFingerprint: extra.fingerprint ?? binding.credentialFingerprint,
      evidence, durationMs: Date.now() - startedAt,
    };
  }
}

function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  return undefined;
}

function safeJsonParse(body: string): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return sensitiveDataRedactor.redactHeaders(headers);
}
