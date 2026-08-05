/**
 * Arden.AS API — validação de ModelConfiguration Anthropic (ARDEN-BE-008.2 §25/§27).
 *
 * Serviço PEQUENO e focado (não monolítico): quando o provider é `anthropic.direct`,
 * valida que o `modelId` é allowlisted (nunca arbitrário) e que os `parameters` batem no
 * schema discriminado estrito (rejeita model/apiKey/baseUrl/headers/tools/system/
 * organizationId/timeout/retry). Sem SDK, sem rede, sem segredo. Não torna o provider
 * executável — apenas administra a preparação segura da configuração.
 */

import { Injectable } from '@nestjs/common';
import {
  ANTHROPIC_PROVIDER_KEY,
  anthropicModelParameters,
  isAllowedAnthropicModelId,
} from '@arden/contracts';
import { validationError } from '../../common/errors/api-error';

@Injectable()
export class AnthropicConfigurationValidationService {
  /** Valida uma configuração de modelo quando o provider é Anthropic (no-op caso contrário). */
  validate(providerKey: string, modelId: string, parameters: unknown): void {
    if (providerKey !== ANTHROPIC_PROVIDER_KEY) return;

    if (!isAllowedAnthropicModelId(modelId)) {
      throw validationError(
        [{ field: 'modelId', code: 'MODEL_ID_NOT_ALLOWLISTED', message: `modelId não allowlisted para ${ANTHROPIC_PROVIDER_KEY}.` }],
        'modelId Anthropic inválido.',
      );
    }

    const parsed = anthropicModelParameters.safeParse(parameters ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join('.') || 'parameters';
      throw validationError(
        [{ field: `parameters.${path}`, code: 'ANTHROPIC_PARAMETERS_INVALID', message: issue?.message ?? 'Parâmetro não permitido.' }],
        'Parâmetros Anthropic inválidos.',
      );
    }
  }
}
