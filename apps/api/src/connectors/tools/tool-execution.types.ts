/**
 * Arden.AS API — tipos da execução de ferramenta externa (ARDEN-BE-006.6).
 *
 * SOMENTE dados seguros: nenhum segredo, nenhuma URL absoluta arbitrária, nenhuma
 * classe vinda do banco. `ResolvedToolBinding`/`ResolvedConnection` são snapshots
 * sanitizados; a credencial é resolvida em memória imediatamente antes da chamada e
 * descartada em seguida.
 */

import type { SecureHttpPolicy } from '../http/secure-http.types';

export type ExternalActionKeyRuntime =
  | 'external.http.request'
  | 'external.webhook.send'
  | 'connector.test.echo'
  | 'connector.test.failure'
  | 'connector.test.timeout';

export interface ResolvedToolBinding {
  operationToolBindingId: string;
  organizationToolBindingId: string;
  connectionId: string;

  connectorKey: string;
  connectorVersion: string;

  toolKey: string;
  toolVersion: string;
  actionKey: string;

  /** Configuração efetiva (config do conector + overrides do binding). NÃO sensível. */
  configuration: Record<string, unknown>;
  /** Política efetiva de runtime (networkPolicy da conexão + overrides). NÃO sensível. */
  policy: SecureHttpPolicy;
  inputMapping: unknown;
  outputMapping: unknown;

  /** Metadados de comportamento (do catálogo). */
  idempotencyMode: 'NONE' | 'OPTIONAL' | 'REQUIRED' | 'PROVIDER_NATIVE';
  retryMode: 'NEVER' | 'SAFE' | 'CONDITIONAL';
  defaultTimeoutMs: number;
  maximumTimeoutMs: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  /** Schema de credencial do conector (para montar auth). NÃO contém segredo. */
  credentialSchema: Record<string, unknown>;

  credentialFingerprint?: string;
}

export interface ResolvedConnection {
  connectionId: string;
  connectorDefinitionId: string;
  connectorKey: string;
  connectorVersion: string;
  status: string;
  configuration: Record<string, unknown>;
  networkPolicy: SecureHttpPolicy;
  currentCredentialVersionId: string;
  productionAllowed: boolean;
  credentialSchema: Record<string, unknown>;
  revision: number;
}

export interface ExternalToolExecutionContext {
  organizationId: string;
  operationId: string;
  operationVersionId: string;

  executionRunId: string;
  executionStepId: string;

  alias: string;
  actionKey: string;
  /** Fonte para o mapeamento de entrada: `{ input, steps }`. */
  input: unknown;
  priorStepOutputs: Record<string, unknown>;

  correlationId: string;
  idempotencyKey: string;
  attemptNumber: number;
  timeoutMs: number;
  nodeEnv: string;
  actorUserId?: string | null;
}

export type ExternalToolStatus = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export interface ExternalToolExecutionResult {
  status: ExternalToolStatus;
  output?: unknown;

  errorCode?: string;
  errorSummary?: string;

  retryable: boolean;
  retryAfterMs?: number;

  requestHash: string;
  responseHash?: string;

  connectorKey: string;
  connectorVersion: string;
  toolKey: string;
  toolVersion: string;

  connectionId: string;
  credentialFingerprint?: string;

  /** Evidência sanitizada pronta para persistência (sem segredo/URL completa/headers sensíveis). */
  evidence: Record<string, unknown>;

  durationMs: number;
}
