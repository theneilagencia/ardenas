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

let riSeq = 0;
let amSeq = 0;

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

function pol(
  id: string,
  name: string,
  level: import('./types').PolicyLevel,
  scopeLabel: string,
  ownerName: string,
  version: string,
  state: import('./types').PolicyState,
  opsCount: number,
  updatedAt: string,
): import('./types').Policy {
  return { id, organizationId: ORG, level, name, state, scopeLabel, ownerName, version, opsCount, updatedAt };
}

export function buildSeed(): DomainSnapshot {
  return {
    organizations: [
      { id: ORG, name: 'Grupo Atlas', companyIds: [CO, CO2] },
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
        title: 'Enviar relatório comercial à diretoria',
        operationLabel: 'Revisão comercial semanal · execução #2841',
        category: 'Envio externo',
        criticality: 'moderate',
        proposedAction: 'Enviar e-mail com dois anexos para o grupo Diretoria',
        recipients: '5 contatos autorizados · domínio corporativo',
        authorityLevel: 'execute_with_approval',
        requestedBy: 'Arden.AS · hoje 07:31',
        due: 'Hoje 12:00',
        impact: 'Comunicação externa ao time da operação, reversível apenas por retratação',
        content:
          'Prezados,\n\nSegue a revisão comercial da semana 30, com três desvios materiais identificados na unidade Mineração e o plano de acompanhamento sugerido.\n\nO detalhamento por conta está no relatório em anexo.',
        evidenceLabels: [
          'Relatório executivo semana 30 · PDF 9 páginas',
          'Índice de fontes · 1.284 registros consultados',
          'Modelo de e-mail aprovado em 14 mai',
        ],
      },
      {
        id: 'apr_2',
        organizationId: ORG,
        operationId: 'op_fechamento',
        state: 'pending',
        requestedAt: T2,
        approverIds: ['p_apr'],
        title: 'Cobrança de três contas em atraso',
        operationLabel: 'Acompanhamento de contas a receber',
        category: 'Envio externo',
        criticality: 'elevated',
        proposedAction: 'Enviar cobrança a três clientes com faturas vencidas',
        recipients: '3 contatos externos autorizados',
        authorityLevel: 'execute_with_approval',
        requestedBy: 'Arden.AS · hoje 09:10',
        due: 'Hoje 18:00',
        impact: 'Comunicação externa a clientes, reversível apenas por retratação',
        evidenceLabels: ['Extrato de contas a receber · 3 faturas'],
      },
      {
        id: 'apr_3',
        organizationId: ORG,
        operationId: 'op_fechamento',
        state: 'pending',
        requestedAt: T2,
        approverIds: ['p_fin'],
        title: 'Capacidade adicional de 60 Work Units',
        operationLabel: 'Fechamento financeiro mensal',
        category: 'Orçamento',
        criticality: 'moderate',
        proposedAction: 'Liberar 60 Work Units de excedente para concluir o ciclo',
        authorityLevel: 'execute_with_approval',
        requestedBy: 'Arden.AS · ontem 16:40',
        due: 'Amanhã 10:00',
        impact: 'Consumo acima do contratado no período, com débito no orçamento da área',
      },
      {
        id: 'apr_4',
        organizationId: ORG,
        operationId: 'op_conciliacao',
        state: 'pending',
        requestedAt: T2,
        approverIds: ['p_sec'],
        title: 'Mover 148 arquivos para quarentena',
        operationLabel: 'Gestão de exceções logísticas',
        category: 'Arquivos',
        criticality: 'moderate',
        proposedAction: 'Mover 148 arquivos inativos para quarentena com recuperação em 30 dias',
        authorityLevel: 'execute_with_approval',
        requestedBy: 'Arden.AS · hoje 11:05',
        due: 'Sexta 17:00',
        impact: 'Reversível em 30 dias; exclusão definitiva exige dois aprovadores',
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
      pol('pol_comm', 'Comunicação externa', 'corporate', 'Corporativa', 'Marina Costa', 'v4.2', 'published', 6, '12/06/2026'),
      pol('pol_pii', 'Dados pessoais', 'corporate', 'Corporativa', 'Diego Faria', 'v2.3', 'published', 9, '28/06/2026'),
      pol('pol_del', 'Exclusão de arquivos', 'corporate', 'Corporativa', 'Diego Faria', 'v1.6', 'published', 3, '15/05/2026'),
      pol('pol_fin', 'Ações financeiras', 'company', 'Empresa: Indústria', 'Helena Ribeiro', 'v3.0', 'published', 4, '03/05/2026'),
      pol('pol_src', 'Fontes autorizadas', 'corporate', 'Corporativa', 'Marina Costa', 'v2.1', 'published', 12, '22/05/2026'),
      pol('pol_sched', 'Horários de execução', 'area', 'Área: Atendimento', 'Patrícia Lemos', 'v1.2', 'submitted', 2, '24/07/2026'),
      pol('pol_cons', 'Consumo por operação', 'corporate', 'Corporativa', 'Helena Ribeiro', 'v1.9', 'published', 12, '18/07/2026'),
      pol('pol_pub', 'Publicação externa', 'corporate', 'Corporativa', 'Marina Costa', 'v1.0', 'draft', 0, '26/07/2026'),
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
    resultIndicators: RESULT_INDICATORS,
    authorityMatrix: AUTHORITY_MATRIX,
    assessments: ASSESSMENTS,
  };
}

// ── Resultados: portfólio de indicadores (do mockup) ──────────────────────────
const RESULT_INDICATORS: import('./types').ResultIndicator[] = [
  ri('Tempo de ciclo', 'measured', '3h 42m', '-59%', '9h 10m'),
  ri('Custo por ciclo', 'estimated', 'R$ 118', '-71%', 'R$ 402'),
  ri('Volume de execuções', 'measured', '312', '+16%', '268'),
  ri('Taxa de conclusão', 'measured', '94,2%', '+4,5 p.p.', '89,7%'),
  ri('Retrabalho', 'measured', '5,4%', '-6,4 p.p.', '11,8%'),
  ri('SLA cumprido', 'measured', '96,1%', '+4,7 p.p.', '91,4%'),
  ri('Exceções tratadas', 'measured', '38', '-27%', '52'),
  ri('Intervenções humanas', 'measured', '1,8 por ciclo', '-58%', '4,3 por ciclo'),
  ri('Capacidade adicionada', 'estimated', '412 horas', '+75%', '236 horas'),
  ri('Economia potencial', 'estimated', 'R$ 74.100', '+79%', 'R$ 41.300'),
  ri('Receita influenciada', 'client_reported', 'R$ 210.000', '+25%', 'R$ 168.000'),
  ri('Previsibilidade de prazo', 'measured', '±22 min', '-78%', '±1h 40m'),
  ri('Qualidade aprovada sem ajuste', 'validated', '88,5%', '—', 'Não disponível'),
  ri('Impacto em contratos renovados', 'unavailable', 'Não disponível', '—', 'Não disponível'),
];

function ri(
  name: string,
  method: import('./types').ResultMethod,
  value: string,
  delta: string,
  before: string,
): import('./types').ResultIndicator {
  return { id: `ri_${++riSeq}`, organizationId: ORG, name, method, value, delta, before };
}

// ── Matriz de Gradientes de Autoridade (do mockup) ────────────────────────────
const AUTHORITY_MATRIX: import('./types').AuthorityMatrixRow[] = [
  am('Consultar oportunidades', 'Salesforce', 'Unidade autorizada', true, 'low', 'observe'),
  am('Consolidar dados de vendas', 'Salesforce, ERP', 'Período fechado', true, 'low', 'prepare'),
  am('Preparar relatório executivo', 'Arden.AS', 'Modelo aprovado', true, 'low', 'prepare'),
  am('Atualizar estágio de oportunidade', 'Salesforce', 'Apenas oportunidades abertas', true, 'moderate', 'execute_under_rule'),
  am('Movimentar arquivo', 'SharePoint', 'Pasta autorizada', true, 'low', 'execute_under_rule'),
  am('Enviar comunicação interna', 'Microsoft 365', 'Modelo aprovado, destinatários internos', false, 'moderate', 'execute_under_rule'),
  am('Enviar proposta a cliente', 'Microsoft 365', 'Aprovação do diretor comercial', false, 'elevated', 'execute_with_approval'),
  am('Alterar registro contábil', 'ERP', 'Aprovação do diretor financeiro', false, 'elevated', 'execute_with_approval'),
  am('Mover arquivo para quarentena', 'SharePoint', 'Recuperação em 30 dias', true, 'moderate', 'execute_with_approval'),
  am('Excluir permanentemente', 'SharePoint', 'Dois aprovadores', false, 'critical', 'execute_with_approval'),
  am('Excluir contrato', 'Repositório jurídico', 'Ação não permitida', false, 'critical', 'blocked'),
  am('Executar pagamento', 'ERP', 'Ação não permitida', false, 'critical', 'blocked'),
];

function am(
  action: string,
  system: string,
  condition: string,
  reversible: boolean,
  risk: import('./types').RiskLevel,
  authorityLevel: import('./types').AuthorityLevel,
): import('./types').AuthorityMatrixRow {
  return { id: `am_${++amSeq}`, organizationId: ORG, action, system, condition, reversible, risk, authorityLevel };
}

// ── Assessments (Autonomous Work Assessment, do mockup) ───────────────────────
const ASSESSMENTS: import('./types').Assessment[] = [
  {
    id: 'asm_1',
    organizationId: ORG,
    operationName: 'Fechamento financeiro mensal',
    discipline: 'Financeiro',
    date: '26 jul',
    company: 'Atlas Serviços Financeiros',
    responsibleId: 'p_fin',
    responsibleName: 'Rafael Lima',
    stage: 'completed',
    recommendation: 'Candidata com ajustes',
    execScore: 68,
    workUnitsRange: '16 a 20',
  },
  {
    id: 'asm_2',
    organizationId: ORG,
    operationName: 'Triagem de incidentes',
    discipline: 'Tecnologia',
    date: '28 jul',
    company: 'Grupo Atlas',
    responsibleId: 'p_sup',
    responsibleName: 'Bruno Almeida',
    stage: 'analyzing',
    recommendation: 'Forte candidata',
    execScore: 86,
    workUnitsRange: '6 a 8',
  },
  {
    id: 'asm_3',
    organizationId: ORG,
    operationName: 'Consolidação de avaliação de desempenho',
    discipline: 'Pessoas',
    date: '24 jul',
    company: 'Grupo Atlas',
    responsibleId: 'p_owner',
    responsibleName: 'Marina Costa',
    stage: 'awaiting_info',
    recommendation: 'Exige clareza institucional',
    execScore: 34,
    workUnitsRange: '12 a 16',
  },
];
