/**
 * Arden.AS — SessionRepository sobre HTTP (modo api) (ARDEN-FE-002).
 *
 * Estruturalmente preparado para endpoints futuros. NÃO inventa backend: quando
 * a API não está configurada (sem base URL), lança erro EXPLÍCITO e TIPADO. Não
 * há fallback silencioso para mock — a resolução do provedor é única e explícita.
 */

import type { SessionContext } from '@/domain/identity';
import type { ApiClient } from '../api-client';
import { ArdenRepositoryError, toRepositoryError } from '../errors';
import type { SessionRepository } from './session-contracts';

export class ApiSessionRepository implements SessionRepository {
  constructor(
    private readonly client: ApiClient,
    private readonly baseUrl: string,
  ) {}

  private ensureConfigured(): void {
    if (!this.baseUrl) {
      throw new ArdenRepositoryError(
        'UNAVAILABLE',
        'Provedor de dados "api" selecionado, mas VITE_API_BASE_URL não está configurada. ' +
          'Sem fallback para mock — configure a API para usar o modo api.',
      );
    }
  }

  async getCurrentSession(): Promise<SessionContext | null> {
    this.ensureConfigured();
    try {
      const res = await this.client.get<SessionContext | null>('/session');
      return res.data ?? null;
    } catch (err) {
      throw toRepositoryError(err);
    }
  }

  async switchOrganization(organizationId: string): Promise<SessionContext> {
    this.ensureConfigured();
    try {
      const res = await this.client.post<SessionContext>('/session/switch-organization', {
        organizationId,
      });
      return res.data;
    } catch (err) {
      throw toRepositoryError(err);
    }
  }

  async refreshSession(): Promise<SessionContext> {
    this.ensureConfigured();
    try {
      const res = await this.client.post<SessionContext>('/session/refresh');
      return res.data;
    } catch (err) {
      throw toRepositoryError(err);
    }
  }

  async signOut(): Promise<void> {
    this.ensureConfigured();
    try {
      // Endpoint canônico do contrato (operationId session.logout). O nome de
      // domínio `signOut` é preservado; apenas o path segue o contrato/OpenAPI.
      await this.client.post<void>('/session/logout');
    } catch (err) {
      throw toRepositoryError(err);
    }
  }
}
