/**
 * Arden.AS — API v1 · contratos (ARDEN-FE-003).
 *
 * Pacote de contratos INDEPENDENTE do frontend: schemas Zod executáveis + tipos
 * derivados + descritores de endpoint. Compartilhado por frontend e (futuro)
 * backend. NÃO depende de React, Zustand ou IndexedDB.
 */

export * from './common';
export * from './endpoint';
export * from './session';
export * from './operations';
export * from './operation-versions';
export * from './authority';
export * from './audit';
export * from './policies';
export * from './approvals';
export * from './enforcement';
export * from './executions';
export { schemaRegistry, endpoints } from './registry';
