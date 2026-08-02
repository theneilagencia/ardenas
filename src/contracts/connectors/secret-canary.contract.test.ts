/**
 * Arden.AS — teste CRÍTICO de não exposição contratual (ARDEN-BE-006.2).
 *
 * Um valor-canário jamais pode vazar por um contrato de SAÍDA: nem em respostas,
 * nem em metadados de credencial, nem nos exemplos do OpenAPI, nem no cliente
 * gerado. Este teste guarda a fase contratual ANTES da implementação do cofre.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildOpenApiDocument } from '../openapi/build-openapi';
import { credentialMetadataResponseItem } from './credential.schema';
import { connection } from './connection.schema';
import { webhookEndpoint } from './webhook.schema';

const CANARY = 'ARDEN_SECRET_CANARY_BE006_CONTRACT';

describe('canário de segredo — contratos de saída', () => {
  it('o documento OpenAPI não contém o canário', () => {
    const doc = JSON.stringify(buildOpenApiDocument());
    expect(doc.includes(CANARY)).toBe(false);
    // E nenhum exemplo declara um segredo de credencial em texto.
    expect(doc.toLowerCase().includes('"secret":"')).toBe(false);
  });

  it('o cliente gerado não contém o canário nem segredos embutidos', () => {
    for (const file of [
      'src/services/api/generated/api-v1-client.ts',
      'src/services/api/v1-http-client.ts',
    ]) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes(CANARY), file).toBe(false);
    }
  });

  it('a metadata de credencial descarta qualquer segredo injetado', () => {
    const parsed = credentialMetadataResponseItem.parse({
      id: 'cred_1',
      organizationId: 'org_1',
      connectionId: 'conn_1',
      versionNumber: 1,
      status: 'ACTIVE',
      fingerprint: 'fp_abc',
      keyVersion: 'v1',
      createdByUserId: 'user_1',
      createdAt: '2026-08-01T00:00:00.000Z',
      activatedAt: '2026-08-01T00:00:00.000Z',
      supersededAt: null,
      revokedAt: null,
      // Campos sensíveis injetados — devem ser descartados pelo schema.
      secret: CANARY,
      token: CANARY,
      encryptedSecret: CANARY,
      nonce: CANARY,
      authTag: CANARY,
    } as never);
    expect(JSON.stringify(parsed).includes(CANARY)).toBe(false);
  });

  it('a resposta de conexão descarta qualquer segredo injetado', () => {
    const parsed = connection.parse({
      id: 'conn_1', organizationId: 'org_1', connectorDefinitionId: 'cd_1',
      connectorKey: 'system.http', connectorVersion: '1', name: 'X', description: null,
      status: 'DRAFT', configuration: {}, networkPolicy: {
        allowedProtocols: ['https'], allowedHosts: [], allowedPorts: [443], allowRedirects: false,
        maximumRedirects: 0, allowPrivateNetworks: false, allowLoopback: false, allowLinkLocal: false,
        maximumRequestBytes: 1024, maximumResponseBytes: 1024, timeoutMs: 15000,
      },
      currentCredentialVersionId: null, lastTestedAt: null, lastTestStatus: 'NOT_TESTED',
      lastErrorCode: null, lastErrorSummary: null, createdByUserId: 'user_1', revision: 1,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      secret: CANARY, authTag: CANARY,
    } as never);
    expect(JSON.stringify(parsed).includes(CANARY)).toBe(false);
  });

  it('a resposta de webhook não expõe hash de token nem segredo', () => {
    const keys = Object.keys((webhookEndpoint as { shape: Record<string, unknown> }).shape);
    expect(keys).not.toContain('pathTokenHash');
    expect(keys).not.toContain('secretCredentialVersionId');
    expect(keys).not.toContain('signingSecret');
  });
});
