import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './app-store';
import { setDataProvider } from '@/services/service-container';
import { MockDataProvider } from '@/services/providers';
import { buildSeed } from '@/domain/seed';

beforeEach(async () => {
  setDataProvider(new MockDataProvider(buildSeed()));
  await useAppStore.getState().bootstrap();
});

describe('execução percorre as steps[] configuradas', () => {
  it('gera evidência por etapa, consome WU e debita orçamento', () => {
    const store = useAppStore.getState();
    const op = store.data.operations.find((o) => o.id === 'op_fechamento')!;
    const budgetBefore = store.data.budgets.find((b) => b.areaId === op.areaId)!.spent;

    const exec = store.startExecution('op_fechamento', { test: true });

    expect(exec.steps).toHaveLength(op.steps.length);
    // Evidência por etapa.
    const evidence = useAppStore.getState().data.evidence.filter((e) => e.executionId === exec.id);
    expect(evidence).toHaveLength(op.steps.length);
    // Consumo de Work Units igual à soma dos custos das etapas.
    const expectedWu = op.steps.reduce((sum, s) => sum + s.workUnitCost, 0);
    expect(exec.workUnitsUsed).toBe(expectedWu);
    // Debita do orçamento da área.
    const budgetAfter = useAppStore.getState().data.budgets.find((b) => b.areaId === op.areaId)!.spent;
    expect(budgetAfter).toBeGreaterThan(budgetBefore);
  });

  it('conclui em awaiting_approval quando uma etapa exige aprovação e cria Approval', () => {
    const exec = useAppStore.getState().startExecution('op_fechamento');
    expect(exec.state).toBe('awaiting_approval');
    const approvals = useAppStore
      .getState()
      .data.approvals.filter((a) => a.executionId === exec.id);
    expect(approvals.length).toBeGreaterThan(0);
  });

  it('grava dois eventos: execução iniciada e evidência registrada', () => {
    const before = useAppStore.getState().data.auditEvents.length;
    const exec = useAppStore.getState().startExecution('op_fechamento', { test: true });
    const events = useAppStore
      .getState()
      .data.auditEvents.filter((e) => e.relatedExecutionId === exec.id);
    expect(useAppStore.getState().data.auditEvents.length).toBeGreaterThan(before);
    expect(events.map((e) => e.action)).toContain('execution.started');
    expect(events.map((e) => e.action)).toContain('execution.evidence_recorded');
  });
});

describe('publicação', () => {
  it('gera versão 1.0, entra no catálogo e grava auditoria', () => {
    const draft = useAppStore.getState().data.operations.find((o) => o.id === 'op_conciliacao')!;
    const published = useAppStore.getState().publishOperation(draft);
    expect(published.version).toBe('1.0');
    expect(published.publishedAt).not.toBeNull();
    const audit = useAppStore
      .getState()
      .data.auditEvents.find((e) => e.action === 'operation.publish' && e.objectId === published.id);
    expect(audit).toBeTruthy();
  });
});

describe('implantação com trava sequencial', () => {
  it('não conclui a etapa 2 antes da 1', () => {
    const dep = useAppStore.getState().data.deployments[0];
    const step2 = dep.steps[1];
    useAppStore.getState().completeDeploymentStep(dep.id, step2.id);
    const after = useAppStore.getState().data.deployments[0].steps[1];
    expect(after.done).toBe(false);
  });

  it('conclui em ordem e refazer uma etapa desfaz as seguintes', () => {
    const store = () => useAppStore.getState();
    const dep = store().data.deployments[0];
    store().completeDeploymentStep(dep.id, dep.steps[0].id);
    store().completeDeploymentStep(dep.id, dep.steps[1].id);
    store().completeDeploymentStep(dep.id, dep.steps[2].id);
    expect(store().data.deployments[0].steps[2].done).toBe(true);

    // Refazer a etapa 1 desfaz 2 e 3.
    store().redoDeploymentStep(dep.id, dep.steps[0].id);
    const steps = store().data.deployments[0].steps;
    expect(steps[0].done).toBe(false);
    expect(steps[1].done).toBe(false);
    expect(steps[2].done).toBe(false);
  });

  it('só marca concluída com as 16 etapas completas', () => {
    const store = () => useAppStore.getState();
    const dep = store().data.deployments[0];
    dep.steps.forEach((s) => store().completeDeploymentStep(dep.id, s.id));
    expect(store().data.deployments[0].completed).toBe(true);
  });
});

describe('ações administrativas gravando na store', () => {
  it('convida pessoa, altera papel e suspende, com auditoria', () => {
    const store = () => useAppStore.getState();
    const person = store().invitePerson({
      name: 'Nova Pessoa',
      email: 'nova@arden.as',
      roleKeys: ['analyst'],
    });
    expect(store().data.people.some((p) => p.id === person.id)).toBe(true);
    expect(person.status).toBe('invited');

    store().updatePersonRoles(person.id, ['supervisor']);
    expect(store().data.people.find((p) => p.id === person.id)!.roleKeys).toEqual(['supervisor']);

    store().suspendPerson(person.id);
    expect(store().data.people.find((p) => p.id === person.id)!.status).toBe('suspended');

    const actions = store().data.auditEvents.map((e) => e.action);
    expect(actions).toContain('people.invite');
    expect(actions).toContain('role.change');
    expect(actions).toContain('people.suspend');
  });

  it('cria e publica política, gravando cada transição', () => {
    const store = () => useAppStore.getState();
    const policy = store().createPolicy({ name: 'Regra nova', level: 'area' });
    store().submitPolicy(policy.id);
    store().publishPolicy(policy.id);
    expect(store().data.policies.find((p) => p.id === policy.id)!.state).toBe('published');
    const actions = store().data.auditEvents.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['policy.create', 'policy.submit', 'policy.publish']),
    );
  });

  it('testar integração a marca como conectada e grava auditoria', () => {
    const store = () => useAppStore.getState();
    store().disconnectIntegration('int_erp');
    store().testIntegration('int_erp');
    const i = store().data.integrations.find((x) => x.id === 'int_erp')!;
    expect(i.status).toBe('connected');
    expect(i.lastTestedAt).toBeTruthy();
    expect(store().data.auditEvents.map((e) => e.action)).toContain('integration.test');
  });

  it('solicita e aprova excedente de Work Units, ampliando a capacidade', () => {
    const store = () => useAppStore.getState();
    const before = store().data.workUnits[0].contracted;
    store().requestWorkUnits({ areaId: 'area_operacoes', amount: 200, justification: 'Pico sazonal' });
    const req = store().data.workUnitRequests[0];
    store().approveWorkUnitRequest(req.id);
    expect(store().data.workUnits[0].contracted).toBe(before + 200);
    expect(store().data.workUnitRequests[0].state).toBe('approved');
  });

  it('promove e reverte ambiente com trava de ordem', () => {
    const store = () => useAppStore.getState();
    // op_conciliacao é rascunho sem ambiente → promove para sandbox.
    store().promoteEnvironment('op_conciliacao');
    expect(store().data.operations.find((o) => o.id === 'op_conciliacao')!.environment).toBe(
      'sandbox',
    );
    store().promoteEnvironment('op_conciliacao');
    expect(store().data.operations.find((o) => o.id === 'op_conciliacao')!.environment).toBe(
      'staging',
    );
    store().rollbackEnvironment('op_conciliacao');
    expect(store().data.operations.find((o) => o.id === 'op_conciliacao')!.environment).toBe(
      'sandbox',
    );
    expect(store().data.auditEvents.map((e) => e.action)).toEqual(
      expect.arrayContaining(['environment.promote', 'environment.rollback']),
    );
  });
});

describe('duplicar operação', () => {
  it('cria um rascunho novo a partir dos dados, sem publicar, com auditoria', () => {
    const store = () => useAppStore.getState();
    const before = store().data.operations.length;
    const copy = store().duplicateOperation('op_fechamento');
    expect(copy).not.toBeNull();
    expect(copy!.status).toBe('draft');
    expect(copy!.version).toBe('0.1');
    expect(copy!.publishedAt).toBeNull();
    expect(copy!.id).not.toBe('op_fechamento');
    expect(store().data.operations.length).toBe(before + 1);
    expect(store().data.auditEvents.some((e) => e.action === 'operation.duplicate')).toBe(true);
  });
});

describe('exclusão de arquivo exige dois aprovadores', () => {
  it('só exclui com dois aprovadores nomeados distintos', () => {
    const store = () => useAppStore.getState();
    store().quarantineFile('file_antigo');
    store().requestFileDeletion('file_antigo', 'p_admin');
    // Primeiro aprovador (o mesmo que solicitou) não basta.
    store().approveFileDeletion('file_antigo', 'p_admin');
    expect(store().data.files.find((f) => f.id === 'file_antigo')!.state).toBe('deletion_requested');
    // Segundo aprovador distinto conclui a exclusão.
    store().approveFileDeletion('file_antigo', 'p_sec');
    expect(store().data.files.find((f) => f.id === 'file_antigo')!.state).toBe('deleted');
  });
});
