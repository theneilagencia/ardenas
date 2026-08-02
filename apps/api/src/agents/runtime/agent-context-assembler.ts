/**
 * Arden.AS API — montagem de contexto MÍNIMA v1 (ARDEN-BE-007.3 §12/§31).
 *
 * Escopo v1: apenas `execution input` + `objective` + `system instructions`. SEM tools,
 * SEM documentos, SEM outputs de outras etapas, SEM RAG/memória/vault/env — adiado para
 * 007.4. Redige campos sensíveis conhecidos. Emite sinais de segurança determinísticos
 * mínimos (§31); guardrails completos ficam para 007.4.
 */

import { Injectable } from '@nestjs/common';
import type { ModelMessage, AgentSecuritySignal, AgentContextPolicy } from '@arden/contracts';
import { sensitiveDataRedactor } from '../../common/redaction/sensitive-data-redactor';
import { estimateTokens } from './token-estimator';

export interface AgentContextAssemblyInputV1 {
  organizationId: string;
  contextPolicy: AgentContextPolicy;
  objective: string;
  systemInstructions: string;
  executionInput: unknown;
  correlationId: string;
}

export interface AgentContextAssemblyResultV1 {
  systemInstructions: string;
  messages: ModelMessage[];
  tools: [];
  securitySignals: AgentSecuritySignal[];
  contextBytes: number;
  estimatedInputTokens: number;
}

/** Detecta sinais explícitos e determinísticos (sem heurística ampla frágil). */
function detectSignals(executionInput: unknown): AgentSecuritySignal[] {
  const signals: AgentSecuritySignal[] = [];
  const asText = JSON.stringify(executionInput ?? null).toLowerCase();

  if (asText.includes('__ardeninjectionprobe')) {
    // Marcador explícito de teste de exfiltração → BLOQUEADO (determinístico).
    signals.push({ code: 'SECRET_EXFILTRATION_ATTEMPT', severity: 'CRITICAL', source: 'EXECUTION_INPUT', blocked: true });
  }
  if (asText.includes('ignore previous instructions') || asText.includes('ignore all previous')) {
    signals.push({ code: 'PROMPT_OVERRIDE_ATTEMPT', severity: 'MEDIUM', source: 'EXECUTION_INPUT', blocked: false });
  }
  if (asText.includes('reveal your system prompt') || asText.includes('print your system instructions')) {
    signals.push({ code: 'SYSTEM_INSTRUCTION_DISCLOSURE_ATTEMPT', severity: 'MEDIUM', source: 'EXECUTION_INPUT', blocked: false });
  }
  return signals;
}

@Injectable()
export class AgentContextAssemblerV1 {
  assemble(input: AgentContextAssemblyInputV1): AgentContextAssemblyResultV1 {
    const redactedInput = sensitiveDataRedactor.redactObject(input.executionInput ?? null);
    const messages: ModelMessage[] = [
      {
        role: 'USER',
        content: [
          { type: 'TEXT', text: `Objetivo: ${input.objective}` },
          { type: 'JSON', data: redactedInput },
        ],
      },
    ];
    const securitySignals = detectSignals(input.executionInput);
    const contextBytes = Buffer.byteLength(JSON.stringify({ systemInstructions: input.systemInstructions, messages }), 'utf8');
    const estimatedInputTokens = estimateTokens(input.systemInstructions) + estimateTokens(messages);
    return {
      systemInstructions: input.systemInstructions,
      messages,
      tools: [],
      securitySignals,
      contextBytes,
      estimatedInputTokens,
    };
  }
}
