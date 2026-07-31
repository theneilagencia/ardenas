/**
 * Arden.AS — hooks do agregado Operação (ARDEN-FE-002).
 * Única porta da UI para operações: consomem a camada de aplicação (que usa os
 * repositórios) passando o `RequestContext` derivado da SESSÃO ATIVA. O tenant
 * nunca é digitado num formulário — vem sempre da sessão.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Operation } from '@/domain/types';
import type { ArdenRepositoryError } from '@/services/errors';
import { ArdenRepositoryError as RepoError } from '@/services/errors';
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
  type RequestContext,
} from '@/application';
import type { CreateFromAssessmentInput } from '@/services/contracts';
import { useTenant } from '@/app/tenant-context';
import { useRequestContext } from './use-session';

const OPERATIONS_KEY = 'operations';
const OPERATION_KEY = 'operation';

/** Erro tipado para quando não há tenant ativo (a UI trata como estado vazio). */
function noTenant(): RepoError {
  return new RepoError('UNAVAILABLE', 'Nenhuma organização ativa na sessão.');
}

function requireCtx(ctx: RequestContext | null): RequestContext {
  if (!ctx) throw noTenant();
  return ctx;
}

interface OperationFilters {
  status?: string;
  search?: string;
}

export function useOperations(filters: OperationFilters = {}) {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [OPERATIONS_KEY, organizationId, filters],
    queryFn: () => listOperations(requireCtx(ctx), filters),
    enabled: !!organizationId && !!ctx,
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
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  const organizationId = activeOrganization?.id ?? '';
  const query = useQuery({
    queryKey: [OPERATION_KEY, organizationId, id],
    queryFn: () => getOperation(requireCtx(ctx), id as string),
    enabled: !!id && !!ctx,
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
    if (id) void qc.invalidateQueries({ queryKey: [OPERATION_KEY] });
  };
}

export function useCreateOperation() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (op: Operation) => createOperation(requireCtx(ctx), op),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useSaveOperationDraft() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (op: Operation) => saveOperationDraft(requireCtx(ctx), op),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useUpdateOperationDraft() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Operation> }) =>
      updateOperationDraft(requireCtx(ctx), id, input),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useCreateOperationVersion() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => createOperationVersion(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function usePublishOperationVersion() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => publishOperationVersion(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useArchiveOperation() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => archiveOperation(requireCtx(ctx), id),
    onSuccess: (_r, id) => invalidate(id),
  });
}

export function usePauseOperation() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => pauseOperation(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useResumeOperation() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => resumeOperation(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useDuplicateOperation() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => duplicateOperation(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useCreateOperationFromAssessment() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (input: CreateFromAssessmentInput) =>
      createOperationFromAssessment(requireCtx(ctx), input),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function usePromoteEnvironment() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => promoteOperationEnvironment(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}

export function useRollbackEnvironment() {
  const ctx = useRequestContext();
  const invalidate = useOperationsInvalidator();
  return useMutation({
    mutationFn: (id: string) => rollbackOperationEnvironment(requireCtx(ctx), id),
    onSuccess: (op) => invalidate(op.id),
  });
}
