/**
 * Arden.AS — portador do access token para o modo `api` (ARDEN-BE-002).
 *
 * O backend autenticado (BE-002) exige `Authorization: Bearer <token>`. O token é
 * emitido pelo provedor de identidade (Supabase) no fluxo de login do cliente;
 * aqui apenas o EXPOMOS de forma única para o `ApiClient`. Sem token, as chamadas
 * seguem sem cabeçalho e o backend responde 401 — NUNCA há fallback para dados
 * simulados.
 *
 * Precedência: token definido em memória (fluxo de auth) › `localStorage`
 * (persistência entre navegações e injeção controlada em testes E2E).
 */

const STORAGE_KEY = 'arden.accessToken';

let inMemoryToken: string | null = null;

/** Define/limpa o token do fluxo de autenticação (memória + persistência). */
export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(STORAGE_KEY, token);
  else localStorage.removeItem(STORAGE_KEY);
}

/** Retorna o token atual, ou `null` quando não autenticado. */
export function getAccessToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}
