import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAppStore } from '@/store/app-store';
import { useScopedData } from '@/hooks/use-session';
import {
  useCreateOperation,
  useCreateOperationVersion,
  useOperation,
  usePublishOperationVersion,
  useSaveOperationDraft,
} from '@/hooks/use-operations';
import { computeBlockers } from '@/domain/operation-blockers';
import type { Environment, Operation } from '@/domain/types';
import { newId } from '@/lib/id';
import { DRAFT_ID, WIZARD_STEPS, emptyOperation, type WizardStepKey } from './new-operation';

export function WizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { integrations, people } = useScopedData();
  const organizationId = useAppStore((s) => s.organizationId);
  const companyId = useAppStore((s) => s.session?.person.companyId ?? '');

  const draftQuery = useOperation(DRAFT_ID);
  const saveDraftMut = useSaveOperationDraft();
  const createMut = useCreateOperation();
  const createVersionMut = useCreateOperationVersion();
  const publishMut = usePublishOperationVersion();

  const [op, setOp] = useState<Operation>(() => emptyOperation(organizationId, companyId));
  const [current, setCurrent] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Retomável após recarga: hidrata do rascunho persistido no repositório, uma vez.
  useEffect(() => {
    if (!hydrated.current && draftQuery.operation) {
      setOp(structuredClone(draftQuery.operation));
      hydrated.current = true;
    }
  }, [draftQuery.operation]);

  const testedIntegrationIds = useMemo(
    () => new Set(integrations.filter((i) => i.status === 'connected').map((i) => i.id)),
    [integrations],
  );

  const blockers = useMemo(
    () => computeBlockers(op, { testedIntegrationIds }),
    [op, testedIntegrationIds],
  );
  const publishable = blockers.length === 0;

  const patch = (next: Partial<Operation>) => setOp((prev) => ({ ...prev, ...next }));

  const onSaveDraft = async () => {
    await saveDraftMut.mutateAsync(op);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const onPublish = async () => {
    if (!publishable) return;
    // Cria a operação a partir do formulário (id definitivo), então os comandos
    // explícitos de versão e publicação.
    const toCreate: Operation = { ...op, id: newId('op'), status: 'draft', version: '0.1' };
    const created = await createMut.mutateAsync(toCreate);
    await createVersionMut.mutateAsync(created.id);
    const published = await publishMut.mutateAsync(created.id);
    navigate(`/operations/${published.id}`);
  };

  const stepKey = WIZARD_STEPS[current];

  return (
    <>
      <PageHeader
        title={t('wizard.title')}
        subtitle={t('wizard.stepOf', { current: current + 1, total: WIZARD_STEPS.length })}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={onSaveDraft}>
              {t('common.saveDraft')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!publishable}
              onClick={onPublish}
              data-testid="wizard-publish"
            >
              {t('wizard.finish')}
            </button>
          </>
        }
      />

      {savedAt && (
        <p style={{ color: 'var(--st-completed)', marginBottom: 'var(--sp-3)' }}>
          {t('wizard.draftSaved')}
        </p>
      )}

      {/* Trilho superior clicável para revisar qualquer etapa */}
      <div
        className="row"
        style={{ gap: 6, marginBottom: 'var(--sp-5)', overflowX: 'auto', paddingBottom: 4 }}
        role="tablist"
        aria-label={t('wizard.title')}
      >
        {WIZARD_STEPS.map((key, i) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={i === current}
            className={`btn btn-sm${i === current ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setCurrent(i)}
            style={{ flex: 'none' }}
          >
            <span className="mono" style={{ marginRight: 6 }}>
              {i + 1}
            </span>
            {t(`wizard.steps.${key}`)}
          </button>
        ))}
      </div>

      <div className="card">
        <h2 className="t-section" style={{ marginBottom: 'var(--sp-4)' }}>
          {t(`wizard.steps.${stepKey}`)}
        </h2>
        <StepBody
          stepKey={stepKey}
          op={op}
          patch={patch}
          blockers={blockers}
          publishable={publishable}
          onGoTo={setCurrent}
          onPublish={onPublish}
          people={people}
          integrations={integrations}
        />
      </div>
    </>
  );
}

interface StepBodyProps {
  stepKey: WizardStepKey;
  op: Operation;
  patch: (next: Partial<Operation>) => void;
  blockers: ReturnType<typeof computeBlockers>;
  publishable: boolean;
  onGoTo: (index: number) => void;
  onPublish: () => void;
  people: { id: string; name: string }[];
  integrations: { id: string; name: string; status: string }[];
}

const BLOCKER_STEP: Record<string, number> = {
  owner_missing: 10,
  expected_result_missing: 4,
  environment_missing: 17,
  budget_missing: 17,
  evidence_missing: 17,
  integration_untested: 13,
  authority_incoherent: 15,
  approver_missing: 16,
};

function StepBody({
  stepKey,
  op,
  patch,
  blockers,
  publishable,
  onGoTo,
  onPublish,
  people,
  integrations,
}: StepBodyProps) {
  const { t } = useTranslation();

  switch (stepKey) {
    case 'identity':
      return (
        <div className="field">
          <label htmlFor="op-name">{t('wizard.field.name')}</label>
          <input
            id="op-name"
            value={op.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Fechamento operacional mensal"
          />
        </div>
      );

    case 'expectedResult':
      return (
        <div className="field">
          <label htmlFor="op-expected">{t('wizard.field.expectedResult')}</label>
          <textarea
            id="op-expected"
            rows={4}
            value={op.expectedResult}
            onChange={(e) => patch({ expectedResult: e.target.value })}
          />
        </div>
      );

    case 'owners':
      return (
        <div className="field">
          <label htmlFor="op-owner">{t('common.owner')}</label>
          <select
            id="op-owner"
            value={op.ownerId}
            onChange={(e) => patch({ ownerId: e.target.value })}
          >
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      );

    case 'integrations':
      return (
        <div className="stack">
          {integrations.map((i) => {
            const selected = op.integrationIds.includes(i.id);
            return (
              <label key={i.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {i.name}{' '}
                  <span className="chip" style={{ marginLeft: 6 }}>
                    {i.status}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) =>
                    patch({
                      integrationIds: e.target.checked
                        ? [...op.integrationIds, i.id]
                        : op.integrationIds.filter((x) => x !== i.id),
                    })
                  }
                />
              </label>
            );
          })}
        </div>
      );

    case 'actions':
      return (
        <div className="stack">
          <p style={{ color: 'var(--tx2)' }}>
            Ações destrutivas ou irreversíveis nunca abaixo de{' '}
            <code className="mono">execute_with_approval</code>.
          </p>
          <label className="row" style={{ justifyContent: 'space-between' }}>
            <span>Incluir ação destrutiva de exemplo</span>
            <input
              type="checkbox"
              checked={op.actions.length > 0}
              onChange={(e) =>
                patch({
                  actions: e.target.checked
                    ? [
                        {
                          id: 'act_demo',
                          name: 'Excluir registros',
                          authorityLevel: 'execute_under_rule',
                          destructive: true,
                        },
                      ]
                    : [],
                })
              }
            />
          </label>
          {op.actions.length > 0 && (
            <div className="field">
              <label htmlFor="act-auth">Autoridade da ação</label>
              <select
                id="act-auth"
                value={op.actions[0].authorityLevel}
                onChange={(e) =>
                  patch({
                    actions: [{ ...op.actions[0], authorityLevel: e.target.value as never }],
                  })
                }
              >
                <option value="execute_under_rule">execute_under_rule</option>
                <option value="execute_with_approval">execute_with_approval</option>
                <option value="blocked">blocked</option>
              </select>
            </div>
          )}
        </div>
      );

    case 'approval':
      return (
        <div className="field">
          <label htmlFor="op-approver">{t('wizard.field.approvers')}</label>
          <select
            id="op-approver"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v && !op.approverIds.includes(v))
                patch({ approverIds: [...op.approverIds, v] });
            }}
          >
            <option value="">{t('wizard.field.addApprover')}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="row" style={{ marginTop: 8 }}>
            {op.approverIds.map((id) => (
              <span key={id} className="chip">
                {people.find((p) => p.id === id)?.name ?? id}
              </span>
            ))}
          </div>
        </div>
      );

    case 'limits':
      return (
        <>
          <div className="field">
            <label htmlFor="op-env">{t('wizard.field.environment')}</label>
            <select
              id="op-env"
              value={op.environment ?? ''}
              onChange={(e) =>
                patch({ environment: (e.target.value || null) as Environment | null })
              }
            >
              <option value="">—</option>
              <option value="sandbox">sandbox</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="op-budget">{t('wizard.field.budget')}</label>
            <input
              id="op-budget"
              type="number"
              min={0}
              value={op.budget || ''}
              onChange={(e) => patch({ budget: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="op-evidence">{t('wizard.field.evidencePolicy')}</label>
            <input
              id="op-evidence"
              value={op.evidencePolicy}
              onChange={(e) => patch({ evidencePolicy: e.target.value })}
            />
          </div>
        </>
      );

    case 'review':
      return (
        <div className="stack">
          <h3 className="t-section">{t('wizard.blockersTitle')}</h3>
          {publishable ? (
            <p style={{ color: 'var(--st-completed)' }}>{t('wizard.publishReady')}</p>
          ) : (
            <>
              <p style={{ color: 'var(--st-failed)' }}>{t('wizard.publishBlocked')}</p>
              <ul className="stack" style={{ gap: 8, listStyle: 'none', padding: 0 }}>
                {blockers.map((b) => (
                  <li
                    key={b.code}
                    className="row"
                    style={{ justifyContent: 'space-between', border: '1px solid var(--bd)', borderRadius: 'var(--r-control)', padding: '8px 10px' }}
                  >
                    <span className="row">
                      <Lock size={14} aria-hidden style={{ color: 'var(--st-failed)' }} />
                      {t(b.messageKey)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => onGoTo(BLOCKER_STEP[b.code] ?? 0)}
                    >
                      {t('wizard.goToStep')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      );

    case 'publish':
      return (
        <div className="stack">
          {publishable ? (
            <p className="row" style={{ color: 'var(--st-completed)' }}>
              <Check size={16} aria-hidden /> {t('wizard.publishReady')}
            </p>
          ) : (
            <p style={{ color: 'var(--st-failed)' }}>{t('wizard.publishBlocked')}</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!publishable}
            onClick={onPublish}
          >
            {t('wizard.finish')}
          </button>
        </div>
      );

    default:
      return (
        <p style={{ color: 'var(--tx2)' }}>
          {t('placeholder.note')}
        </p>
      );
  }
}
