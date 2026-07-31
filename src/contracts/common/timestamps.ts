/**
 * Arden.AS — API v1 · timestamps (ARDEN-FE-003).
 *
 * Todas as datas do contrato usam ISO 8601 em UTC (sufixo `Z`). O schema rejeita
 * offsets locais para evitar ambiguidade de fuso. Contrato compartilhado por
 * frontend e (futuro) backend — não depende de React/Zustand.
 */

import { z } from 'zod';

/** Data-hora ISO 8601 em UTC, ex.: `2026-07-31T12:00:00.000Z`. */
export const isoUtcDateTime = z
  .string()
  .datetime({ offset: false })
  .describe('ISO 8601 date-time in UTC (Z suffix)');

export type IsoUtcDateTime = z.infer<typeof isoUtcDateTime>;

/** Data ISO 8601 (apenas data), ex.: `2026-07-31`. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('ISO 8601 date (YYYY-MM-DD)');

export type IsoDate = z.infer<typeof isoDate>;

/**
 * Valor monetário do contrato: SEMPRE com moeda. `amountMinor` em menor unidade
 * (centavos) para evitar erros de ponto flutuante. Reservado para escopos futuros
 * (orçamento/limites financeiros) — presente já no contrato de AuthorityProfile.
 */
export const money = z
  .object({
    amountMinor: z.number().int(),
    currency: z.string().length(3).describe('ISO 4217 currency code'),
  })
  .describe('Monetary value with explicit currency (ISO 4217)');

export type Money = z.infer<typeof money>;
