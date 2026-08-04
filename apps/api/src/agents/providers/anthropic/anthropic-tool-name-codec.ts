/**
 * Arden.AS API — codec de nome de tool Anthropic (ARDEN-BE-008.5 §9).
 *
 * Mapa PER-REQUEST entre o `alias` canônico do Arden e o `name` aceito pelo protocolo
 * Anthropic (`^[a-zA-Z0-9_-]{1,64}$`). Determinístico, reversível e sem colisões. Preferência:
 * alias compatível → mesmo nome. Só transforma quando o alias é incompatível (nome seguro
 * derivado por hash). O nome transformado NUNCA é persistido como identidade de domínio — é
 * só um artefato do request. Nomes reservados (ex.: a tool sintética de structured output)
 * nunca são reusados por uma tool real.
 */

import { createHash } from 'node:crypto';

/** Padrão VERIFIED do protocolo Anthropic Messages (SDK oficial v0.115.0) para nome de tool. */
export const ANTHROPIC_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** Erro tipado de mapeamento de tool (código canônico; nunca vaza segredo). */
export class AnthropicToolMappingError extends Error {
  constructor(
    readonly code: 'AGENT_TOOL_SCHEMA_INVALID' | 'AGENT_TOOL_DESCRIPTION_REJECTED' | 'AGENT_TOOL_NOT_ALLOWED',
    message: string,
  ) {
    super(message);
    this.name = 'AnthropicToolMappingError';
  }
}

export class AnthropicToolNameCodec {
  private readonly nameToAlias = new Map<string, string>();
  private readonly aliasToName = new Map<string, string>();
  private readonly reserved: ReadonlySet<string>;

  constructor(reservedNames: readonly string[] = []) {
    this.reserved = new Set(reservedNames);
  }

  /** Registra um alias e devolve o nome do provider (idempotente por alias). */
  register(alias: string): string {
    const existing = this.aliasToName.get(alias);
    if (existing) return existing;
    const name = this.encode(alias);
    const clash = this.nameToAlias.get(name);
    if (clash !== undefined && clash !== alias) {
      throw new AnthropicToolMappingError('AGENT_TOOL_SCHEMA_INVALID', 'Colisão de nome de tool no request.');
    }
    this.nameToAlias.set(name, alias);
    this.aliasToName.set(alias, name);
    return name;
  }

  /** Reverse lookup: nome devolvido pelo modelo → alias canônico (undefined se desconhecido). */
  resolve(name: string): string | undefined {
    const known = this.nameToAlias.get(name);
    if (known) return known;
    // Nome idêntico a um alias registrado (caminho de identidade), sem transformação.
    return this.aliasToName.has(name) ? name : undefined;
  }

  /** Nome do provider para um alias já registrado (undefined se não registrado). */
  nameFor(alias: string): string | undefined {
    return this.aliasToName.get(alias);
  }

  private encode(alias: string): string {
    if (ANTHROPIC_TOOL_NAME_PATTERN.test(alias) && !this.reserved.has(alias)) return alias;
    // Nome seguro determinístico (reversível pelo mapa per-request). Prefixo estável.
    const hash = createHash('sha256').update(alias).digest('hex').slice(0, 24);
    return `arden_t_${hash}`;
  }
}
