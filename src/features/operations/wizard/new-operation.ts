import type { Operation } from '@/domain/types';
import { now } from '@/lib/id';

export const DRAFT_ID = 'op_new_draft';

/** As 20 etapas do wizard, na ordem. A etapa 19 (índice 18) lista bloqueadores. */
export const WIZARD_STEPS = [
  'identity',
  'classification',
  'problem',
  'objective',
  'expectedResult',
  'recipients',
  'deliverables',
  'frequency',
  'indicators',
  'completion',
  'owners',
  'triggers',
  'context',
  'integrations',
  'steps',
  'actions',
  'approval',
  'limits',
  'review',
  'publish',
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number];

export function emptyOperation(organizationId: string, companyId: string): Operation {
  return {
    id: DRAFT_ID,
    name: '',
    organizationId,
    companyId,
    unitId: '',
    areaId: '',
    costCenterId: '',
    criticality: 'moderate',
    tags: [],
    problem: '',
    objective: '',
    expectedResult: '',
    recipients: [],
    deliverables: [],
    frequency: '',
    sla: '',
    indicators: [],
    completionCriteria: [],
    ownerId: '',
    approverIds: [],
    substituteIds: [],
    triggers: [],
    contextSourceIds: [],
    integrationIds: [],
    steps: [],
    actions: [],
    approvalChain: [],
    operationalLimits: [],
    budget: 0,
    workUnits: 0,
    evidencePolicy: '',
    retentionPolicy: '',
    notificationRules: [],
    environment: null,
    version: '0.1',
    status: 'draft',
    publishedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
}
