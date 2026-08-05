/**
 * Arden.AS API — transporte SDK do Anthropic (ARDEN-BE-008.3 §8/§11) — BORDA DO SDK.
 *
 * ÚNICO arquivo autorizado a importar `@anthropic-ai/sdk`. Nenhum tipo do SDK escapa desta
 * borda: entra `AnthropicTransportRequest` + contexto (apiKey em memória) e sai
 * `AnthropicTransportResponse` (tipos internos). Cliente criado POR CHAMADA (sem singleton
 * global, sem chave em cache, sem compartilhamento entre tenants). Base URL travada na
 * oficial; sem headers/proxy/beta/versão arbitrários. Retries do SDK DESABILITADOS
 * (a política é do adapter). NÃO chama a rede enquanto o gate de chamadas externas está off.
 */

import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { APP_CONFIG } from '../../../../config/config.module';
import type { AppConfig } from '../../../../config/env.schema';
import { ANTHROPIC_OFFICIAL_BASE_URL } from '@arden/contracts';
import type { AnthropicTransport, AnthropicTransportExecutionContext } from '../anthropic-transport.port';
import { AnthropicTransportException } from '../anthropic-transport.port';
import type {
  AnthropicTransportRequest,
  AnthropicTransportResponse,
  AnthropicTransportContentBlock,
  AnthropicStopReason,
} from '../anthropic-transport.types';

/** Classe sintética de erro quando o gate de chamadas externas está desligado. */
const EXTERNAL_CALLS_DISABLED = 'ArdenExternalCallsDisabled';

@Injectable()
export class AnthropicSdkTransport implements AnthropicTransport {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async createMessage(
    request: AnthropicTransportRequest,
    context: AnthropicTransportExecutionContext,
  ): Promise<AnthropicTransportResponse> {
    // Gate de chamada externa (ARDEN-BE-008.3 §16): mesmo registrado, o transporte real
    // NÃO alcança a rede enquanto o gate está off. Nenhum cliente é criado.
    if (!this.config.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED) {
      throw new AnthropicTransportException(
        { providerErrorClass: EXTERNAL_CALLS_DISABLED, httpStatus: null },
        'Chamadas externas ao provider estão desabilitadas.',
      );
    }

    // Cliente POR CHAMADA: base URL oficial travada, retries do SDK = 0, timeout do adapter.
    const client = new Anthropic({
      apiKey: context.apiKey,
      baseURL: ANTHROPIC_OFFICIAL_BASE_URL,
      timeout: context.timeoutMs,
      maxRetries: 0,
    });

    try {
      const message = await client.messages.create(
        {
          model: request.model,
          max_tokens: request.max_tokens,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
          ...(request.stop_sequences ? { stop_sequences: request.stop_sequences } : {}),
          ...(request.tools ? { tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema })) } : {}),
          ...(request.tool_choice ? { tool_choice: request.tool_choice as Anthropic.Messages.ToolChoice } : {}),
        },
        { signal: context.signal },
      );
      return this.normalize(message);
    } catch (err) {
      throw this.classify(err);
    }
  }

  /** Normaliza a resposta do SDK para os tipos internos (sem vazar tipo do SDK). */
  private normalize(message: Anthropic.Messages.Message): AnthropicTransportResponse {
    const content: AnthropicTransportContentBlock[] = [];
    for (const block of message.content) {
      if (block.type === 'text') content.push({ type: 'text', text: block.text });
      else if (block.type === 'tool_use') content.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
    }
    const u = message.usage;
    return {
      id: message.id,
      stop_reason: (message.stop_reason ?? null) as AnthropicStopReason | null,
      content,
      usage: {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_read_input_tokens: u.cache_read_input_tokens ?? null,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? null,
      },
    };
  }

  /** Classifica o erro do SDK para `AnthropicTransportException` (sem vazar body/segredo). */
  private classify(err: unknown): AnthropicTransportException {
    if (err instanceof AnthropicTransportException) return err;
    const providerErrorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    const httpStatus = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : null;
    const retryAfterMs = this.retryAfterMs(err);
    // Falhas de conexão/abort do SDK real são conservadoramente AFTER_SEND (incerto).
    const phase = providerErrorClass.startsWith('APIConnection') ? ('AFTER_SEND' as const) : undefined;
    return new AnthropicTransportException(
      { providerErrorClass, httpStatus, retryAfterMs, phase },
      'Falha na chamada ao provider.',
    );
  }

  private retryAfterMs(err: unknown): number | null {
    const headers = (err as { headers?: unknown }).headers;
    let raw: string | null = null;
    if (headers && typeof (headers as { get?: unknown }).get === 'function') {
      raw = (headers as { get(name: string): string | null }).get('retry-after');
    } else if (headers && typeof headers === 'object') {
      const v = (headers as Record<string, unknown>)['retry-after'];
      raw = typeof v === 'string' ? v : null;
    }
    if (!raw) return null;
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : null;
  }
}
