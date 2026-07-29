/**
 * Arden.AS — dados de demonstração.
 * Determinístico: timestamps e IDs fixos para funcionamento offline e testes.
 */

import type { DomainSnapshot } from '@/services/contracts';
import type {
  Deployment,
  DeploymentStep,
  Operation,
  OperationStep,
  Person,
  RoleKey,
} from './types';

const T0 = '2026-01-15T09:00:00.000Z';
const T1 = '2026-02-01T14:30:00.000Z';
const T2 = '2026-03-10T11:20:00.000Z';

const ORG = 'org_arden';
const ORG2 = 'org_horizon';
const CO = 'co_arden_br';
const CO2 = 'co_arden_pt';
const UNIT = 'unit_sudeste';
const AREA = 'area_operacoes';
const CC = 'cc_op_01';

function person(id: string, name: string, email: string, roleKeys: RoleKey[], companyId = CO): Person {
  return {
    id,
    organizationId: ORG,
    companyId,
    name,
    email,
    roleKeys,
    status: 'active',
  };
}

const PEOPLE: Person[] = [
  person('p_admin', 'Helena Vasques', 'helena@arden.as', ['corporate_admin']),
  person('p_fin', 'Rafael Duarte', 'rafael@arden.as', ['financial_admin']),
  person('p_owner', 'Marina Costa', 'marina@arden.as', ['operation_owner']),
  person('p_sup', 'Tiago Nunes', 'tiago@arden.as', ['supervisor']),
  person('p_apr', 'Beatriz Lima', 'beatriz@arden.as', ['approver']),
  person('p_sec', 'André Ferreira', 'andre@arden.as', ['security_admin']),
  person('p_ana', 'Camila Rocha', 'camila@arden.as', ['analyst']),
  person('p_aud', 'Paulo Mendes', 'paulo@arden.as', ['auditor']),
  { ...person('p_susp', 'Usuário Suspenso', 'suspenso@arden.as', ['analyst']), status: 'suspended' },
];

function step(
  order: number,
  name: string,
  description: string,
  opts: Partial<OperationStep> = {},
): OperationStep {
  return {
    id: `step_${order}`,
    order,
    name,
    description,
    authorityLevel: opts.authorityLevel ?? 'execute_under_rule',
    requiresApproval: opts.requiresApproval ?? false,
    workUnitCost: opts.workUnitCost ?? 4,
    producesEvidence: opts.producesEvidence ?? true,
  };
}

const OP_STEPS: OperationStep[] = [
  step(1, 'Coletar registros da fonte', 'Leitura das fontes autorizadas do período.', {
    authorityLevel: 'observe',
    workUnitCost: 3,
  }),
  step(2, 'Validar consistência', 'Aplicar validações de integridade e completude.', {
    authorityLevel: 'prepare',
    workUnitCost: 5,
  }),
  step(3, 'Consolidar resultado', 'Produzir o artefato consolidado do período.', {
    authorityLevel: 'prepare',
    workUnitCost: 6,
  }),
  step(4, 'Registrar decisão', 'Reter para decisão humana antes de qualquer entrega.', {
    authorityLevel: 'execute_with_approval',
    requiresApproval: true,
    workUnitCost: 4,
  }),
  step(5, 'Entregar aos destinatários', 'Entrega dentro de regra previamente aprovada.', {
    authorityLevel: 'execute_under_rule',
    workUnitCost: 4,
  }),
];

const publishedOperation: Operation = {
  id: 'op_fechamento',
  name: 'Fechamento operacional mensal',
  organizationId: ORG,
  companyId: CO,
  unitId: UNIT,
  areaId: AREA,
  costCenterId: CC,
  criticality: 'elevated',
  tags: ['fechamento', 'financeiro', 'mensal'],
  problem: 'O fechamento manual leva cinco dias úteis e acumula exceções não rastreadas.',
  objective: 'Consolidar o fechamento com evidência por etapa e SLA previsível.',
  expectedResult: 'Relatório de fechamento revisado e aprovado até o 2º dia útil.',
  recipients: ['p_owner', 'p_sup'],
  deliverables: ['Relatório consolidado', 'Trilha de evidência'],
  frequency: 'Mensal',
  sla: '2 dias úteis',
  indicators: [
    { id: 'ind_1', name: 'Prazo de fechamento', target: 2, current: 2, unit: 'dias' },
    { id: 'ind_2', name: 'Exceções por ciclo', target: 0, current: 1, unit: 'exceções' },
  ],
  completionCriteria: ['Aprovação registrada', 'Evidência completa das cinco etapas'],
  ownerId: 'p_owner',
  businessOwnerId: 'p_owner',
  technicalOwnerId: 'p_sup',
  supervisorId: 'p_sup',
  approverIds: ['p_apr'],
  substituteIds: [],
  triggers: ['Agendamento no 1º dia útil'],
  contextSourceIds: ['ctx_erp'],
  integrationIds: ['int_erp'],
  steps: OP_STEPS,
  actions: [
    { id: 'act_read', name: 'Ler registros do ERP', authorityLevel: 'observe', destructive: false },
    {
      id: 'act_deliver',
      name: 'Publicar relatório',
      authorityLevel: 'execute_with_approval',
      destructive: false,
    },
  ],
  approvalChain: ['p_apr'],
  operationalLimits: [
    { id: 'lim_1', kind: 'cost', label: 'Teto de custo por ciclo', value: 500, unit: 'R$' },
  ],
  budget: 5000,
  workUnits: 23,
  evidencePolicy: 'Evidência por etapa, retida por 5 anos.',
  retentionPolicy: '5 anos',
  notificationRules: ['Alertar responsável ao concluir', 'Alertar aprovador ao reter'],
  environment: 'production',
  version: '1.0',
  status: 'running',
  publishedAt: T1,
  createdAt: T0,
  updatedAt: T2,
};

const draftOperation: Operation = {
  ...structuredClone(publishedOperation),
  id: 'op_conciliacao',
  name: 'Conciliação de recebíveis',
  criticality: 'moderate',
  tags: ['conciliação'],
  status: 'draft',
  version: '0.1',
  environment: null,
  publishedAt: null,
  workUnits: 12,
};

const DEPLOY_STEP_DEFS: Array<[string, string, string]> = [
  ['Criar organização', 'Registrar o grupo e o primeiro CNPJ.', 'Organização e empresa criadas.'],
  ['Definir unidades e áreas', 'Estruturar unidades por região e áreas operacionais.', 'Hierarquia definida.'],
  ['Convidar administradores', 'Convidar administrador corporativo e de segurança.', 'Administradores ativos.'],
  ['Configurar papéis', 'Revisar os oito perfis e atribuições.', 'Papéis atribuídos.'],
  ['Publicar política corporativa', 'Aprovar e publicar a política do grupo.', 'Política publicada.'],
  ['Conectar integrações', 'Conectar e testar as fontes autorizadas.', 'Integrações testadas.'],
  ['Adicionar fontes de contexto', 'Registrar as fontes de contexto versionadas.', 'Contexto disponível.'],
  ['Definir orçamento', 'Contratar Work Units e alocar por centro de custo.', 'Orçamento configurado.'],
  ['Configurar limites operacionais', 'Estabelecer tetos de custo, volume e janela.', 'Limites ativos.'],
  ['Configurar evidência', 'Definir política de evidência e retenção.', 'Evidência configurada.'],
  ['Criar primeira operação', 'Publicar a operação piloto pelo wizard.', 'Operação publicada.'],
  ['Executar em sandbox', 'Rodar execução de teste percorrendo as etapas.', 'Execução de teste concluída.'],
  ['Revisar riscos', 'Avaliar a matriz de risco por ação.', 'Riscos revisados.'],
  ['Configurar notificações', 'Definir regras de notificação por evento.', 'Notificações ativas.'],
  ['Promover a produção', 'Promover a operação de sandbox a produção.', 'Ambiente promovido.'],
  ['Validar auditoria', 'Confirmar trilha de auditoria completa.', 'Auditoria validada.'],
];

function buildDeployment(): Deployment {
  const owners: Array<[string, string]> = [
    ['p_admin', 'Helena Vasques'],
    ['p_admin', 'Helena Vasques'],
    ['p_admin', 'Helena Vasques'],
    ['p_sec', 'André Ferreira'],
    ['p_sec', 'André Ferreira'],
    ['p_sec', 'André Ferreira'],
    ['p_owner', 'Marina Costa'],
    ['p_fin', 'Rafael Duarte'],
    ['p_fin', 'Rafael Duarte'],
    ['p_sec', 'André Ferreira'],
    ['p_owner', 'Marina Costa'],
    ['p_owner', 'Marina Costa'],
    ['p_sec', 'André Ferreira'],
    ['p_owner', 'Marina Costa'],
    ['p_admin', 'Helena Vasques'],
    ['p_aud', 'Paulo Mendes'],
  ];
  const steps: DeploymentStep[] = DEPLOY_STEP_DEFS.map((def, i) => ({
    id: `dep_step_${i + 1}`,
    order: i + 1,
    name: def[0],
    description: def[1],
    ownerId: owners[i][0],
    ownerName: owners[i][1],
    help: `Ajuda contextual: ${def[1]}`,
    expectedResult: def[2],
    done: false,
  }));
  return {
    id: 'deploy_1',
    organizationId: ORG,
    name: 'Implantação corporativa — Arden.AS',
    steps,
    completed: false,
  };
}

export function buildSeed(): DomainSnapshot {
  return {
    organizations: [
      { id: ORG, name: 'Arden.AS Grupo', companyIds: [CO, CO2] },
      { id: ORG2, name: 'Horizonte Holdings', companyIds: [] },
    ],
    companies: [
      { id: CO, organizationId: ORG, name: 'Arden.AS Brasil', cnpj: '12.345.678/0001-90' },
      { id: CO2, organizationId: ORG, name: 'Arden.AS Portugal', cnpj: '98.765.432/0001-10' },
    ],
    units: [{ id: UNIT, organizationId: ORG, companyId: CO, name: 'Sudeste', region: 'BR-SE' }],
    areas: [{ id: AREA, organizationId: ORG, companyId: CO, unitId: UNIT, name: 'Operações' }],
    teams: [
      { id: 'team_1', areaId: AREA, name: 'Fechamento', managerId: 'p_sup', approverIds: ['p_apr'] },
    ],
    costCenters: [{ id: CC, areaId: AREA, name: 'Operações — CC 01', code: 'OP-01' }],
    people: PEOPLE,
    roles: [
      { id: 'r1', key: 'corporate_admin', name: 'Administrador corporativo' },
      { id: 'r2', key: 'financial_admin', name: 'Administrador financeiro' },
      { id: 'r3', key: 'operation_owner', name: 'Proprietário da operação' },
      { id: 'r4', key: 'supervisor', name: 'Supervisor' },
      { id: 'r5', key: 'approver', name: 'Aprovador' },
      { id: 'r6', key: 'security_admin', name: 'Administrador de segurança' },
      { id: 'r7', key: 'analyst', name: 'Analista' },
      { id: 'r8', key: 'auditor', name: 'Auditor' },
    ],
    operations: [publishedOperation, draftOperation],
    executions: [
      {
        id: 'exec_1',
        organizationId: ORG,
        operationId: 'op_fechamento',
        operationVersion: '1.0',
        test: false,
        state: 'completed',
        steps: OP_STEPS.map((s) => ({
          stepId: s.id,
          stepName: s.name,
          state: 'completed',
          evidenceId: `ev_${s.id}`,
          workUnitsUsed: s.workUnitCost,
          startedAt: T2,
          finishedAt: T2,
        })),
        workUnitsUsed: 22,
        budgetDebited: 440,
        startedAt: T2,
        finishedAt: T2,
      },
    ],
    approvals: [
      {
        id: 'apr_1',
        organizationId: ORG,
        operationId: 'op_fechamento',
        executionId: 'exec_1',
        stepId: 'step_4',
        state: 'pending',
        requestedAt: T2,
        approverIds: ['p_apr'],
      },
    ],
    exceptions: [
      {
        id: 'exc_1',
        organizationId: ORG,
        operationId: 'op_fechamento',
        state: 'open',
        reason: 'Fonte de contexto retornou registros fora do período.',
        openedAt: T2,
      },
    ],
    evidence: OP_STEPS.map((s) => ({
      id: `ev_${s.id}`,
      organizationId: ORG,
      type: 'result',
      label: `Evidência — ${s.name}`,
      operationId: 'op_fechamento',
      executionId: 'exec_1',
      createdAt: T2,
    })),
    policies: [
      {
        id: 'pol_corp',
        organizationId: ORG,
        level: 'corporate',
        name: 'Política corporativa de dados',
        state: 'published',
      },
      {
        id: 'pol_area',
        organizationId: ORG,
        companyId: CO,
        areaId: AREA,
        level: 'area',
        name: 'Regra da área de Operações',
        state: 'draft',
      },
    ],
    risks: [
      {
        id: 'risk_1',
        organizationId: ORG,
        operationId: 'op_fechamento',
        actionId: 'act_read',
        actionName: 'Ler registros do ERP',
        dataAccessed: 'Registros financeiros do período',
        integrationId: 'int_erp',
        consequence: 'Exposição de dados financeiros a destinatário não autorizado.',
        reversibility: 'reversible',
        exposure: 'Interna, área de Operações',
        impact: 'moderate',
        authorityLevel: 'observe',
        approvalRequired: false,
        ownerId: 'p_owner',
        mitigation: 'Leitura restrita à fonte autorizada e mascaramento de PII.',
      },
      {
        id: 'risk_2',
        organizationId: ORG,
        operationId: 'op_fechamento',
        actionId: 'act_deliver',
        actionName: 'Publicar relatório',
        dataAccessed: 'Relatório consolidado',
        consequence: 'Entrega de resultado incorreto aos destinatários.',
        reversibility: 'partial',
        exposure: 'Destinatários internos',
        impact: 'elevated',
        authorityLevel: 'execute_with_approval',
        approvalRequired: true,
        ownerId: 'p_owner',
        mitigation: 'Retenção para decisão humana antes da entrega.',
      },
    ],
    integrations: [
      {
        id: 'int_erp',
        organizationId: ORG,
        name: 'ERP Financeiro',
        kind: 'erp',
        status: 'connected',
        lastTestedAt: T1,
      },
      { id: 'int_crm', organizationId: ORG, name: 'CRM', kind: 'crm', status: 'disconnected' },
    ],
    contextSources: [
      { id: 'ctx_erp', organizationId: ORG, name: 'Base ERP', kind: 'database', version: 3 },
    ],
    files: [
      {
        id: 'file_critico',
        organizationId: ORG,
        name: 'fechamento-2026-02.xlsx',
        repository: 'Operações / Fechamento',
        sizeBytes: 2_400_000,
        ageDays: 40,
        criterion: 'Vinculado a operação ativa',
        linkedOperationId: 'op_fechamento',
        critical: true,
        state: 'active',
        deletionApprovers: [],
      },
      {
        id: 'file_antigo',
        organizationId: ORG,
        name: 'rascunho-antigo.csv',
        repository: 'Operações / Rascunhos',
        sizeBytes: 120_000,
        ageDays: 210,
        criterion: 'Idade acima de 180 dias, sem vínculo',
        critical: false,
        state: 'active',
        deletionApprovers: [],
      },
    ],
    workUnits: [
      {
        id: 'wu_1',
        organizationId: ORG,
        areaId: AREA,
        contracted: 1000,
        used: 640,
        reserved: 80,
        projected: 900,
        available: 280,
        overage: 0,
      },
    ],
    budgets: [
      { id: 'bud_1', organizationId: ORG, areaId: AREA, costCenterId: CC, total: 20000, spent: 12800 },
    ],
    workUnitRequests: [],
    auditEvents: [
      {
        id: 'aud_1',
        timestamp: T1,
        actorId: 'p_owner',
        actorRole: 'operation_owner',
        organizationId: ORG,
        action: 'operation.publish',
        objectType: 'Operation',
        objectId: 'op_fechamento',
        previousValue: { status: 'draft' },
        newValue: { status: 'running', version: '1.0' },
        justification: 'Operação piloto aprovada.',
        relatedOperationId: 'op_fechamento',
        result: 'success',
      },
    ],
    deployments: [buildDeployment()],
    notifications: [
      {
        id: 'ntf_1',
        organizationId: ORG,
        title: 'Aprovação pendente',
        body: 'O fechamento operacional aguarda decisão na etapa de retenção.',
        read: false,
        createdAt: T2,
      },
    ],
  };
}
