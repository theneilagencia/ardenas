/**
 * Arden.AS — conexões Anthropic seguras (ARDEN-BE-008.6 §7–§12).
 *
 * INVARIANTES DE SEGURANÇA:
 * - Connector FIXO `system.anthropic` (nunca escolhido pelo usuário).
 * - Base URL FIXA na oficial (`OFFICIAL`, somente leitura) — sem base URL livre,
 *   sem header customizado, sem proxy, sem modelo/prompt livres.
 * - API key é WRITE-ONLY: vive apenas no estado local do formulário (SecretField),
 *   é enviada uma vez e imediatamente apagada; nunca vai para cache/estado global,
 *   URL, log ou DOM após o envio. A resposta nunca ecoa a key (só fingerprint).
 * - Validação é LOCAL: mostra `NÃO VERIFICADO COM O PROVIDER`, nunca "conectado".
 * - Smoke test é CLI-only: exibimos o status, sem botão que dispare de fato.
 * - Rotação de credencial INVALIDA o smoke anterior (visual). Conflito de revisão
 *   limpa o segredo e NÃO refaz automaticamente.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck, ShieldAlert, FlaskConical, Lock } from 'lucide-react';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { usePermission } from '@/hooks/use-session';
import {
  ANTHROPIC_CONNECTOR_KEY,
  ANTHROPIC_OFFICIAL_BASE_URL,
  ANTHROPIC_CONNECTION_DEFAULT,
} from '@/contracts';
import type { Connection, ConnectionStatus, ConnectionConfigurationValidationResult } from '@/contracts';
import {
  useConnections,
  useCreateConnection,
  useCreateCredential,
  useRotateCredential,
  useSuspendConnection,
  useReactivateConnection,
  useRevokeConnection,
  useActivateConnection,
  useValidateConnectionConfiguration,
} from '@/hooks/use-connectors';
import { ArdenRepositoryError } from '@/services/errors';
import { SecretField } from '@/features/integrations/secret-field';

const CONNECTOR_VERSION = '1';

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  DRAFT: 'var(--st-paused)',
  ACTIVE: 'var(--st-completed)',
  SUSPENDED: 'var(--st-waiting)',
  ERROR: 'var(--st-failed)',
  REVOKED: 'var(--tx2)',
};

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation();
  return (
    <span className="badge">
      <span className="state-dot" style={{ background: STATUS_COLOR[status] }} aria-hidden />
      {t(`integrations.connections.status${status}`)}
    </span>
  );
}

/**
 * Estado do smoke test (§12). O backend expõe o smoke SOMENTE por CLI — não há
 * endpoint HTTP para dispará-lo. Aqui apenas refletimos o estado conhecido e as
 * instruções; nunca há botão que execute o smoke de verdade.
 */
type SmokeState = 'NOT_EXECUTED' | 'PASSED' | 'FAILED' | 'UNKNOWN' | 'INVALIDATED';

function SmokeStatusRow({ state }: { state: SmokeState }) {
  const { t } = useTranslation();
  return (
    <div className="row" role="status" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
      <FlaskConical size={15} aria-hidden />
      <span style={{ color: 'var(--tx2)' }}>{t('anthropic.conn.smokeLabel')}</span>
      <strong>{t(`anthropic.conn.smoke.${state}`)}</strong>
    </div>
  );
}

export function AnthropicConnections() {
  const { t } = useTranslation();
  const can = usePermission();
  const { connections, isLoading, error, refetch } = useConnections();

  const anthropicConnections = useMemo(
    () => connections.filter((c) => c.connectorKey === ANTHROPIC_CONNECTOR_KEY),
    [connections],
  );

  const createConnMut = useCreateConnection();
  const createCredMut = useCreateCredential();
  const rotateCredMut = useRotateCredential();
  const activateMut = useActivateConnection();
  const suspendMut = useSuspendConnection();
  const reactivateMut = useReactivateConnection();
  const revokeMut = useRevokeConnection();
  const validateMut = useValidateConnectionConfiguration();

  // Formulário de criação — API key vive APENAS aqui.
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = anthropicConnections.find((c) => c.id === selectedId) ?? null;
  const [validation, setValidation] = useState<ConnectionConfigurationValidationResult | null>(null);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [rotateKey, setRotateKey] = useState('');
  const [rotateError, setRotateError] = useState<string | null>(null);
  // Smoke local: rotação invalida o smoke anterior (§10/§12).
  const [smokeInvalidated, setSmokeInvalidated] = useState(false);

  const canCreate = can('connection.create');
  const canEdit = can('connection.edit');
  const canRevoke = can('connection.revoke');
  const canRotate = can('connection.rotate_credentials');
  const canValidate = can('connection.test');

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!name.trim() || !apiKey.trim()) return;
    try {
      const conn = await createConnMut.mutateAsync({
        connectorKey: ANTHROPIC_CONNECTOR_KEY,
        connectorVersion: CONNECTOR_VERSION,
        name: name.trim(),
        // Configuração FIXA: base URL oficial, sem override arbitrário.
        configuration: { ...ANTHROPIC_CONNECTION_DEFAULT },
      });
      // Credencial write-only: apiKey enviada uma vez e apagada imediatamente.
      await createCredMut.mutateAsync({ connectionId: conn.id, body: { secret: { apiKey: apiKey.trim() } } });
      setName('');
      setApiKey('');
    } catch (err) {
      setApiKey(''); // nunca reter a key após falha.
      setCreateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  function openConnection(id: string) {
    setSelectedId(id);
    setValidation(null);
    setDrawerMessage(null);
    setConfirmRevoke(false);
    setRotateKey('');
    setRotateError(null);
    setSmokeInvalidated(false);
  }

  // Nunca reter segredos além do ciclo de vida do drawer.
  useEffect(() => () => { setRotateKey(''); }, [selectedId]);

  async function onValidate() {
    if (!selected) return;
    setValidation(null);
    setDrawerMessage(null);
    try {
      const result = await validateMut.mutateAsync({ id: selected.id, body: {} });
      setValidation(result);
    } catch (err) {
      setDrawerMessage(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  async function onRotate() {
    if (!selected || !rotateKey.trim()) return;
    setRotateError(null);
    try {
      await rotateCredMut.mutateAsync({ connectionId: selected.id, body: { secret: { apiKey: rotateKey.trim() } } });
      setRotateKey('');
      // Rotação invalida o smoke anterior e a validação exibida.
      setSmokeInvalidated(true);
      setValidation(null);
    } catch (err) {
      setRotateKey(''); // conflito/erro: limpa o segredo, sem auto-retry.
      setRotateError(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
    }
  }

  async function runCommand(action: () => Promise<unknown>) {
    if (!selected) return;
    try {
      await action();
      setDrawerMessage(null);
    } catch (err) {
      if (err instanceof ArdenRepositoryError && err.code === 'CONFLICT') {
        await refetch();
        setDrawerMessage(t('integrations.common.conflictReloaded'));
      } else {
        setDrawerMessage(err instanceof ArdenRepositoryError ? err.message : t('data.error'));
      }
    }
  }

  const smokeState: SmokeState = smokeInvalidated ? 'INVALIDATED' : 'NOT_EXECUTED';

  return (
    <section className="card" aria-labelledby="anthropic-connections" style={{ marginTop: 'var(--sp-4)' }}>
      <h2 id="anthropic-connections" className="t-section">{t('anthropic.conn.title')}</h2>
      <p style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.conn.note')}</p>

      {canCreate && (
        <form onSubmit={onCreate} className="stack" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
          {/* Connector e base URL FIXOS — somente leitura, nunca editáveis. */}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="chip mono"><Lock size={12} aria-hidden /> {t('anthropic.conn.connector')}: {ANTHROPIC_CONNECTOR_KEY}</span>
            <span className="chip mono"><Lock size={12} aria-hidden /> {t('anthropic.conn.baseUrl')}: {ANTHROPIC_OFFICIAL_BASE_URL}</span>
            <span className="chip mono">{t('anthropic.conn.baseUrlMode')}: {ANTHROPIC_CONNECTION_DEFAULT.baseUrlMode}</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="anthropic-conn-name">{t('anthropic.conn.name')}</label>
            <input id="anthropic-conn-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          {canRotate ? (
            <SecretField id="anthropic-conn-apikey" label={t('anthropic.conn.apiKey')} value={apiKey} onChange={setApiKey} />
          ) : (
            <p className="t-micro" style={{ color: 'var(--st-waiting)' }}>{t('anthropic.conn.noRotatePermission')}</p>
          )}
          <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('anthropic.conn.apiKeyHint')}</p>
          {createError && <p role="alert" style={{ color: 'var(--st-failed)' }}>{createError}</p>}
          <div className="row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || !apiKey.trim() || !canRotate || createConnMut.isPending || createCredMut.isPending}
            >
              {t('anthropic.conn.create')}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 'var(--sp-4)' }}>
        {error ? (
          <div className="empty-state" role="alert">
            {error.code === 'FORBIDDEN' ? t('common.noPermission') : t('data.error')}
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => refetch()}>{t('data.retry')}</button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="empty-state">{t('data.loading')}</div>
        ) : anthropicConnections.length === 0 ? (
          <div className="empty-state">{t('anthropic.conn.empty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('anthropic.conn.name')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('anthropic.conn.connector')}</th>
                </tr>
              </thead>
              <tbody>
                {anthropicConnections.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => openConnection(c.id)}
                        style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--tx)', font: 'inherit', fontWeight: 600, textAlign: 'left' }}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="mono">{c.connectorKey}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={selected !== null}
        onOpenChange={(o) => { if (!o) { setSelectedId(null); setRotateKey(''); } }}
        title={selected?.name ?? ''}
      >
        {selected && (
          <AnthropicConnectionDetail
            connection={selected}
            validation={validation}
            drawerMessage={drawerMessage}
            smokeState={smokeState}
            confirmRevoke={confirmRevoke}
            rotateKey={rotateKey}
            rotateError={rotateError}
            perms={{ canEdit, canRevoke, canRotate, canValidate }}
            pending={{
              validate: validateMut.isPending,
              rotate: rotateCredMut.isPending,
              activate: activateMut.isPending,
              suspend: suspendMut.isPending,
              reactivate: reactivateMut.isPending,
              revoke: revokeMut.isPending,
            }}
            onValidate={onValidate}
            onRotateKeyChange={setRotateKey}
            onRotate={onRotate}
            onSetConfirmRevoke={setConfirmRevoke}
            onActivate={() => runCommand(() => activateMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }))}
            onSuspend={() => runCommand(() => suspendMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }))}
            onReactivate={() => runCommand(() => reactivateMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }))}
            onRevoke={async () => {
              await runCommand(() => revokeMut.mutateAsync({ id: selected.id, body: { expectedRevision: selected.revision } }));
              setConfirmRevoke(false);
            }}
          />
        )}
      </Drawer>
    </section>
  );
}

interface DetailPerms { canEdit: boolean; canRevoke: boolean; canRotate: boolean; canValidate: boolean }
interface DetailPending { validate: boolean; rotate: boolean; activate: boolean; suspend: boolean; reactivate: boolean; revoke: boolean }

function AnthropicConnectionDetail(props: {
  connection: Connection;
  validation: ConnectionConfigurationValidationResult | null;
  drawerMessage: string | null;
  smokeState: SmokeState;
  confirmRevoke: boolean;
  rotateKey: string;
  rotateError: string | null;
  perms: DetailPerms;
  pending: DetailPending;
  onValidate: () => void;
  onRotateKeyChange: (v: string) => void;
  onRotate: () => void;
  onSetConfirmRevoke: (v: boolean) => void;
  onActivate: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const { connection: c, validation, perms, pending } = props;

  return (
    <>
      <DrawerField label={t('anthropic.conn.connector')} value={c.connectorKey} />
      <DrawerField label={t('common.status')} value={<StatusBadge status={c.status} />} />
      <DrawerField label={t('integrations.common.expectedRevision')} value={c.revision} />

      {props.drawerMessage && <p role="alert" style={{ color: 'var(--st-waiting)' }}>{props.drawerMessage}</p>}

      {/* Validação LOCAL — nunca "conectado/autenticado/válido". §9 */}
      {perms.canValidate && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <div className="t-micro">{t('anthropic.conn.validation')}</div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={props.onValidate} disabled={pending.validate}>
            {pending.validate ? t('anthropic.conn.validating') : t('anthropic.conn.validate')}
          </button>
          {validation && (
            <div style={{ marginTop: 8 }} role="status">
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                {validation.configurationValid ? <ShieldCheck size={15} aria-hidden /> : <ShieldAlert size={15} aria-hidden />}
                <strong>{t('anthropic.conn.providerVerification')}: {t(`anthropic.conn.verify.${validation.providerVerificationStatus}`)}</strong>
              </div>
              <p className="t-micro" style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.conn.notVerifiedNote')}</p>
              <dl className="kv" style={{ marginTop: 6 }}>
                <dt>{t('anthropic.conn.configurationValid')}</dt><dd>{validation.configurationValid ? t('anthropic.yes') : t('anthropic.no')}</dd>
                <dt>{t('anthropic.conn.credentialPresent')}</dt><dd>{validation.credentialPresent ? t('anthropic.yes') : t('anthropic.no')}</dd>
                <dt>{t('anthropic.conn.credentialDecryptable')}</dt><dd>{validation.credentialDecryptable ? t('anthropic.yes') : t('anthropic.no')}</dd>
                <dt>{t('anthropic.conn.providerCompatible')}</dt><dd>{validation.providerCompatible ? t('anthropic.yes') : t('anthropic.no')}</dd>
                {/* Somente fingerprint — NUNCA a key. §8 */}
                <dt>{t('anthropic.conn.fingerprint')}</dt><dd className="mono">{validation.credentialFingerprint ?? t('anthropic.none')}</dd>
              </dl>
              {validation.issues.length > 0 && (
                <ul className="t-micro" style={{ color: 'var(--st-waiting)' }}>
                  {validation.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smoke test — CLI-only. §12: sem botão que dispare de fato. */}
      <div style={{ marginTop: 'var(--sp-4)' }}>
        <div className="t-micro">{t('anthropic.conn.smokeTitle')}</div>
        <SmokeStatusRow state={props.smokeState} />
        <p className="t-micro" style={{ color: 'var(--tx2)', marginTop: 4 }}>{t('anthropic.conn.smokeCliOnly')}</p>
        <pre className="mono" style={{ fontSize: '0.75rem', background: 'var(--bg2)', padding: 8, borderRadius: 6, overflowX: 'auto' }}>
          {t('anthropic.conn.smokeCommand')}
        </pre>
      </div>

      {/* Rotação de credencial — write-only; invalida o smoke; sem auto-retry. §10 */}
      {perms.canRotate && c.status !== 'REVOKED' && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <div className="t-micro"><KeyRound size={13} aria-hidden /> {t('anthropic.conn.rotate')}</div>
          <SecretField id="anthropic-rotate-apikey" label={t('anthropic.conn.newApiKey')} value={props.rotateKey} onChange={props.onRotateKeyChange} />
          <p className="t-micro" style={{ color: 'var(--tx2)' }}>{t('anthropic.conn.rotateInvalidatesSmoke')}</p>
          <button type="button" className="btn btn-sm btn-ghost" disabled={!props.rotateKey.trim() || pending.rotate} onClick={props.onRotate}>
            {t('anthropic.conn.rotateAction')}
          </button>
          {props.rotateError && <p role="alert" style={{ color: 'var(--st-failed)' }}>{props.rotateError}</p>}
        </div>
      )}

      {/* Lifecycle. §11 */}
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
        {perms.canEdit && c.status === 'DRAFT' && (
          <button type="button" className="btn btn-sm btn-primary" disabled={pending.activate} onClick={props.onActivate}>{t('anthropic.conn.activate')}</button>
        )}
        {perms.canEdit && (c.status === 'ACTIVE' || c.status === 'ERROR') && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={pending.suspend} onClick={props.onSuspend}>{t('anthropic.conn.suspend')}</button>
        )}
        {perms.canEdit && (c.status === 'SUSPENDED' || c.status === 'ERROR') && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={pending.reactivate} onClick={props.onReactivate}>{t('anthropic.conn.reactivate')}</button>
        )}
        {perms.canRevoke && c.status !== 'REVOKED' && !props.confirmRevoke && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => props.onSetConfirmRevoke(true)}>{t('anthropic.conn.revoke')}</button>
        )}
      </div>

      {props.confirmRevoke && (
        <div className="empty-state" role="alertdialog" aria-label={t('anthropic.conn.revokeConfirmTitle')}>
          <p>{t('anthropic.conn.revokeConfirmBody')}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => props.onSetConfirmRevoke(false)}>{t('common.cancel')}</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={pending.revoke} onClick={props.onRevoke}>{t('anthropic.conn.revoke')}</button>
          </div>
        </div>
      )}
    </>
  );
}

export default AnthropicConnections;
