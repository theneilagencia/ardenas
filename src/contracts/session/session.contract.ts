/**
 * Arden.AS — API v1 · sessão (endpoints) (ARDEN-FE-003).
 *
 * Autenticação/identidade. Sem permissão de domínio (o servidor autentica). A
 * troca de organização exige membership ativa (rejeitada server-side, não pelo
 * cliente). Sem idempotência (não são comandos de recurso de domínio).
 */

import { z } from 'zod';
import type { EndpointContract } from '../endpoint';
import { apiResponse } from '../common/pagination';
import {
  authenticatedUser,
  membership,
  organizationSummary,
  sessionContext,
  switchOrganizationRequest,
} from './session.schemas';

/** Schemas nomeados desta área para o registro. */
export const sessionSchemas = {
  AuthenticatedUser: authenticatedUser,
  OrganizationSummary: organizationSummary,
  Membership: membership,
  SessionContext: sessionContext,
  SwitchOrganizationRequest: switchOrganizationRequest,
  SessionResponse: apiResponse(sessionContext),
  NoContent: z.object({}),
} as const;

export const sessionEndpoints: EndpointContract[] = [
  {
    id: 'session.get',
    method: 'GET',
    path: '/api/v1/session',
    summary: 'Sessão atual (usuário, organizações, memberships, org ativa, permissões, expiração, status).',
    tag: 'Session',
    permission: null,
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: [],
    successStatus: 200,
    responseSchema: 'SessionResponse',
    description:
      'O servidor deriva usuário, organização ativa e permissões da sessão autenticada. O cliente não envia permissões.',
  },
  {
    id: 'session.refresh',
    method: 'POST',
    path: '/api/v1/session/refresh',
    summary: 'Renova a sessão (nova expiração).',
    tag: 'Session',
    permission: null,
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: [],
    successStatus: 200,
    responseSchema: 'SessionResponse',
  },
  {
    id: 'session.switchOrganization',
    method: 'POST',
    path: '/api/v1/session/switch-organization',
    summary: 'Troca a organização ativa. Rejeita sem membership ativa.',
    tag: 'Session',
    permission: null,
    idempotent: false,
    optimisticConcurrency: false,
    requestSchema: 'SwitchOrganizationRequest',
    pathParams: [],
    successStatus: 200,
    responseSchema: 'SessionResponse',
    description:
      'MEMBERSHIP_REQUIRED/MEMBERSHIP_SUSPENDED quando o usuário não possui membership ativa na organização de destino.',
  },
  {
    id: 'session.logout',
    method: 'POST',
    path: '/api/v1/session/logout',
    summary: 'Encerra a sessão.',
    tag: 'Session',
    permission: null,
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: [],
    successStatus: 204,
    responseSchema: 'NoContent',
  },
];
