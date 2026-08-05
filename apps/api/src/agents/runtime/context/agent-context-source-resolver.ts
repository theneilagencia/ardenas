/**
 * Arden.AS API — resolução tenant-scoped de fontes de contexto (ARDEN-BE-007.4).
 *
 * ÚNICO ponto que acessa o banco no pipeline de contexto. Resolve APENAS as fontes
 * permitidas pela `AgentContextPolicy` (allowlist fechada), SEMPRE `{organizationId,
 * executionRunId}` na cláusula — ids conhecidos não concedem acesso. Saídas de etapas e
 * resultados de tools só vêm de etapas SUCCEEDED do MESMO run/tenant e com `sequence`
 * anterior à etapa do agente. Documentos vinculados não têm infraestrutura nesta fase e
 * são excluídos com `SOURCE_NOT_SUPPORTED`. Não normaliza, não redige, não classifica.
 */

import { Injectable } from '@nestjs/common';
import type { AgentContextPolicy } from '@arden/contracts';
import { PrismaService } from '../../../database/prisma.service';
import { agentContextSourceNotAllowed } from '../../../common/errors/api-error';
import type {
  ExcludedContextSource,
  RawContextSource,
  ResolvedContextSources,
} from './agent-context.types';

export interface SourceResolverInput {
  organizationId: string;
  executionRunId: string;
  executionStepId: string;
  operationId: string;
  operationVersionId: string;
  contextPolicy: AgentContextPolicy;
  /** Input da etapa (`$source`) — canal EXECUTION_INPUT. */
  executionInput: unknown;
}

export interface AgentContextSourceResolver {
  resolve(input: SourceResolverInput): Promise<ResolvedContextSources>;
}

function toolAliasOf(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const tool = (input as Record<string, unknown>).$tool;
  if (!tool || typeof tool !== 'object') return null;
  const alias = (tool as Record<string, unknown>).alias;
  return typeof alias === 'string' ? alias : null;
}

@Injectable()
export class AgentContextSourceResolverService implements AgentContextSourceResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: SourceResolverInput): Promise<ResolvedContextSources> {
    const { organizationId: org, executionRunId, executionStepId, contextPolicy: policy } = input;
    const resolved: RawContextSource[] = [];
    const excluded: ExcludedContextSource[] = [];

    // Coordenada de tempo: sequência da etapa do agente (só fontes ANTERIORES entram).
    const currentStep = await this.prisma.executionStep.findFirst({
      where: { id: executionStepId, organizationId: org, executionRunId },
      select: { sequence: true },
    });
    if (!currentStep) throw agentContextSourceNotAllowed('Etapa de agente não encontrada para o tenant.');
    const currentSeq = currentStep.sequence;

    // 1) EXECUTION_INPUT — dado, nunca instrução.
    if (policy.includeExecutionInput) {
      resolved.push({ kind: 'EXECUTION_INPUT', ref: 'input', label: 'execution.input', value: input.executionInput ?? null });
    } else {
      excluded.push({ kind: 'EXECUTION_INPUT', ref: 'input', reason: 'SOURCE_DISABLED' });
    }

    // 2) OPERATION_METADATA — campos seguros da operação/versão/etapa (sem segredo).
    if (policy.includeOperationMetadata) {
      const meta = await this.resolveOperationMetadata(org, input.operationId, input.operationVersionId, executionStepId);
      if (meta) resolved.push({ kind: 'OPERATION_METADATA', ref: 'metadata', label: 'operation.metadata', value: meta });
      else excluded.push({ kind: 'OPERATION_METADATA', ref: 'metadata', reason: 'SOURCE_NOT_FOUND' });
    } else {
      excluded.push({ kind: 'OPERATION_METADATA', ref: 'metadata', reason: 'SOURCE_DISABLED' });
    }

    // Etapas anteriores SUCCEEDED do MESMO run/tenant (uma única leitura).
    const priorSteps = await this.prisma.executionStep.findMany({
      where: { organizationId: org, executionRunId, status: 'SUCCEEDED', sequence: { lt: currentSeq } },
      select: { definitionStepKey: true, actionKey: true, output: true, input: true, sequence: true },
      orderBy: { sequence: 'asc' },
    });

    // 3) PREVIOUS_STEP_OUTPUT — apenas stepKeys allowlistados.
    if (policy.previousStepOutputs.enabled) {
      for (const key of policy.previousStepOutputs.allowedStepKeys) {
        const step = [...priorSteps].reverse().find((s) => s.definitionStepKey === key);
        if (step && step.output != null) {
          resolved.push({
            kind: 'PREVIOUS_STEP_OUTPUT',
            ref: key,
            label: `step:${key}`,
            value: step.output,
            producerActionKey: step.actionKey,
          });
        } else {
          excluded.push({ kind: 'PREVIOUS_STEP_OUTPUT', ref: key, reason: 'SOURCE_NOT_FOUND' });
        }
      }
    }

    // 4) TOOL_RESULT — apenas aliases allowlistados (resultado de etapa externa).
    if (policy.toolResults.enabled) {
      for (const alias of policy.toolResults.allowedToolAliases) {
        const step = [...priorSteps].reverse().find((s) => toolAliasOf(s.input) === alias);
        if (step && step.output != null) {
          resolved.push({
            kind: 'TOOL_RESULT',
            ref: alias,
            label: `tool:${alias}`,
            value: step.output,
            producerActionKey: step.actionKey,
          });
        } else {
          excluded.push({ kind: 'TOOL_RESULT', ref: alias, reason: 'SOURCE_NOT_FOUND' });
        }
      }
    }

    // 5) LINKED_DOCUMENT — sem infraestrutura de documentos nesta fase.
    if (policy.linkedDocuments.enabled) {
      for (const docRef of policy.linkedDocuments.documentReferenceIds) {
        excluded.push({ kind: 'LINKED_DOCUMENT', ref: docRef, reason: 'SOURCE_NOT_SUPPORTED' });
      }
    }

    return { resolved, excluded };
  }

  /** Metadados SEGUROS: nome da operação, número da versão e nome da etapa. Sem segredo. */
  private async resolveOperationMetadata(
    org: string,
    operationId: string,
    operationVersionId: string,
    executionStepId: string,
  ): Promise<Record<string, unknown> | null> {
    const [operation, version, step] = await Promise.all([
      this.prisma.operation.findFirst({ where: { id: operationId, organizationId: org }, select: { name: true } }),
      this.prisma.operationVersion.findFirst({ where: { id: operationVersionId, organizationId: org }, select: { versionNumber: true } }),
      this.prisma.executionStep.findFirst({ where: { id: executionStepId, organizationId: org }, select: { name: true, definitionStepKey: true } }),
    ]);
    if (!operation && !version && !step) return null;
    return {
      operationName: operation?.name ?? null,
      operationVersionNumber: version?.versionNumber ?? null,
      stepName: step?.name ?? null,
      stepKey: step?.definitionStepKey ?? null,
    };
  }
}
