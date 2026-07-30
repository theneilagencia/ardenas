import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './app-store';
import { setServices, setSnapshotStore } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { listAuditEvents } from '@/application';
import { buildSeed } from '@/domain/seed';
import type { Operation } from '@/domain/types';

const ORG = 'org_arden';
const flush = () => new Promise((r) => setTimeout(r, 0));
const auditActions = async () => (await listAuditEvents({ organizationId: ORG })).map((e) => e.action);

beforeEach(async () => {
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  await useAppStore.getState().bootstrap();
});

describe('execução percorre as steps[] (agregado ainda na store)', () => {
  function opFechamento(): Operation {
    return useAppStore.getState().data.operations.find((o) => o.id === 'op_fechamento')!;
  }

  it('gera evidência por etapa, consome WU e debita orçamento', () => {
    const op = opFechamento();
    const budgetBefore = useAppStore.getState().data.budgets.find((b) => b.areaId === op.areaId)!.spent;
    const exec = useAppStore.getState().startExecution(op, { test: true });
    expect(exec.steps).toHaveLength(op.steps.length);
    const evidence = useAppStore.getState().data.evidence.filter((e) => e.executionId === exec.id);
    expect(evidence).toHaveLength(op.steps.length);
    const budgetAfter = useAppStore.getState().data.budgets.find((b) => b.areaId === op.areaId)!.spent;
    expect(budgetAfter).toBeGreaterThan(budgetBefore);
  });

  it('conclui em awaiting_approval quando uma etapa exige aprovação e cria Approval', () => {
    const exec = useAppStore.getState().startExecution(opFechamento());
    expect(exec.state).toBe('awaiting_approval');
    const approvals = useAppStore.getState().data.approvals.filter((a) => a.executionId === exec.id);
    expect(approvals.length).toBeGreaterThan(0);
  });

  it('grava eventos de execução na fronteira de auditoria', async () => {
    const exec = useAppStore.getState().startExecution(opFechamento(), { test: true });
    await flush();
    const actions = await auditActions();
    expect(actions).toContain('execution.started');
    expect(actions).toContain('execution.evidence_recorded');
    expect(exec.id).toBeTruthy();
  });
});

describe('implantação com trava sequencial (store)', () => {
  it('não conclui a etapa 2 antes da 1', () => {
    const dep = useAppStore.getState().data.deployments[0];
    useAppStore.getState().completeDeploymentStep(dep.id, dep.steps[1].id);
    expect(useAppStore.getState().data.deployments[0].steps[1].done).toBe(false);
  });

  it('conclui em ordem e refazer desfaz as seguintes; só conclui com as 16', () => {
    const store = () => useAppStore.getState();
    const dep = store().data.deployments[0];
    dep.steps.forEach((s) => store().completeDeploymentStep(dep.id, s.id));
    expect(store().data.deployments[0].completed).toBe(true);
    store().redoDeploymentStep(dep.id, dep.steps[0].id);
    expect(store().data.deployments[0].steps[2].done).toBe(false);
  });
});

describe('ações administrativas (store) gravam na fronteira de auditoria', () => {
  it('convida, altera papel e suspende pessoa', async () => {
    const store = () => useAppStore.getState();
    const person = store().invitePerson({ name: 'Nova', email: 'n@x', roleKeys: ['analyst'] });
    store().updatePersonRoles(person.id, ['supervisor']);
    store().suspendPerson(person.id);
    expect(store().data.people.find((p) => p.id === person.id)!.status).toBe('suspended');
    await flush();
    const actions = await auditActions();
    expect(actions).toEqual(expect.arrayContaining(['people.invite', 'role.change', 'people.suspend']));
  });

  it('cria e publica política', async () => {
    const store = () => useAppStore.getState();
    const policy = store().createPolicy({ name: 'Regra', level: 'area' });
    store().submitPolicy(policy.id);
    store().publishPolicy(policy.id);
    expect(store().data.policies.find((p) => p.id === policy.id)!.state).toBe('published');
    await flush();
    expect(await auditActions()).toEqual(
      expect.arrayContaining(['policy.create', 'policy.submit', 'policy.publish']),
    );
  });

  it('solicita e aprova excedente de Work Units', () => {
    const store = () => useAppStore.getState();
    const before = store().data.workUnits[0].contracted;
    store().requestWorkUnits({ areaId: 'area_operacoes', amount: 200, justification: 'Pico' });
    store().approveWorkUnitRequest(store().data.workUnitRequests[0].id);
    expect(store().data.workUnits[0].contracted).toBe(before + 200);
  });
});

describe('exclusão de arquivo exige dois aprovadores (store)', () => {
  it('só exclui com dois aprovadores distintos', () => {
    const store = () => useAppStore.getState();
    store().quarantineFile('file_antigo');
    store().requestFileDeletion('file_antigo', 'p_admin');
    store().approveFileDeletion('file_antigo', 'p_admin');
    expect(store().data.files.find((f) => f.id === 'file_antigo')!.state).toBe('deletion_requested');
    store().approveFileDeletion('file_antigo', 'p_sec');
    expect(store().data.files.find((f) => f.id === 'file_antigo')!.state).toBe('deleted');
  });
});
