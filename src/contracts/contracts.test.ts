/**
 * Arden.AS — testes de contrato da API v1 (ARDEN-FE-003).
 * Validam schemas, padrões (erros/paginação), invariantes de tenant/permissão/
 * imutabilidade/idempotência/concorrência e independência do frontend.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/domain/permissions';
import {
  apiErrorResponse,
  ERROR_HTTP_STATUS,
  apiErrorCode,
  createOperationRequest,
  publishOperationVersionRequest,
  publishableAuthorityProfile,
  authorityProfile,
  paginationMeta,
  IDEMPOTENT_COMMANDS,
  endpoints,
  schemaRegistry,
} from './index';

describe('schemas — aceitam válidos e rejeitam inválidos', () => {
  it('createOperationRequest aceita payload válido', () => {
    expect(createOperationRequest.safeParse({ name: 'Fechamento' }).success).toBe(true);
  });

  it('createOperationRequest rejeita nome vazio', () => {
    expect(createOperationRequest.safeParse({ name: '' }).success).toBe(false);
  });

  it('createOperationRequest NÃO aceita organizationId (tenant não vem do body)', () => {
    const parsed = createOperationRequest.parse({ name: 'X', organizationId: 'org_hack' } as never);
    expect('organizationId' in parsed).toBe(false);
  });

  it('publishableAuthorityProfile rejeita ação destrutiva abaixo de execute_with_approval', () => {
    const profile = {
      level: 3 as const,
      allowedActions: [{ key: 'delete', semanticLevel: 'execute_under_rule' as const, destructive: true }],
      approvalRequired: false,
      approvalPolicyId: null,
      financialLimit: null,
      destructiveActionsAllowed: true,
      justificationRequired: false,
    };
    expect(authorityProfile.safeParse(profile).success).toBe(true); // base aceita
    expect(publishableAuthorityProfile.safeParse(profile).success).toBe(false); // publicação recusa
  });
});

describe('padrão de erros', () => {
  it('apiErrorResponse valida um erro completo com correlationId', () => {
    const sample = {
      error: {
        code: 'VERSION_CONFLICT',
        message: 'Revisão desatualizada',
        correlationId: 'req_123',
        details: { expectedRevision: 2, currentRevision: 3 },
      },
    };
    expect(apiErrorResponse.safeParse(sample).success).toBe(true);
  });

  it('correlationId é obrigatório no corpo de erro', () => {
    const bad = { error: { code: 'INTERNAL_ERROR', message: 'x' } };
    expect(apiErrorResponse.safeParse(bad).success).toBe(false);
  });

  it('erros não usam apenas 400 (variedade de status)', () => {
    const statuses = new Set(Object.values(ERROR_HTTP_STATUS));
    expect(statuses.size).toBeGreaterThan(3);
    expect(ERROR_HTTP_STATUS.VERSION_CONFLICT).toBe(409);
    expect(ERROR_HTTP_STATUS.VALIDATION_ERROR).toBe(422);
    expect(ERROR_HTTP_STATUS.SESSION_EXPIRED).toBe(401);
  });

  it('todo código de erro tem status HTTP mapeado', () => {
    for (const code of apiErrorCode.options) {
      expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('paginação por cursor', () => {
  it('valida meta de paginação por cursor', () => {
    const ok = paginationMeta.safeParse({ nextCursor: 'abc', hasNextPage: true, limit: 50 });
    expect(ok.success).toBe(true);
  });
});

describe('tenant fora dos bodies comuns', () => {
  it('nenhum CORPO de request contém organizationId, exceto SwitchOrganizationRequest', () => {
    // Considera apenas os schemas de fato usados como corpo de request por um
    // endpoint (recursos como `ApprovalRequest` legitimamente têm organizationId).
    const requestBodies = new Set(
      endpoints.map((e) => e.requestSchema).filter((s): s is string => Boolean(s)),
    );
    const offenders: string[] = [];
    for (const name of requestBodies) {
      if (name === 'SwitchOrganizationRequest') continue; // exceção legítima (comando de sessão)
      const schema = schemaRegistry[name];
      if (schema instanceof z.ZodObject && 'organizationId' in schema.shape) {
        offenders.push(name);
      }
    }
    expect(offenders, offenders.join(', ')).toEqual([]);
  });
});

describe('permissões mapeadas ao catálogo estável (ARDEN-FE-002)', () => {
  it('todo endpoint não-sessão exige permissão do catálogo; sessão não exige', () => {
    const catalog = new Set<string>(ALL_PERMISSIONS);
    for (const e of endpoints) {
      // Sessão (autenticação) e endpoints públicos autenticados por outro mecanismo
      // (ex.: webhook de entrada por assinatura — ARDEN-BE-006) não exigem permissão.
      if (e.tag === 'Session' || e.public) {
        expect(e.permission, e.id).toBeNull();
      } else {
        expect(e.permission, e.id).not.toBeNull();
        expect(catalog.has(e.permission as string), `${e.id} → ${e.permission}`).toBe(true);
      }
    }
  });
});

describe('auditoria é somente leitura (sem escrita pública)', () => {
  it('não há POST/PATCH/DELETE em /audit-events', () => {
    const writes = endpoints.filter(
      (e) => e.path.includes('/audit-events') && e.method !== 'GET',
    );
    expect(writes.map((e) => e.id)).toEqual([]);
  });
});

describe('imutabilidade de versões publicada', () => {
  it('PATCH de versão documenta ALREADY_PUBLISHED e só rascunho', () => {
    const update = endpoints.find((e) => e.id === 'operationVersions.update')!;
    expect(update.description).toMatch(/ALREADY_PUBLISHED/);
    // Não existe endpoint que altere/exclua uma versão publicada.
    const dangerous = endpoints.filter((e) => /versions\/\{versionId\}$/.test(e.path) && e.method === 'DELETE');
    expect(dangerous).toEqual([]);
  });
});

describe('publicação e criação transacional', () => {
  it('publishOperationVersionRequest exige expectedRevision', () => {
    expect(publishOperationVersionRequest.safeParse({ changeSummary: 'x' }).success).toBe(false);
    expect(
      publishOperationVersionRequest.safeParse({ expectedRevision: 1, changeSummary: 'x' }).success,
    ).toBe(true);
  });

  it('criar operação documenta a criação transacional da primeira versão', () => {
    const create = endpoints.find((e) => e.id === 'operations.create')!;
    expect(create.description).toMatch(/vers[aã]o|transacional/i);
  });
});

describe('idempotência e concorrência documentadas', () => {
  it('os comandos críticos são idempotentes', () => {
    const idempotent = new Set(endpoints.filter((e) => e.idempotent).map((e) => e.id));
    expect(idempotent.has('operations.create')).toBe(true);
    expect(idempotent.has('operationVersions.create')).toBe(true);
    expect(idempotent.has('operationVersions.publish')).toBe(true);
    expect(idempotent.has('operations.duplicate')).toBe(true);
    expect(idempotent.has('operations.archive')).toBe(true);
    expect(IDEMPOTENT_COMMANDS.length).toBe(5);
  });

  it('mutações de recurso preveem concorrência otimista (expectedRevision)', () => {
    const update = endpoints.find((e) => e.id === 'operations.update')!;
    expect(update.optimisticConcurrency).toBe(true);
    const publish = endpoints.find((e) => e.id === 'operationVersions.publish')!;
    expect(publish.optimisticConcurrency).toBe(true);
  });
});

describe('independência do frontend (DTOs não importam React/Zustand)', () => {
  it('nenhum arquivo de contrato importa react/zustand/store/components/hooks/app', () => {
    const forbidden = [
      /from ['"]react['"]/,
      /from ['"]zustand['"]/,
      /@\/store/,
      /@\/components/,
      /@\/features/,
      /@\/hooks/,
      /@\/app\//,
    ];
    const offenders: string[] = [];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
      }
      return out;
    };
    for (const file of walk('src/contracts')) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(src)) offenders.push(`${file} :: ${pattern}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
