/**
 * Arden.AS — hooks do agregado Operação.
 * Única porta da UI para operações: consomem a camada de aplicação (que usa os
 * repositórios). Não acessam Zustand para domínio nem IndexedDB.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import type { Operation } from '@/domain/types';
import type { ArdenRepositoryError } from '@/services/errors';
import type { AuditContext } from '@/application';
import {
  archiveOperation,
  createOperation,
  createOperationFromAssessment,
  createOperationVersion,
  duplicateOperation,
  getOperation,
  listOperations,
  pauseOperation,
  promoteOperationEnvironment,
  publishOperationVersion,
  resumeOperation,
  rollbackOperationEnvironment,
  saveOperationDraft,
  updateOperationDraft,
} from '@/application';
import type { CreateFromAssessmentInput } from '@/services/contracts';

const OPERATIONS_KEY = 'operations';
const OPERATION_KEY = 'operation';

export function useAuditContext(): AuditContext {
  const session = useAppStore((s) => s.session);
  const organizationId = useAppStore((s) => s.organizationId);
  return {
    actorId: session?.person.id ?? 'system',
    actorRole: session?.roleKeys[0] ?? 'analyst',
    organizationId,
  };
}

interface OperationFilters {
  status?: string;
  search?: string;
}

export function useOperations(filters: OperationFilters = {}) {
  const organizationId = useAppStore((s) => s.organizationId);
  const query = useQuery({
    queryKey: [OPERATIONS_KEY, organizationId, filters],
    queryFn: () => listOperations({ organizationId, ...filters }),
    enabled: !!organizationId,
  });
  return {
    operations: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

export function useOperation(id?: string) {
  const query = useQuery({
    queryKey: [OPERATION_KEY, id],
    queryFn: () => getOperation(id as string),
    enabled: !!id,
  });
  return {
    operation: query.data,
    isLoading: query.isLoading,
    error: (query.error as ArdenRepositoryError) ?? null,
    refetch: query.refetch,
  };
}

function useOperationsInvalidator() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: [OPERATIONS_KEY] });
    void qc.invalidateQueries({ queryKey: ['audit-events'] });
    if (id) void qc.invalidateQueries({ queryKey: [OPERATION_KEY, id] });
  };
}

export function useCreateOperation() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (op: Operation) => createOperation(op, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useSaveOperationDraft() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (op: Operation) => saveOperationDraft(op, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useUpdateOperationDraft() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Operation> }) =>
      updateOperationDraft(id, input, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useCreateOperationVersion() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => createOperationVersion(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function usePublishOperationVersion() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => publishOperationVersion(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useArchiveOperation() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => archiveOperation(id, ctx),
    onSuccess: (_r, id) => invalidate(id),
  });
}

export function usePauseOperation() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => pauseOperation(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useResumeOperation() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => resumeOperation(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useDuplicateOperation() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => duplicateOperation(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useCreateOperationFromAssessment() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (input: CreateFromAssessmentInput) => createOperationFromAssessment(input, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function usePromoteEnvironment() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => promoteOperationEnvironment(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useRollbackEnvironment() {
  const ctx = useAuditContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => rollbackOperationEnvironment(id, ctx),
    onSuccess: (op) => invalidate(op.id),
  });
}
