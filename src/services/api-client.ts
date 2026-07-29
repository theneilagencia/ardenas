/**
 * Arden.AS — cliente HTTP.
 * Traduz status HTTP para o tratamento de frontend definido no contrato.
 * Usado apenas quando VITE_DATA_PROVIDER=api.
 */

import type { ApiError, ApiResponse } from './contracts';

export type ErrorTreatment =
  | 'validation' // 400 — exibir por campo
  | 'session_expired' // 401 — redirecionar ao login
  | 'access_denied' // 403 — tela com perfil atual e responsável
  | 'not_found' // 404 — estado vazio explicativo
  | 'conflict' // 409 — recarregar e comparar
  | 'business_rule' // 422 — exibir justificativa do bloqueio
  | 'rate_limited' // 429 — janela de espera
  | 'internal' // 500 — correlationId visível
  | 'unavailable' // 503 — nova tentativa
  | 'unknown';

export const HTTP_TREATMENT: Record<number, ErrorTreatment> = {
  400: 'validation',
  401: 'session_expired',
  403: 'access_denied',
  404: 'not_found',
  409: 'conflict',
  422: 'business_rule',
  429: 'rate_limited',
  500: 'internal',
  503: 'unavailable',
};

export function treatmentForStatus(status: number): ErrorTreatment {
  return HTTP_TREATMENT[status] ?? 'unknown';
}

export class ArdenApiError extends Error {
  readonly status: number;
  readonly treatment: ErrorTreatment;
  readonly payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.message);
    this.name = 'ArdenApiError';
    this.status = status;
    this.treatment = treatmentForStatus(status);
    this.payload = payload;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  organizationId?: string;
  getToken?: () => string | null;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  async request<T>(
    path: string,
    init: RequestInit & { signal?: AbortSignal } = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (this.opts.organizationId) {
      headers.set('X-Arden-Organization', this.opts.organizationId);
    }
    const token = this.opts.getToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${this.opts.baseUrl}${path}`, { ...init, headers });

    if (!res.ok) {
      let payload: ApiError;
      try {
        payload = (await res.json()) as ApiError;
      } catch {
        payload = { code: `http_${res.status}`, message: res.statusText };
      }
      throw new ArdenApiError(res.status, payload);
    }

    if (res.status === 204) return { data: undefined as T };
    return (await res.json()) as ApiResponse<T>;
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { method: 'GET', signal });
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  }

  patch<T>(path: string, body?: unknown, signal?: AbortSignal) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  }
}
