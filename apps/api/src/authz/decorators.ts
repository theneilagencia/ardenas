/**
 * Arden.AS API — decorators de autorização (ARDEN-BE-002).
 * Declarativos: `@Public`, `@RequireOrganization`, `@RequirePermission('...')`.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'arden:isPublic';
export const REQUIRE_ORG_KEY = 'arden:requireOrganization';
export const REQUIRE_PERMISSION_KEY = 'arden:requirePermission';

/** Rota pública: pula autenticação/autorização. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige uma organização ativa resolvida no contexto. */
export const RequireOrganization = () => SetMetadata(REQUIRE_ORG_KEY, true);

/** Exige uma permissão efetiva (calculada pelo backend). */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
