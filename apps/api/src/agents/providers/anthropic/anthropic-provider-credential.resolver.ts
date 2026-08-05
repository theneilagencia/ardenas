/**
 * Arden.AS API — resolução tenant-scoped da credencial Anthropic (ARDEN-BE-008.3 §19).
 *
 * Valida que a conexão pertence ao tenant, é do conector `system.anthropic`, está ativa e
 * tem uma versão de credencial ATIVA no cofre; devolve a apiKey em MEMÓRIA (nunca persistida/
 * logada). Cross-tenant → conexão não encontrada (404 seguro), sem tocar o transporte.
 */

import { Injectable } from '@nestjs/common';
import { ANTHROPIC_CONNECTOR_KEY } from '@arden/contracts';
import { PrismaService } from '../../../database/prisma.service';
import { CredentialResolver } from '../../../connectors/vault/credential-resolver';
import { OrganizationConnectionsRepository } from '../../../connectors/connections/connections.repository';
import { notFound, credentialRequired, credentialInvalid } from '../../../common/errors/api-error';

export interface ResolveAnthropicCredentialInput {
  organizationId: string;
  modelConfigurationId: string;
  credentialConnectionId: string | null;
  correlationId?: string;
}

export interface ResolvedAnthropicCredential {
  apiKey: string;
  fingerprint: string;
  credentialVersionId: string;
  connectionId: string;
  /** Config NÃO sensível da conexão (base URL travada em OFFICIAL). */
  timeoutMs: number;
  maximumRetries: number;
  /** Se ESTA versão de credencial passou por um smoke test PASSED (ARDEN-BE-008.4). */
  smokeVerified: boolean;
}

@Injectable()
export class AnthropicProviderCredentialResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly credentials: CredentialResolver,
  ) {}

  async resolve(input: ResolveAnthropicCredentialInput): Promise<ResolvedAnthropicCredential> {
    const { organizationId, credentialConnectionId, correlationId } = input;
    if (!credentialConnectionId) throw credentialRequired('Configuração Anthropic sem conexão de credencial.');

    // Tenant-scoped: cross-tenant → não encontrada (não revela existência).
    const conn = await this.connections.findById(organizationId, credentialConnectionId);
    if (!conn) throw notFound('Conexão de credencial não encontrada no tenant.');

    // Conector correto (system.anthropic) — nunca outro conector.
    const def = await this.prisma.connectorDefinition.findUnique({ where: { id: conn.connectorDefinitionId } });
    if (!def || def.key !== ANTHROPIC_CONNECTOR_KEY) {
      throw credentialInvalid([{ field: 'credentialConnectionId', code: 'WRONG_CONNECTOR', message: 'Conexão não é do conector Anthropic.' }]);
    }

    // Resolve a credencial ATIVA no cofre (valida ACTIVE/REVOKED/SUSPENDED; decifra em memória).
    const resolved = await this.credentials.resolveActiveCredential({ organizationId, connectionId: credentialConnectionId, correlationId });
    const apiKey = resolved.secret['apiKey'];
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      // Descarta qualquer material resolvido antes de falhar.
      resolved.secret = {};
      throw credentialInvalid([{ field: 'apiKey', code: 'APIKEY_MISSING', message: 'Credencial Anthropic sem apiKey.' }]);
    }
    const config = (conn.configuration ?? {}) as { timeoutMs?: unknown; maximumRetries?: unknown };
    // Verificação de smoke test vinculada À VERSÃO de credencial (rotação invalida).
    const version = await this.prisma.connectionCredentialVersion.findFirst({ where: { id: resolved.credentialVersionId }, select: { metadata: true } });
    const smoke = (version?.metadata as { smokeTest?: { status?: string; credentialVersionId?: string } } | null)?.smokeTest;
    const smokeVerified = smoke?.status === 'PASSED' && smoke.credentialVersionId === resolved.credentialVersionId;
    const out: ResolvedAnthropicCredential = {
      apiKey,
      fingerprint: resolved.fingerprint,
      credentialVersionId: resolved.credentialVersionId,
      connectionId: credentialConnectionId,
      timeoutMs: typeof config.timeoutMs === 'number' ? config.timeoutMs : 60_000,
      maximumRetries: typeof config.maximumRetries === 'number' ? config.maximumRetries : 2,
      smokeVerified,
    };
    resolved.secret = {}; // descarta o mapa do cofre (apiKey copiada apenas para `out`).
    return out;
  }
}
