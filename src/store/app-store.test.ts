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
