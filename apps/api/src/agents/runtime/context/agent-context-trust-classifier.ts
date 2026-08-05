/**
 * Arden.AS API — classificação de confiança de fontes de contexto (ARDEN-BE-007.4).
 *
 * PURO e determinístico. Define o nível de confiança de cada fonte para orientar o
 * ISOLAMENTO (delimitadores `<untrusted_source>`) e a política de bloqueio. Regra central:
 *  - SYSTEM_TRUSTED: metadados da operação (curados pela plataforma).
 *  - TENANT_TRUSTED: input da execução e saídas de etapas internas determinísticas.
 *  - UNTRUSTED_EXTERNAL: resultados de tools, documentos e saídas de etapas cujo produtor
 *    é outro agente (`agent.execute`) ou uma ferramenta externa (`external.*`) — conteúdo
 *    potencialmente influenciado pelo mundo externo, tratado SEMPRE como dado, nunca como
 *    instrução.
 */

import { Injectable } from '@nestjs/common';
import type {
  ClassifiedContextSource,
  ContextTrustLevel,
  NormalizedContextSource,
} from './agent-context.types';

/** True quando o produtor da etapa anterior é externo/não determinístico. */
export function isUntrustedProducer(actionKey: string | undefined): boolean {
  if (!actionKey) return true; // desconhecido → trata como não confiável (fail-safe).
  return actionKey === 'agent.execute' || actionKey.startsWith('external.');
}

export function classifyTrust(source: NormalizedContextSource): ContextTrustLevel {
  switch (source.kind) {
    case 'OPERATION_METADATA':
      return 'SYSTEM_TRUSTED';
    case 'EXECUTION_INPUT':
      return 'TENANT_TRUSTED';
    case 'PREVIOUS_STEP_OUTPUT':
      return isUntrustedProducer(source.producerActionKey) ? 'UNTRUSTED_EXTERNAL' : 'TENANT_TRUSTED';
    case 'TOOL_RESULT':
    case 'LINKED_DOCUMENT':
    default:
      return 'UNTRUSTED_EXTERNAL';
  }
}

@Injectable()
export class AgentContextTrustClassifier {
  classify(source: NormalizedContextSource): ClassifiedContextSource {
    return { ...source, trust: classifyTrust(source) };
  }
}
