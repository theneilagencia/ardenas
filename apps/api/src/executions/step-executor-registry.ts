/**
 * Arden.AS API — registry de executores de etapa (ARDEN-BE-005 + ARDEN-BE-006.6).
 *
 * Seleciona o executor por ACTION KEY REGISTRADA — nunca por classe/nome vindo do
 * banco, nunca `eval`/import dinâmico. Chaves internas determinísticas resolvem para o
 * catálogo estático; chaves `external.*`/`connector.test.*` resolvem para o
 * `ExternalToolStepExecutor` (DI). Ação desconhecida ⇒ `STEP_EXECUTOR_NOT_AVAILABLE`.
 */

import { Injectable } from '@nestjs/common';
import { isExternalExecutorActionKey } from '@arden/contracts';
import { getExecutor, hasExecutor, StepExecutionError, type StepExecutor } from './executors';
import { ExternalToolStepExecutor } from './external-tool-step.executor';

@Injectable()
export class StepExecutorRegistry {
  constructor(private readonly external: ExternalToolStepExecutor) {}

  hasExecutor(actionKey: string): boolean {
    return isExternalExecutorActionKey(actionKey) || hasExecutor(actionKey);
  }

  /** Resolve o executor para a action key. Externas → executor de conector (DI). */
  resolve(actionKey: string): StepExecutor {
    if (isExternalExecutorActionKey(actionKey)) {
      return {
        actionKey: actionKey as StepExecutor['actionKey'],
        execute: (ctx) => this.external.execute(ctx),
        // Ferramentas externas NÃO compensam (efeito externo); compensate ausente.
      };
    }
    if (!hasExecutor(actionKey)) {
      throw new StepExecutionError('STEP_EXECUTOR_NOT_AVAILABLE', `Executor não registrado: ${actionKey}`, false);
    }
    return getExecutor(actionKey);
  }
}
