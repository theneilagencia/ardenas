/**
 * Arden.AS — hook de leitura de auditoria.
 * A UI de auditoria/segurança lê pelos contratos; a escrita passa pela fronteira
 * única `AuditRepository.append` (via store.recordAudit e casos de uso).
 */

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import type { AuditEvent } from '@/domain/types';
import type { ArdenRepositoryError } from '@/services/errors';
import { listAuditEvents } from '@/application';

export function useAuditEvents(filter: { result?: AuditEvent['result'] } = {}) {
  const organizationId = useAppStore((s) => s.organizationId);
  // A store notifica mudanças de auditoria por um contador incremental, para
  // revalidar a leitura após escritas (recordAudit).
  const version = useAppStore((s) => s.auditVersion);
  const query = useQuery({
    queryKey: ['audit-events', organizationId, filter, version],
    queryFn: () => listAuditEvents({ organizationId, ...filter }),
    enabled: !!organizationId,
  });
  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}
