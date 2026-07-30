import { beforeEach, describe, expect, it } from 'vitest';
import {
  archiveOperation,
  createOperation,
  createOperationVersion,
  getOperation,
  listOperations,
  publishOperationVersion,
  saveOperationDraft,
  type AuditContext,
} from '@/application';
import { listAuditEvents } from '@/application';
import { setSnapshotStore, setServices } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { buildSeed } from '@/domain/seed';
import { useAppStore } from '@/store/app-store';
import type { Operation } from '@/domain/types';

const ORG = 'org_arden';
const ctx: AuditContext = { actorId: 'p_owner', actorRole: 'operation_owner', organizationId: ORG };

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
    const op = await createOperation(draft('op_uc1'), ctx);
    expect(op.status).toBe('draft');
    const reloaded = await getOperation('op_uc1');
    expect(reloaded.id).toBe('op_uc1');
    const events = await listAuditEvents({ organizationId: ORG });
    expect(events.some((e) => e.action === 'operation.create')).toBe(true);
  });

  it('saveOperationDraft faz upsert (cria e depois atualiza)', async () => {
    const d = draft('op_uc2');
    await saveOperationDraft(d, ctx);
    await saveOperationDraft({ ...d, objective: 'Alterado' }, ctx);
    expect((await getOperation('op_uc2')).objective).toBe('Alterado');
    const page = await listOperations({ organizationId: ORG });
    expect(page.items.filter((o) => o.id === 'op_uc2')).toHaveLength(1); // sem duplicidade
  });

  it('fluxo de prova: criar versão → publicar (comando explícito) e recuperar', async () => {
    await createOperation(draft('op_uc3'), ctx);
    await createOperationVersion('op_uc3', ctx);
    const published = await publishOperationVersion('op_uc3', ctx);
    expect(published.status).toBe('scheduled');
    expect((await getOperation('op_uc3')).status).toBe('scheduled');
    const events = await listAuditEvents({ organizationId: ORG });
    expect(events.some((e) => e.action === 'operation.publish')).toBe(true);
  });

  it('erro do repositório é normalizado (NOT_FOUND)', async () => {
    await expect(getOperation('inexistente')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sem dupla persistência: mutação da store não sobrescreve a operação do repositório', async () => {
    await useAppStore.getState().bootstrap();
    // publica uma operação pela camada de aplicação (fonte: repositório)
    await createOperation(draft('op_uc4'), ctx);
    await publishOperationVersion('op_uc4', ctx);
    // uma ação da store persiste as fatias que ela ainda gerencia (slice-aware)
    useAppStore.getState().suspendPerson('p_ana');
    await new Promise((r) => setTimeout(r, 0));
    // a operação publicada permanece — a store não clobberou a fatia do repositório
    const op = await getOperation('op_uc4');
    expect(op.status).toBe('scheduled');
    const all = await listOperations({ organizationId: ORG });
    expect(all.items.some((o) => o.id === 'op_uc4')).toBe(true);
  });

  it('archive remove da listagem de ativas', async () => {
    await createOperation(draft('op_uc5'), ctx);
    await archiveOperation('op_uc5', ctx);
    const archived = await listOperations({ organizationId: ORG, status: 'archived' });
    expect(archived.items.some((o) => o.id === 'op_uc5')).toBe(true);
  });
});
