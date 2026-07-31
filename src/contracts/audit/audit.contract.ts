/**
 * Arden.AS — API v1 · auditoria (endpoints) (ARDEN-FE-003).
 * SOMENTE LEITURA: não há POST/PATCH/DELETE de eventos para clientes comuns.
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import { auditEvent, listAuditEventsQuery } from './audit.schemas';

const BASE = '/api/v1/organizations/{organizationId}/audit-events';

export const auditSchemas = {
  AuditEvent: auditEvent,
  ListAuditEventsQuery: listAuditEventsQuery,
  AuditEventResponse: apiResponse(auditEvent),
  AuditEventListResponse: paginatedResponse(auditEvent),
} as const;

export const auditEndpoints: EndpointContract[] = [
  {
    id: 'audit.list',
    method: 'GET',
    path: BASE,
    summary: 'Lista eventos de auditoria (filtros + cursor).',
    tag: 'Audit',
    permission: 'audit.view',
    idempotent: false,
    optimisticConcurrency: false,
    querySchema: 'ListAuditEventsQuery',
    pathParams: ['organizationId'],
    successStatus: 200,
    responseSchema: 'AuditEventListResponse',
  },
  {
    id: 'audit.get',
    method: 'GET',
    path: `${BASE}/{eventId}`,
    summary: 'Detalhe de um evento de auditoria.',
    tag: 'Audit',
    permission: 'audit.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'eventId'],
    successStatus: 200,
    responseSchema: 'AuditEventResponse',
  },
];
