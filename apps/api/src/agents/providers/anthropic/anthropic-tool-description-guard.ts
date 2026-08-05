/**
 * Arden.AS API — isolamento de descrição de tool Anthropic (ARDEN-BE-008.5 §11).
 *
 * A descrição de uma tool é conteúdo tenant-controlled e NUNCA é promovida a system
 * instruction. Aplica: limite de tamanho, normalização Unicode (NFC), redaction de segredos,
 * inspeção de injeção e REJEIÇÃO de conteúdo crítico (segredo/credencial). Devolve a descrição
 * sanitizada + hash (evidência) + sinais. PURO; sem rede; sem LLM.
 */

import { createHash } from 'node:crypto';
import { detectInjectionRules } from '../../runtime/context/prompt-injection-guard';
import { AnthropicToolMappingError } from './anthropic-tool-name-codec';

const MAX_DESCRIPTION_CHARS = 500;

/** Padrões que NUNCA podem aparecer numa descrição (segredo/credencial explícitos). */
const CREDENTIAL_MARKERS = [
  /sk-[a-z0-9-]{8,}/i,
  /bearer\s+[a-z0-9._-]{8,}/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /authorization\s*[:=]/i,
  /-----begin [a-z ]*private key-----/i,
];

export interface AnthropicSafeDescription {
  /** Texto sanitizado (limitado, NFC, sem segredo) — seguro para o provider. */
  description: string;
  /** sha256 da descrição ORIGINAL — evidência sem persistir o conteúdo. */
  descriptionHash: string;
  /** Códigos de sinal de injeção detectados (não bloqueantes; isolados). */
  injectionSignals: string[];
}

export class AnthropicToolDescriptionGuard {
  /**
   * Sanitiza a descrição. Lança `AGENT_TOOL_DESCRIPTION_REJECTED` se contiver segredo/credencial
   * explícito (§11: não permitir API key / credential / authorization). Injeção textual NÃO
   * bloqueia (a descrição é isolada como dado), mas gera sinais.
   */
  sanitize(alias: string, raw: string): AnthropicSafeDescription {
    const descriptionHash = createHash('sha256').update(raw).digest('hex');
    const normalized = raw.normalize('NFC');

    for (const marker of CREDENTIAL_MARKERS) {
      if (marker.test(normalized)) {
        throw new AnthropicToolMappingError('AGENT_TOOL_DESCRIPTION_REJECTED', `Descrição da tool "${alias}" contém material sensível.`);
      }
    }

    const injectionSignals = detectInjectionRules(normalized.toLowerCase()).map((h) => h.code);
    const clipped = normalized.length > MAX_DESCRIPTION_CHARS ? normalized.slice(0, MAX_DESCRIPTION_CHARS) : normalized;
    const safe = clipped.length > 0 ? clipped : `Tool ${alias}`;
    return { description: safe, descriptionHash, injectionSignals };
  }
}
