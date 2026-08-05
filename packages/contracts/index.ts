/**
 * @arden/contracts — re-export dos contratos da API v1 (ARDEN-BE-001).
 *
 * FONTE ÚNICA: `src/contracts` (ARDEN-FE-003). Este package NÃO duplica tipos —
 * apenas reexporta, para que o backend (apps/api) consuma os MESMOS contratos do
 * frontend, sem divergência. O backend importa `@arden/contracts`.
 */

export * from '../../src/contracts';
