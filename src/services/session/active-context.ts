/**
 * Arden.AS — contexto de requisição ativo (ARDEN-FE-002).
 *
 * Ponte não-React entre a sessão e as camadas de baixo nível (ApiClient). O
 * `organizationId` propagado para o servidor é SEMPRE derivado da sessão ativa —
 * nunca informado arbitrariamente pelo usuário. O TenantProvider é o único a
 * escrever aqui.
 */

let activeOrganizationId: string | null = null;

export function setActiveOrganizationId(id: string | null): void {
  activeOrganizationId = id;
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId;
}
