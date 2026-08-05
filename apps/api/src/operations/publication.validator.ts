/**
 * Arden.AS API — validação de publicação de versão (ARDEN-BE-003).
 *
 * Serviço explícito que decide se uma versão pode ser publicada. `errors` impedem
 * a publicação; `warnings` não. Cobre tenant, pertencimento, estado de rascunho,
 * nome, definição mínima, Gradiente de Autoridade (perfil e regras) e permissão.
 */

import { Injectable } from '@nestjs/common';
import type { Operation as DbOperation, OperationVersion as DbVersion } from '@prisma/client';
import { operationDefinition, authorityProfile, type AuthorityProfile } from '@arden/contracts';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { validateAuthorityProfileForPublish, type ValidationIssue } from './authority.rules';

export interface PublicationValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

@Injectable()
export class OperationPublicationValidator {
  validate(
    operation: DbOperation,
    version: DbVersion,
    context: AuthenticatedRequestContext,
  ): PublicationValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Tenant + pertencimento.
    if (operation.organizationId !== context.organizationId) {
      errors.push({ code: 'TENANT_MISMATCH', message: 'Operação de outro tenant.' });
    }
    if (version.operationId !== operation.id || version.organizationId !== operation.organizationId) {
      errors.push({ code: 'VERSION_NOT_IN_OPERATION', message: 'Versão não pertence à operação.' });
    }

    // Estado.
    if (operation.status === 'archived') {
      errors.push({ code: 'OPERATION_ARCHIVED', message: 'Operação arquivada não pode publicar.' });
    }
    if (version.status !== 'draft') {
      errors.push({ code: 'VERSION_NOT_DRAFT', field: 'status', message: 'Somente rascunho publica.' });
    }

    // Nome da operação.
    if (!operation.name || operation.name.trim().length === 0) {
      errors.push({ code: 'OPERATION_NAME_REQUIRED', field: 'name', message: 'Nome obrigatório.' });
    }

    // Definição mínima válida: estrutura do contrato + objetivo e resultado esperado.
    const defCheck = operationDefinition.safeParse(version.definition);
    if (!defCheck.success) {
      errors.push({ code: 'DEFINITION_INVALID', field: 'definition', message: 'Definição inválida.' });
    } else {
      if (!defCheck.data.objective.trim()) {
        errors.push({ code: 'OBJECTIVE_REQUIRED', field: 'definition.objective', message: 'Objetivo obrigatório.' });
      }
      if (!defCheck.data.expectedResult.trim()) {
        errors.push({
          code: 'EXPECTED_RESULT_REQUIRED',
          field: 'definition.expectedResult',
          message: 'Resultado esperado obrigatório.',
        });
      }
    }

    // Gradiente de Autoridade: presente + regras por nível.
    const authCheck = authorityProfile.safeParse(version.authorityProfile);
    if (!authCheck.success) {
      errors.push({
        code: 'AUTHORITY_PROFILE_INVALID',
        field: 'authorityProfile',
        message: 'Gradiente de Autoridade inválido ou ausente.',
      });
    } else {
      const authResult = validateAuthorityProfileForPublish(authCheck.data as AuthorityProfile);
      errors.push(...authResult.errors);
      warnings.push(...authResult.warnings);
    }

    // Permissão (defesa adicional — o guard já exige operation.publish).
    if (!context.permissions.has('operation.publish')) {
      errors.push({ code: 'PERMISSION_DENIED', message: 'Sem permissão operation.publish.' });
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
