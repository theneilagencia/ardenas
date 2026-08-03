/**
 * Arden.AS API — resolução de ferramentas do agente sobre o BE-006 (ARDEN-BE-007.5).
 *
 * Camada ESPECÍFICA de agente sobre o `ToolBindingResolver` do BE-006 — reutiliza a
 * resolução alias→binding→conexão→ferramenta (tenant-scoped, connection/connector ativos,
 * produção) e adiciona o RISCO persistido da `ConnectorToolDefinition`. O modelo só vê a
 * interseção: `allowedAliases` da versão ∩ bindings habilitados ∩ conexão ativa ∩ tool
 * ativa. Alias conhecido não concede acesso. Nunca expõe connectionId/credencial/URL.
 */

import { Injectable } from '@nestjs/common';
import type { AgentToolRiskLevel } from '@arden/contracts';
import { PrismaService } from '../../../database/prisma.service';
import { ToolBindingResolver } from '../../../connectors/tools/tool-binding-resolver';
import type { ResolvedAgentToolDefinition } from './agent-tool.types';

function nodeEnv(): string {
  return process.env.NODE_ENV ?? 'development';
}

@Injectable()
export class AgentToolBindingResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bindingResolver: ToolBindingResolver,
  ) {}

  /** Ferramentas efetivamente disponíveis ao modelo (interseção completa). */
  async resolveAllowedTools(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    correlationId: string;
    allowedAliases: string[];
  }): Promise<ResolvedAgentToolDefinition[]> {
    const out: ResolvedAgentToolDefinition[] = [];
    for (const alias of input.allowedAliases) {
      const resolved = await this.tryResolve({ ...input, alias });
      if (resolved) out.push(resolved);
    }
    return out;
  }

  /** Resolve uma tool call específica (alias). Retorna null se indisponível/não permitida. */
  async resolveToolCall(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    correlationId: string;
    alias: string;
  }): Promise<ResolvedAgentToolDefinition | null> {
    return this.tryResolve(input);
  }

  /** Resolução tenant-scoped completa de um alias; null quando qualquer regra falha. */
  private async tryResolve(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    correlationId: string;
    alias: string;
  }): Promise<ResolvedAgentToolDefinition | null> {
    const org = input.organizationId;
    // 1) binding da operação (tenant-scoped, habilitado, não removido).
    const opBinding = await this.prisma.operationToolBinding.findFirst({
      where: { organizationId: org, operationId: input.operationId, alias: input.alias, enabled: true, removedAt: null },
      select: { organizationToolBindingId: true, operationVersionId: true },
    });
    if (!opBinding) return null;

    // 2) binding da organização (habilitado) → ferramenta do catálogo.
    const orgBinding = await this.prisma.organizationToolBinding.findFirst({
      where: { id: opBinding.organizationToolBindingId, organizationId: org, enabled: true },
      select: { connectorToolDefinitionId: true },
    });
    if (!orgBinding) return null;

    const tool = await this.prisma.connectorToolDefinition.findFirst({
      where: { id: orgBinding.connectorToolDefinitionId, active: true },
      select: { actionKey: true, riskLevel: true, description: true, name: true, inputSchema: true },
    });
    if (!tool) return null;

    // 3) valida a CADEIA completa (conexão/connector ativos, produção) via BE-006.
    try {
      await this.bindingResolver.resolveForExecution({
        organizationId: org,
        operationId: input.operationId,
        operationVersionId: input.operationVersionId,
        alias: input.alias,
        actionKey: tool.actionKey,
        correlationId: input.correlationId,
        nodeEnv: nodeEnv(),
        actorUserId: null,
      });
    } catch {
      return null; // binding removido / conexão inativa / connector inativo / produção.
    }

    return {
      alias: input.alias,
      description: tool.description ?? tool.name,
      inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object' },
      riskLevel: tool.riskLevel as AgentToolRiskLevel,
      actionKey: tool.actionKey,
    };
  }
}
