/**
 * Arden.AS API — worker de execução (ARDEN-BE-005 §17). Processo LÓGICO separado
 * do API: adquire jobs da fila durável, processa e recupera leases expirados. O
 * controller nunca processa etapas — apenas cria/comanda; este loop é quem executa.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ExecutionQueue } from './execution.queue';
import { ExecutionProcessor } from './execution.processor';
import { ExecutionRecorder } from './execution.recorder';
import { ExecutionsRepository } from './executions.repository';
import { ConnectorMasterKeyPreflightService } from '../security/connector-master-key-preflight.service';

export interface WorkerOptions {
  workerId: string;
  leaseSeconds: number;
  pollIntervalMs: number;
}

@Injectable()
export class ExecutionWorker {
  private readonly logger = new Logger(ExecutionWorker.name);
  private running = false;

  private keyringUnavailableLogged = false;

  constructor(
    private readonly queue: ExecutionQueue,
    private readonly processor: ExecutionProcessor,
    private readonly recorder: ExecutionRecorder,
    private readonly repo: ExecutionsRepository,
    // ARDEN-PRD-001.1D: preflight criptográfico. @Optional para não quebrar contextos de
    // teste que montam o worker sem o SecurityModule.
    @Optional() private readonly masterKeyPreflight?: ConnectorMasterKeyPreflightService,
  ) {}

  /**
   * Fail-closed: quando o keyring é inválido/incompleto, o worker NÃO adquire jobs, NÃO
   * renova leases e NÃO os marca como FAILED (é configuração global, não defeito do job).
   */
  private async keyringReady(): Promise<boolean> {
    if (!this.masterKeyPreflight) return true; // sem serviço injetado → não bloqueia (testes)
    let ready = false;
    try {
      ready = await this.masterKeyPreflight.isReady();
    } catch {
      ready = false;
    }
    if (!ready && !this.keyringUnavailableLogged) {
      this.keyringUnavailableLogged = true; // evita loop de logs
      this.logger.error('Worker não pronto: preflight da master key inválido (fail-closed; sem consumir jobs).');
    }
    if (ready) this.keyringUnavailableLogged = false;
    return ready;
  }

  /** Recupera leases expirados; registra evento de recuperação por execução. */
  async recoverLeases(): Promise<number> {
    const recovered = await this.queue.recoverExpiredLeases();
    for (const r of recovered) {
      const run = await this.repo.findRunById(r.executionRunId);
      if (run) {
        await this.recorder.recordEventStandalone(run.organizationId, run.id, 'execution_job.lease_expired', 'SYSTEM', run.correlationId, { jobId: r.id });
        await this.recorder.recordEventStandalone(run.organizationId, run.id, 'execution_job.recovered', 'SYSTEM', run.correlationId, { jobId: r.id });
      }
    }
    return recovered.length;
  }

  /** Processa no máximo um job. Retorna true se processou algo. Usado em testes. */
  async runOnce(opts: WorkerOptions): Promise<boolean> {
    // Preflight fail-closed: sem keyring válido, não consome nem recupera jobs.
    if (!(await this.keyringReady())) return false;
    await this.recoverLeases();
    const job = await this.queue.acquire(opts.workerId, opts.leaseSeconds);
    if (!job) return false;
    try {
      await this.processor.process(job, opts.workerId, opts.leaseSeconds);
    } catch (err) {
      this.logger.error(`Falha ao processar job ${job.id}: ${err instanceof Error ? err.message : err}`);
      // Não relança: o lease expira e o job é recuperado.
    }
    return true;
  }

  /**
   * Drena a fila até esvaziar (útil em testes determinísticos). Aguarda o backoff
   * de retries agendados (`availableAt` futuro), limitado por `maxWaitMs`.
   */
  async drain(opts: WorkerOptions, maxIterations = 1000, maxWaitMs = 15_000): Promise<void> {
    for (let i = 0; i < maxIterations; i++) {
      const processed = await this.runOnce(opts);
      if (processed) continue;
      const next = await this.queue.earliestAvailableAt();
      if (!next) return;
      const waitMs = next.getTime() - Date.now();
      if (waitMs <= 0) continue;
      if (waitMs > maxWaitMs) return;
      await this.sleep(waitMs + 10);
    }
  }

  async start(opts: WorkerOptions): Promise<void> {
    this.running = true;
    this.logger.log(`Worker ${opts.workerId} iniciado (lease=${opts.leaseSeconds}s, poll=${opts.pollIntervalMs}ms).`);
    while (this.running) {
      const processed = await this.runOnce(opts);
      if (!processed) await this.sleep(opts.pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
