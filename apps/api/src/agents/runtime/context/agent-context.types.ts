/**
 * Arden.AS API — tipos internos do pipeline de contexto v2 (ARDEN-BE-007.4).
 *
 * NÃO expostos por HTTP. Nenhum tipo carrega segredo, credencial, SDK ou prompt livre
 * do request. Toda fonte de contexto passa por: resolução tenant-scoped → normalização →
 * redação → classificação de confiança → guardrails → alocação de orçamento → montagem.
 * As evidências geradas carregam apenas HASHES e metadados — nunca o conteúdo bruto.
 */

import type {
  ModelMessage,
  AgentSecuritySignal,
  AgentSecuritySignalSource,
  AgentContextPolicy,
} from '@arden/contracts';

/** Categorias de fonte permitidas pela allowlist da `AgentContextPolicy`. */
export type ContextSourceKind =
  | 'EXECUTION_INPUT'
  | 'OPERATION_METADATA'
  | 'PREVIOUS_STEP_OUTPUT'
  | 'TOOL_RESULT'
  | 'LINKED_DOCUMENT';

/** Nível de confiança do conteúdo — determina isolamento e política de bloqueio. */
export type ContextTrustLevel = 'SYSTEM_TRUSTED' | 'TENANT_TRUSTED' | 'UNTRUSTED_EXTERNAL';

/** Decisão determinística do guard de injeção por fonte. */
export type ContextGuardDecision = 'ALLOW' | 'ALLOW_WITH_ISOLATION' | 'BLOCK';

/** Motivo pelo qual uma fonte candidata não entrou no contexto. */
export type ContextExclusionReason =
  | 'SOURCE_NOT_SUPPORTED' // documentos vinculados: sem infraestrutura nesta fase
  | 'SOURCE_DISABLED' // política desliga a categoria
  | 'SOURCE_NOT_FOUND' // referência allowlistada sem correspondência no run/tenant
  | 'SOURCE_INVALID' // conteúdo não serializável/normalizável
  | 'SOURCE_EMPTY' // sem conteúdo útil (null/objeto vazio)
  | 'DUPLICATE_SOURCE' // conteúdo idêntico (mesmo redactedHash) a outra fonte já incluída
  | 'BUDGET_EXCLUDED'; // sem orçamento restante para a fonte

/** Desfecho global da montagem de contexto. */
export type ContextAssemblyOutcome = 'ASSEMBLED' | 'BLOCKED' | 'BUDGET_EXCEEDED' | 'SOURCE_INVALID';

/** Fonte crua resolvida pelo `AgentContextSourceResolver` (antes de normalizar). */
export interface RawContextSource {
  kind: ContextSourceKind;
  /** Identificador estável da fonte (stepKey, alias, docRef, 'input', 'metadata'). */
  ref: string;
  /** Rótulo humano SEGURO (sem segredo) para evidência. */
  label: string;
  /** Valor bruto (JSON do banco / snapshot da etapa). */
  value: unknown;
  /** actionKey do produtor (apenas p/ PREVIOUS_STEP_OUTPUT) — usado na classificação. */
  producerActionKey?: string;
}

/** Fonte excluída, com motivo, para evidência/auditoria. */
export interface ExcludedContextSource {
  kind: ContextSourceKind;
  ref: string;
  reason: ContextExclusionReason;
}

/** Resultado do resolver: fontes candidatas + exclusões já conhecidas. */
export interface ResolvedContextSources {
  resolved: RawContextSource[];
  excluded: ExcludedContextSource[];
}

/** Fonte normalizada (plana, serializável) com hashes de conteúdo. */
export interface NormalizedContextSource {
  kind: ContextSourceKind;
  ref: string;
  label: string;
  producerActionKey?: string;
  /** Valor JÁ redigido (campos sensíveis removidos) e serializável. */
  redactedValue: unknown;
  /** SHA-256 do valor normalizado ANTES da redação (nunca persistido em claro). */
  originalHash: string;
  /** SHA-256 do valor DEPOIS da redação. */
  redactedHash: string;
  /** Bytes UTF-8 do valor redigido serializado. */
  bytes: number;
}

/** Fonte classificada por confiança. */
export interface ClassifiedContextSource extends NormalizedContextSource {
  trust: ContextTrustLevel;
}

/** Fonte inspecionada pelo guard: decisão + sinais. */
export interface GuardedContextSource extends ClassifiedContextSource {
  decision: ContextGuardDecision;
  signals: AgentSecuritySignal[];
}

/** Fonte após alocação de orçamento (possivelmente truncada). */
export interface BudgetedContextSource extends GuardedContextSource {
  /** Valor final incluído no prompt (pode ser truncado). */
  includedValue: unknown;
  includedBytes: number;
  truncated: boolean;
  isolated: boolean;
}

/** Metadados SANITIZADOS de uma fonte incluída (para evidência). */
export interface AgentContextIncludedSource {
  kind: ContextSourceKind;
  ref: string;
  label: string;
  trust: ContextTrustLevel;
  isolated: boolean;
  truncated: boolean;
  bytes: number;
  originalHash: string;
  redactedHash: string;
}

/** Resultado completo da montagem de contexto v2 (consumido pelo runtime). */
export interface AgentContextAssemblyResult {
  outcome: ContextAssemblyOutcome;
  systemInstructions: string;
  messages: ModelMessage[];
  tools: [];
  securitySignals: AgentSecuritySignal[];
  includedSources: AgentContextIncludedSource[];
  excludedSources: ExcludedContextSource[];
  totalBytes: number;
  estimatedInputTokens: number;
  truncated: boolean;
  contextHash: string;
}

/** Token DI do resolver de fontes (permite substituir por fake nos testes unitários). */
export const AGENT_CONTEXT_SOURCE_RESOLVER = Symbol('AGENT_CONTEXT_SOURCE_RESOLVER');

/** Mapeia a categoria interna para o enum de origem do sinal de segurança do contrato. */
export function toSignalSource(kind: ContextSourceKind): AgentSecuritySignalSource {
  switch (kind) {
    case 'TOOL_RESULT':
      return 'TOOL_RESULT';
    case 'LINKED_DOCUMENT':
      return 'DOCUMENT';
    case 'PREVIOUS_STEP_OUTPUT':
      return 'MODEL_OUTPUT';
    case 'OPERATION_METADATA':
    case 'EXECUTION_INPUT':
    default:
      return 'EXECUTION_INPUT';
  }
}

export type { AgentContextPolicy };
