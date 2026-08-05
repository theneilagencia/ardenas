/**
 * Arden.AS — editor de versão de agente (ARDEN-BE-007.7 §17–27).
 *
 * Editor SECIONADO. Rascunho editável; versão PUBLICADA é imutável (somente
 * leitura, sem PATCH, CTA "criar nova versão"). Concorrência via `expectedRevision`.
 * NADA é persistido no browser além do rascunho em memória. Instruções/schemas
 * nunca contêm segredo. Custo em unidade menor (inteiro), sem float. O content hash
 * é selado pelo servidor na publicação. Nenhuma execução de modelo/prompt aqui.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
  AGENT_COST_POLICY_SAFE_DEFAULT,
  ANTHROPIC_PROVIDER_KEY,
  type AgentVersionDefinition,
} from '@/contracts';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermission } from '@/hooks/use-session';
import {
  useAgent,
  useAgentVersion,
  useCreateAgentVersion,
  useModelConfigurations,
  usePublishAgentVersion,
  useRetireAgentVersion,
  useUpdateAgentVersion,
} from '@/hooks/use-agents';
import { ArdenRepositoryError } from '@/services/errors';
import { AgentVersionStatusBadge } from './AgentStatusBadge';
import { toMinorUnits, fromMinorUnits } from './agent-format';

type SectionKey = 'overview' | 'instructions' | 'io' | 'context' | 'execution' | 'tools' | 'evaluation' | 'cost' | 'review';
const SECTIONS: SectionKey[] = ['overview', 'instructions', 'io', 'context', 'execution', 'tools', 'evaluation', 'cost', 'review'];

function emptyDefinition(modelConfigurationId: string): AgentVersionDefinition {
  return {
    objective: '',
    systemInstructions: '',
    modelConfigurationId,
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: { type: 'object', properties: {}, required: [] },
    contextPolicy: AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
    executionPolicy: AGENT_EXECUTION_POLICY_SLICE_DEFAULT as AgentVersionDefinition['executionPolicy'],
    toolPolicy: AGENT_TOOL_POLICY_SAFE_DEFAULT as AgentVersionDefinition['toolPolicy'],
    evaluationPolicy: AGENT_EVALUATION_POLICY_SAFE_DEFAULT as AgentVersionDefinition['evaluationPolicy'],
    costPolicy: AGENT_COST_POLICY_SAFE_DEFAULT as AgentVersionDefinition['costPolicy'],
  };
}

export function AgentVersionEditorPage() {
  const { t } = useTranslation();
  const { agentId, agentVersionId } = useParams<{ agentId: string; agentVersionId?: string }>();
  const navigate = useNavigate();
  const can = usePermission();
  const creating = !agentVersionId;

  const { agent } = useAgent(agentId);
  const { version, isLoading } = useAgentVersion(agentId, agentVersionId);
  const { configurations } = useModelConfigurations({ status: 'ACTIVE' });
  // Lista sem filtro para detectar o provider da configuração selecionada (§16).
  const { configurations: allConfigurations } = useModelConfigurations();
  const createVersion = useCreateAgentVersion();
  const updateVersion = useUpdateAgentVersion();
  const publish = usePublishAgentVersion();
  const retire = useRetireAgentVersion();

  const [section, setSection] = useState<SectionKey>('overview');
  const [def, setDef] = useState<AgentVersionDefinition>(() => emptyDefinition(''));
  const [inputSchemaText, setInputSchemaText] = useState('{}');
  const [outputSchemaText, setOutputSchemaText] = useState('{}');
  const [changeSummary, setChangeSummary] = useState('');
  const [costInput, setCostInput] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const readOnly = !creating && version != null && version.status !== 'DRAFT';
  const editable = !readOnly && (creating ? can('agent.edit') : can('agent.edit'));

  // §16: versão que referencia uma configuração Anthropic é validada OFFLINE — a
  // chamada real e o tool calling ao vivo não foram comprovados → publicação BLOQUEADA.
  const selectedConfig = useMemo(
    () => [...configurations, ...allConfigurations].find((c) => c.id === def.modelConfigurationId),
    [configurations, allConfigurations, def.modelConfigurationId],
  );
  const isAnthropicVersion = selectedConfig?.providerKey === ANTHROPIC_PROVIDER_KEY;

  // Semeia o editor a partir da versão carregada (edição/leitura).
  useEffect(() => {
    if (version) {
      setDef({
        objective: version.objective,
        systemInstructions: version.systemInstructions,
        modelConfigurationId: version.modelConfigurationId,
        inputSchema: version.inputSchema,
        outputSchema: version.outputSchema,
        contextPolicy: version.contextPolicy,
        executionPolicy: version.executionPolicy,
        toolPolicy: version.toolPolicy,
        evaluationPolicy: version.evaluationPolicy,
        costPolicy: version.costPolicy,
      });
      setInputSchemaText(JSON.stringify(version.inputSchema, null, 2));
      setOutputSchemaText(JSON.stringify(version.outputSchema, null, 2));
      setCostInput(fromMinorUnits(version.costPolicy.maximumEstimatedCostMinor ?? null));
    }
  }, [version]);

  const schemaError = useMemo(() => {
    for (const text of [inputSchemaText, outputSchemaText]) {
      try { JSON.parse(text); } catch { return true; }
    }
    return false;
  }, [inputSchemaText, outputSchemaText]);

  function patch<K extends keyof AgentVersionDefinition>(key: K, value: AgentVersionDefinition[K]) {
    setDef((d) => ({ ...d, [key]: value }));
  }

  function buildDefinition(): AgentVersionDefinition {
    return {
      ...def,
      inputSchema: JSON.parse(inputSchemaText),
      outputSchema: JSON.parse(outputSchemaText),
      costPolicy: { ...def.costPolicy, maximumEstimatedCostMinor: costInput.trim() === '' ? null : toMinorUnits(costInput) },
    };
  }

  async function saveDraft() {
    if (!agentId) return;
    setErr(null);
    try {
      const definition = buildDefinition();
      if (creating) {
        const created = await createVersion.mutateAsync({ agentId, body: { definition, changeSummary: changeSummary || undefined } });
        navigate(`/agents/${agentId}/versions/${created.id}`);
      } else if (version) {
        await updateVersion.mutateAsync({ agentId, agentVersionId: version.id, body: { definition, changeSummary: changeSummary || undefined, expectedRevision: version.revision } });
      }
    } catch (e) { setErr(mapErr(e, t)); }
  }

  async function doPublish() {
    if (!agentId || !version) return;
    setErr(null);
    // §16: publicação bloqueada para versões Anthropic (validado apenas offline).
    if (isAnthropicVersion) { setErr(t('agents.editor.anthropicPublishBlocked')); return; }
    if (!changeSummary.trim()) { setErr(t('agents.editor.changeSummary')); return; }
    try {
      await publish.mutateAsync({ agentId, agentVersionId: version.id, body: { expectedRevision: version.revision, changeSummary: changeSummary.trim() } });
    } catch (e) { setErr(mapErr(e, t)); }
  }

  async function doRetire() {
    if (!agentId || !version) return;
    if (!window.confirm(t('agents.confirm.retire'))) return;
    setErr(null);
    try {
      await retire.mutateAsync({ agentId, agentVersionId: version.id, body: { expectedRevision: version.revision } });
    } catch (e) { setErr(mapErr(e, t)); }
  }

  if (!creating && isLoading) return <div className="card"><div className="empty-state">{t('data.loading')}</div></div>;

  const busy = createVersion.isPending || updateVersion.isPending || publish.isPending || retire.isPending;

  return (
    <>
      <PageHeader
        title={`${agent?.name ?? t('agents.editor.title')}${version ? ` · #${version.versionNumber}` : ''}`}
        subtitle={t('agents.editor.title')}
        actions={<div className="row">{version && <AgentVersionStatusBadge status={version.status} />}</div>}
      />

      {/* §16: aviso de validação offline + bloqueio de publicação para Anthropic. */}
      {isAnthropicVersion && (
        <div className="card" role="alert" style={{ marginBottom: 'var(--sp-4)', borderColor: 'var(--st-waiting)' }}>
          <strong>{t('agents.editor.anthropicOfflineTitle')}</strong>
          <p style={{ color: 'var(--tx2)', marginTop: 6 }}>{t('agents.editor.anthropicOfflineWarning')}</p>
          <p style={{ color: 'var(--st-failed)', marginTop: 6 }}>{t('agents.editor.anthropicPublishBlocked')}</p>
        </div>
      )}

      {readOnly && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)', borderColor: 'var(--st-completed)' }}>
          <p>{t('agents.editor.publishedReadOnly')}</p>
          {can('agent.edit') && agent?.status !== 'REVOKED' && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate(`/agents/${agentId}/versions/new`)}>
              {t('agents.editor.createNewVersion')}
            </button>
          )}
          {version?.status === 'PUBLISHED' && can('agent.publish') && (
            <button type="button" className="btn btn-ghost" style={{ marginTop: 8, marginLeft: 8 }} disabled={busy} onClick={doRetire}>
              {t('agents.actions.retire')}
            </button>
          )}
        </div>
      )}

      <div className="row" role="tablist" aria-label={t('agents.editor.title')} style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {SECTIONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} className={`btn btn-sm${section === s ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setSection(s)}>
            {t(`agents.editor.sections.${s}`)}
          </button>
        ))}
      </div>

      <div className="card">
        {section === 'overview' && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            <Field label={t('agents.editor.objective')}>
              <textarea value={def.objective} onChange={(e) => patch('objective', e.target.value)} rows={2} maxLength={2000} disabled={readOnly} />
            </Field>
            <Field label={t('agents.config.provider')}>
              <select value={def.modelConfigurationId} onChange={(e) => patch('modelConfigurationId', e.target.value)} disabled={readOnly}>
                <option value="">—</option>
                {configurations.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.modelId}</option>)}
              </select>
            </Field>
            {version && (
              <p className="t-micro" style={{ color: 'var(--tx2)' }}>
                {t('agents.editor.contentHashNote')}
              </p>
            )}
          </div>
        )}

        {section === 'instructions' && (
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <p className="t-micro" style={{ color: 'var(--st-waiting)' }}>{t('agents.editor.instructionsWarning')}</p>
            <textarea value={def.systemInstructions} onChange={(e) => patch('systemInstructions', e.target.value)} rows={12} maxLength={20000} disabled={readOnly} aria-label={t('agents.editor.systemInstructions')} />
            <p className="t-micro" style={{ color: 'var(--tx2)' }}>{def.systemInstructions.length} / 20000 · {t('agents.editor.noSecret')}</p>
          </div>
        )}

        {section === 'io' && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            <Field label={t('agents.editor.inputSchema')}>
              <textarea className="mono" value={inputSchemaText} onChange={(e) => setInputSchemaText(e.target.value)} rows={8} disabled={readOnly} />
            </Field>
            <Field label={t('agents.editor.outputSchema')}>
              <textarea className="mono" value={outputSchemaText} onChange={(e) => setOutputSchemaText(e.target.value)} rows={8} disabled={readOnly} />
            </Field>
            {schemaError && <p role="alert" style={{ color: 'var(--st-failed)' }}>{t('agents.editor.invalidJson')}</p>}
          </div>
        )}

        {section === 'context' && <ContextSection def={def} patch={patch} readOnly={readOnly} />}
        {section === 'execution' && <ExecutionSection def={def} patch={patch} readOnly={readOnly} />}
        {section === 'tools' && <ToolSection def={def} patch={patch} readOnly={readOnly} />}
        {section === 'evaluation' && <EvaluationSection def={def} patch={patch} readOnly={readOnly} />}
        {section === 'cost' && <CostSection def={def} patch={patch} costInput={costInput} setCostInput={setCostInput} readOnly={readOnly} />}

        {section === 'review' && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            <p>{t('agents.editor.publishReview')}</p>
            <ReviewRow label={t('agents.editor.objective')} value={def.objective || '—'} />
            <ReviewRow label={t('agents.config.title')} value={configurations.find((c) => c.id === def.modelConfigurationId)?.name ?? '—'} />
            <ReviewRow label={t('agents.execution.toolCallingAllowed')} value={def.executionPolicy.toolCallingAllowed ? '✓' : '—'} />
            <ReviewRow label={t('agents.cost.title')} value={costInput ? costInput : t('agents.cost.unavailable')} />
            {!readOnly && (
              <Field label={t('agents.editor.changeSummary')}>
                <input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} maxLength={1000} />
              </Field>
            )}
          </div>
        )}
      </div>

      {err && <p role="alert" style={{ color: 'var(--st-failed)', marginTop: 'var(--sp-3)' }}>{err}</p>}

      {!readOnly && editable && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-4)' }}>
          <button type="button" className="btn btn-ghost" disabled={busy || schemaError} onClick={saveDraft}>{t('agents.editor.saveDraft')}</button>
          {!creating && version?.status === 'DRAFT' && can('agent.publish') && (
            <button type="button" className="btn btn-primary" disabled={busy || schemaError || isAnthropicVersion} title={isAnthropicVersion ? t('agents.editor.anthropicPublishBlocked') : undefined} onClick={doPublish}>{t('agents.actions.publish')}</button>
          )}
        </div>
      )}
    </>
  );
}

function mapErr(e: unknown, t: (k: string) => string): string {
  if (e instanceof ArdenRepositoryError) return e.code === 'CONFLICT' ? t('data.conflict') : e.message;
  return t('data.error');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="t-micro">{label}</span>
      {children}
    </label>
  );
}
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--bd)', paddingBottom: 6 }}>
      <span className="t-micro">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type SectionProps = { def: AgentVersionDefinition; patch: <K extends keyof AgentVersionDefinition>(k: K, v: AgentVersionDefinition[K]) => void; readOnly: boolean };

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label className="row" style={{ gap: 8, alignItems: 'center' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}
function Num({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="t-micro">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
    </label>
  );
}

function ContextSection({ def, patch, readOnly }: SectionProps) {
  const { t } = useTranslation();
  const c = def.contextPolicy;
  const set = (v: Partial<typeof c>) => patch('contextPolicy', { ...c, ...v });
  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <Check label={t('agents.context.includeExecutionInput')} checked={c.includeExecutionInput} onChange={(v) => set({ includeExecutionInput: v })} disabled={readOnly} />
      <Check label={t('agents.context.includeOperationMetadata')} checked={c.includeOperationMetadata} onChange={(v) => set({ includeOperationMetadata: v })} disabled={readOnly} />
      <Check label={t('agents.context.previousStepOutputs')} checked={c.previousStepOutputs.enabled} onChange={(v) => set({ previousStepOutputs: { ...c.previousStepOutputs, enabled: v } })} disabled={readOnly} />
      <Check label={t('agents.context.toolResults')} checked={c.toolResults.enabled} onChange={(v) => set({ toolResults: { ...c.toolResults, enabled: v } })} disabled={readOnly} />
      <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.context.linkedDocumentsUnavailable')}</p>
      <div className="grid-tiles">
        <Num label={t('agents.context.maximumContextBytes')} value={c.maximumContextBytes} onChange={(v) => set({ maximumContextBytes: v })} disabled={readOnly} />
        <Num label={t('agents.context.maximumInputTokens')} value={c.maximumInputTokens} onChange={(v) => set({ maximumInputTokens: v })} disabled={readOnly} />
      </div>
      <Check label={t('agents.context.redactSensitiveFields')} checked={c.redactSensitiveFields} onChange={(v) => set({ redactSensitiveFields: v })} disabled={readOnly} />
    </div>
  );
}

function ExecutionSection({ def, patch, readOnly }: SectionProps) {
  const { t } = useTranslation();
  const e = def.executionPolicy;
  const set = (v: Partial<typeof e>) => patch('executionPolicy', { ...e, ...v });
  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <div className="grid-tiles">
        <Num label={t('agents.execution.maximumTurns')} value={e.maximumTurns} onChange={(v) => set({ maximumTurns: v })} disabled={readOnly} />
        <Num label={t('agents.execution.maximumToolCalls')} value={e.maximumToolCalls} onChange={(v) => set({ maximumToolCalls: v })} disabled={readOnly || !e.toolCallingAllowed} />
        <Num label={t('agents.execution.maximumDurationMs')} value={e.maximumDurationMs} onChange={(v) => set({ maximumDurationMs: v })} disabled={readOnly} />
        <Num label={t('agents.execution.maximumInputTokens')} value={e.maximumInputTokens} onChange={(v) => set({ maximumInputTokens: v })} disabled={readOnly} />
        <Num label={t('agents.execution.maximumOutputTokens')} value={e.maximumOutputTokens} onChange={(v) => set({ maximumOutputTokens: v })} disabled={readOnly} />
        <Num label={t('agents.execution.maximumOutputRepairAttempts')} value={e.maximumOutputRepairAttempts} onChange={(v) => set({ maximumOutputRepairAttempts: v })} disabled={readOnly} />
      </div>
      <Check label={t('agents.execution.structuredOutputRequired')} checked={e.structuredOutputRequired} onChange={(v) => set({ structuredOutputRequired: v })} disabled={readOnly} />
      <Check label={t('agents.execution.toolCallingAllowed')} checked={e.toolCallingAllowed} onChange={(v) => set({ toolCallingAllowed: v, maximumToolCalls: v ? e.maximumToolCalls : 0 })} disabled={readOnly} />
      {!e.toolCallingAllowed && <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.execution.toolCallingOffZero')}</p>}
      <Check label={t('agents.execution.retryInvalidOutput')} checked={e.retryInvalidOutput} onChange={(v) => set({ retryInvalidOutput: v })} disabled={readOnly} />
    </div>
  );
}

function ToolSection({ def, patch, readOnly }: SectionProps) {
  const { t } = useTranslation();
  const p = def.toolPolicy;
  const set = (v: Partial<typeof p>) => patch('toolPolicy', { ...p, ...v });
  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.tools.operationHint')}</p>
      <Check label={t('agents.tools.allowRead')} checked={p.allowRead} onChange={(v) => set({ allowRead: v })} disabled={readOnly} />
      <Check label={t('agents.tools.allowWrite')} checked={p.allowWrite} onChange={(v) => set({ allowWrite: v })} disabled={readOnly} />
      <Check label={t('agents.tools.allowDestructive')} checked={p.allowDestructive} onChange={(v) => set({ allowDestructive: v })} disabled={readOnly} />
      <Check label={t('agents.tools.allowFinancial')} checked={p.allowFinancial} onChange={(v) => set({ allowFinancial: v })} disabled={readOnly} />
      <Check label={t('agents.tools.allowSecurityCritical')} checked={p.allowSecurityCritical} onChange={(v) => set({ allowSecurityCritical: v })} disabled={readOnly} />
      <p className="t-micro" style={{ color: 'var(--st-waiting)' }}>{t('agents.tools.criticalWarning')}</p>
    </div>
  );
}

function EvaluationSection({ def, patch, readOnly }: SectionProps) {
  const { t } = useTranslation();
  const p = def.evaluationPolicy;
  const set = (v: Partial<typeof p>) => patch('evaluationPolicy', { ...p, ...v });
  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <Check label={t('agents.evaluation.requireValidOutputSchema')} checked={p.requireValidOutputSchema} onChange={(v) => set({ requireValidOutputSchema: v })} disabled={readOnly} />
      <Check label={t('agents.evaluation.requireCompletionCriteria')} checked={p.requireCompletionCriteria} onChange={(v) => set({ requireCompletionCriteria: v })} disabled={readOnly} />
      <Check label={t('agents.evaluation.requireEvidenceReferences')} checked={p.requireEvidenceReferences} onChange={(v) => set({ requireEvidenceReferences: v })} disabled={readOnly} />
      <div className="row" style={{ gap: 8, alignItems: 'center', opacity: 0.6 }}>
        <input type="checkbox" checked={false} disabled aria-label={t('agents.evaluation.llmJudge')} />
        <span>{t('agents.evaluation.llmJudge')}</span>
      </div>
      <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.evaluation.llmJudgeUnsupported')}</p>
    </div>
  );
}

function CostSection({ def, patch, costInput, setCostInput, readOnly }: SectionProps & { costInput: string; setCostInput: (v: string) => void }) {
  const { t } = useTranslation();
  const p = def.costPolicy;
  const set = (v: Partial<typeof p>) => patch('costPolicy', { ...p, ...v });
  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <div className="grid-tiles">
        <Field label={`${t('agents.cost.maximumEstimatedCostMinor')} (${p.currency})`}>
          <input inputMode="decimal" value={costInput} onChange={(e) => setCostInput(e.target.value)} placeholder="—" disabled={readOnly} />
        </Field>
        <Field label={t('agents.cost.currency')}>
          <input value={p.currency ?? ''} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} maxLength={3} disabled={readOnly} />
        </Field>
        <Num label={t('agents.cost.maximumInputTokens')} value={p.maximumInputTokens} onChange={(v) => set({ maximumInputTokens: v })} disabled={readOnly} />
        <Num label={t('agents.cost.maximumOutputTokens')} value={p.maximumOutputTokens} onChange={(v) => set({ maximumOutputTokens: v })} disabled={readOnly} />
        <Num label={t('agents.cost.maximumToolCalls')} value={p.maximumToolCalls} onChange={(v) => set({ maximumToolCalls: v })} disabled={readOnly} />
      </div>
      <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.cost.estimatedNote')}</p>
      <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('agents.cost.unavailableNote')}</p>
    </div>
  );
}
