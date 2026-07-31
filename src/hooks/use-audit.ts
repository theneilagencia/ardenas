/**
 * Arden.AS — hook de leitura de auditoria (ARDEN-FE-002).
 * A UI de auditoria/segurança lê pelos contratos, com o tenant derivado da
 * sessão ativa (RequestContext). A escrita passa pela fronteira única
 * `AuditRepository.append` (via casos de uso e store.recordAudit).
 */

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import type { AuditEvent } from '@/domain/types';
import type { ArdenRepositoryError } from '@/services/errors';
import { listAuditEvents } from '@/application';
import { useTenant } from '@/app/tenant-context';
import { useRequestContext } from './use-session';

export function useAuditEvents(filter: { result?: AuditEvent['result'] } = {}) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  // A store notifica mudanças de auditoria por um contador incremental, para
  // revalidar a leitura após escritas (recordAudit / eventos de sessão).
  const version = useAppStore((s) => s.auditVersion);
  const query = useQuery({
    queryKey: ['audit-events', organizationId, filter, version],
    queryFn: () => listAuditEvents(ctx!, filter),
    enabled: !!organizationId && !!ctx,
  });
  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}
