import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveOperation,
  createOperation,
  createOperationVersion,
  getOperation,
  listAuditEvents,
  listOperations,
  publishOperationVersion,
  saveOperationDraft,
  type RequestContext,
} from '@/application';
import { ALL_PERMISSIONS } from '@/domain/permissions';
import { setSnapshotStore, setServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { buildSeed } from '@/domain/seed';
import { useAppStore } from '@/store/app-store';
import type { Operation } from '@/domain/types';

const ORG = 'org_arden';
// Contexto derivado da sessão: o tenant vem daqui, nunca de um formulário.
const ctx: RequestContext = {
  userId: 'user_helena',
  organizationId: ORG,
  correlationId: 'req_test',
  actorRole: 'operation_owner',
  permissions: [...ALL_PERMISSIONS],
};

function draft(id: string): Operation {
  return { ...buildSeed().operations[0], id, name: `Op ${id}`, status: 'draft', version: '0.1', publishedAt: null };
}

let store: MemorySnapshotStore;

beforeEach(() => {
  store = new MemorySnapshotStore(buildSeed());
  setSnapshotStore(store); // reseta os serviços derivados para este gateway
  setServices(null);
});

describe('casos de uso de Operações (camada de aplicação)', () => {
  it('createOperation cria e grava auditoria pela fronteira única', async () => {
    const op = await createOperation(ctx, draft('op_uc1'));
    expect(op.status).toBe('draft');
    const reloaded = await getOperation(ctx, 'op_uc1');
    expect(reloaded.id).toBe('op_uc1');
    const events = await listAuditEvents(ctx);
    expect(events.some((e) => e.action === 'operation.create')).toBe(true);
  });

  it('o tenant vem do contexto (o organizationId do formulário é ignorado)', async () => {
    // O rascunho tenta forjar outra organização; o caso de uso sobrescreve com o ctx.
    await createOperation(ctx, { ...draft('op_uc_tenant'), organizationId: 'org_horizon' });
    const reloaded = await getOperation(ctx, 'op_uc_tenant');
    expect(reloaded.organizationId).toBe(ORG);
  });

  it('saveOperationDraft faz upsert (cria e depois atualiza)', async () => {
    const d = draft('op_uc2');
    await saveOperationDraft(ctx, d);
    await saveOperationDraft(ctx, { ...d, objective: 'Alterado' });
    expect((await getOperation(ctx, 'op_uc2')).objective).toBe('Alterado');
    const page = await listOperations(ctx);
    expect(page.items.filter((o) => o.id === 'op_uc2')).toHaveLength(1); // sem duplicidade
  });

  it('fluxo de prova: criar versão → publicar (comando explícito) e recuperar', async () => {
    await createOperation(ctx, draft('op_uc3'));
    await createOperationVersion(ctx, 'op_uc3');
    const published = await publishOperationVersion(ctx, 'op_uc3');
    expect(published.status).toBe('scheduled');
    expect((await getOperation(ctx, 'op_uc3')).status).toBe('scheduled');
    const events = await listAuditEvents(ctx);
    expect(events.some((e) => e.action === 'operation.publish')).toBe(true);
  });

  it('defesa local de autorização: publicar sem permissão lança FORBIDDEN', async () => {
    await createOperation(ctx, draft('op_uc_forbidden'));
    const analystCtx: RequestContext = {
      ...ctx,
      actorRole: 'analyst',
      permissions: ctx.permissions.filter((p) => p !== 'operation.publish'),
    };
    await expect(publishOperationVersion(analystCtx, 'op_uc_forbidden')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('erro do repositório é normalizado (NOT_FOUND)', async () => {
    await expect(getOperation(ctx, 'inexistente')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sem dupla persistência: mutação da store não sobrescreve a operação do repositório', async () => {
    await useAppStore.getState().bootstrap();
    // publica uma operação pela camada de aplicação (fonte: repositório)
    await createOperation(ctx, draft('op_uc4'));
    await publishOperationVersion(ctx, 'op_uc4');
    // uma ação da store persiste as fatias que ela ainda gerencia (slice-aware)
    useAppStore.getState().suspendPerson('p_ana');
    await new Promise((r) => setTimeout(r, 0));
    // a operação publicada permanece — a store não clobberou a fatia do repositório
    const op = await getOperation(ctx, 'op_uc4');
    expect(op.status).toBe('scheduled');
    const all = await listOperations(ctx);
    expect(all.items.some((o) => o.id === 'op_uc4')).toBe(true);
  });

  it('archive remove da listagem de ativas', async () => {
    await createOperation(ctx, draft('op_uc5'));
    await archiveOperation(ctx, 'op_uc5');
    const archived = await listOperations(ctx, { status: 'archived' });
    expect(archived.items.some((o) => o.id === 'op_uc5')).toBe(true);
  });
});
