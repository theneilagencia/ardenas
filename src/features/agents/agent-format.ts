/**
 * Arden.AS — helpers PUROS de apresentação do domínio de agentes (ARDEN-BE-007.7).
 *
 * SOMENTE formatação para exibição. NUNCA recalcula custo, avaliação ou usage — o
 * frontend apenas apresenta o valor OFICIAL da API. A distinção crítica entre
 * "custo estimado conhecido" (inteiro, inclusive 0) e "custo não disponível"
 * (`null`) é preservada aqui: `null` jamais vira "0,00".
 */

import type { AgentCostSummary } from '@/contracts';

/** Sentinela textual para custo indisponível — nunca confundir com zero. */
export const COST_UNAVAILABLE = 'COST_UNAVAILABLE' as const;

/**
 * Formata custo em UNIDADE MENOR (inteiro) para exibição humana. Retorna
 * `COST_UNAVAILABLE` quando o custo é `null` (rate card ausente) — a UI mostra
 * "Custo não disponível", NUNCA "0,00". Zero conhecido é formatado normalmente.
 */
export function formatMinorCost(
  estimatedCostMinor: number | null | undefined,
  currency: string | null | undefined,
  locale = 'pt-BR',
): string | typeof COST_UNAVAILABLE {
  if (estimatedCostMinor == null || currency == null) return COST_UNAVAILABLE;
  // Conversão só para EXIBIÇÃO: o valor de domínio permanece inteiro (minor units).
  const major = estimatedCostMinor / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(major);
  } catch {
    // Currency desconhecida pelo Intl → apresenta o inteiro com o código da moeda.
    return `${currency} ${(estimatedCostMinor / 100).toFixed(2)}`;
  }
}

/** Conveniência a partir do `AgentCostSummary` do resultado operacional. */
export function formatCostSummary(cost: AgentCostSummary, locale = 'pt-BR'): string | typeof COST_UNAVAILABLE {
  return formatMinorCost(cost.estimatedCostMinor, cost.currency, locale);
}

/** Milhares legíveis para contadores (tokens/chamadas). Só formatação. */
export function formatCount(value: number, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Duração em ms → texto curto (s/ms). Só formatação. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/**
 * Converte um valor humano (ex.: "12.34") para UNIDADE MENOR inteira (1234) SEM
 * ponto flutuante monetário: a parte decimal é lida como texto e completada para 2
 * casas. Retorna `null` para entrada vazia/ inválida. Assume 2 casas decimais
 * (moedas ISO comuns). NÃO é cálculo de custo — só conversão de input do teto.
 */
export function toMinorUnits(input: string): number | null {
  const raw = input.trim();
  if (raw === '') return null;
  if (!/^\d+([.,]\d{0,2})?$/.test(raw)) return null;
  const [whole, frac = ''] = raw.replace(',', '.').split('.');
  const cents = (frac + '00').slice(0, 2);
  const minor = Number(whole) * 100 + Number(cents);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Inteiro em unidade menor → string humana com 2 casas (para preencher inputs). */
export function fromMinorUnits(minor: number | null | undefined): string {
  if (minor == null) return '';
  return (minor / 100).toFixed(2);
}
