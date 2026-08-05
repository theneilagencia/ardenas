/**
 * Arden.AS — emissor de token do provider FAKE para o E2E de modo `api`
 * (ARDEN-BE-002). Replica o formato do FakeIdentityProvider do backend
 * (`fake.<base64url(json)>`) para não acoplar o E2E ao código do backend. NÃO é
 * criptografia — o backend só aceita este formato quando AUTH_PROVIDER=fake.
 */

export function issueFakeToken(input: {
  subject: string;
  email?: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: input.subject,
    email: input.email ?? `${input.subject}@arden.test`,
    email_verified: true,
    display_name: null,
    iat: now,
    exp: now + (input.ttlSeconds ?? 3600),
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `fake.${payload}`;
}
