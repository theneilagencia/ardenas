/**
 * Arden.AS API — CLI do smoke test real do Anthropic (ARDEN-BE-008.4 §8-10).
 *
 * Comando DEDICADO, fora de qualquer suíte/CI/seed/worker. Só executa sob TODAS as flags
 * (`ANTHROPIC_SMOKE_TEST_ENABLED`, `..._ACKNOWLEDGED`, runtime/external gates) e com a
 * confirmação explícita `--confirm-live-anthropic-call`. A credencial vem do cofre (nunca da
 * CLI/env). Imprime apenas o resultado SANITIZADO. Guardado por `ARDEN_CLI=anthropic-smoke`.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AnthropicSmokeTestService } from '../agents/providers/anthropic/anthropic-smoke-test.service';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const organizationId = arg('organizationId');
  const connectionId = arg('connectionId');
  const modelConfigurationId = arg('modelConfigurationId');
  const confirmed = process.argv.includes('--confirm-live-anthropic-call');
  const operator = arg('operator') ?? process.env.USER ?? 'unknown';

  if (!organizationId || !connectionId || !modelConfigurationId) {
    console.error('Uso: ARDEN_CLI=anthropic-smoke ... --organizationId=<> --connectionId=<> --modelConfigurationId=<> --confirm-live-anthropic-call');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  try {
    const service = app.get(AnthropicSmokeTestService);
    const result = await service.run({ organizationId, connectionId, modelConfigurationId, confirmed, operator });
    // Resultado SANITIZADO (sem chave/prompt/raw).
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'PASSED' ? 0 : 1);
  } finally {
    await app.close();
  }
}

if (process.env.ARDEN_CLI === 'anthropic-smoke') {
  main().catch((err) => {
    console.error('Falha no smoke test:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
