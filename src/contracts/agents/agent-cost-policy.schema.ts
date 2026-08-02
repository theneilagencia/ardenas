/**
 * Arden.AS — API v1 · política de custo do agente (ARDEN-BE-007.1).
 *
 * Permite enforcement FUTURO de tetos de custo/consumo. NÃO implementa billing nesta
 * fase — apenas o contrato e o comportamento ao atingir o limite. Pertence à
 * `AgentVersion`. `workUnitCost` da operação (custo de negócio) é ortogonal a isto.
 */

import { z } from 'zod';
import { agentLimitBehavior } from './agent-keys';

/** Moeda ISO 4217 (3 letras maiúsculas), quando presente. */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, { message: 'currency deve ser ISO 4217 (3 letras).' });
export type CurrencyCode = z.infer<typeof currencyCode>;

export const agentCostPolicy = z
  .object({
    /** Teto de custo estimado em unidade menor (ex.: centavos). Nulo = sem teto de custo. */
    maximumEstimatedCostMinor: z.number().int().min(0).nullable().optional(),
    currency: currencyCode.nullable().optional(),
    maximumInputTokens: z.number().int().positive().max(1_000_000),
    maximumOutputTokens: z.number().int().positive().max(200_000),
    maximumToolCalls: z.number().int().min(0).max(100),
    actionOnLimit: agentLimitBehavior,
  })
  .superRefine((policy, ctx) => {
    if (
      policy.maximumEstimatedCostMinor != null &&
      policy.maximumEstimatedCostMinor > 0 &&
      !policy.currency
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currency'],
        message: 'maximumEstimatedCostMinor exige currency (ISO 4217).',
      });
    }
  });
export type AgentCostPolicy = z.infer<typeof agentCostPolicy>;

/** Default seguro: falha ao exceder; sem teto de custo monetário nesta fase. */
export const AGENT_COST_POLICY_SAFE_DEFAULT: z.input<typeof agentCostPolicy> = {
  maximumEstimatedCostMinor: null,
  currency: null,
  maximumInputTokens: 8_000,
  maximumOutputTokens: 2_000,
  maximumToolCalls: 0,
  actionOnLimit: 'FAIL',
};
