# Arden.AS — Contratos de API

O frontend consome interfaces, nunca `fetch` direto. Cada domínio tem `MockRepository`, `IndexedDbRepository` e `ApiRepository` implementando o mesmo contrato.

Troca por configuração:

```
VITE_DATA_PROVIDER=indexeddb   # demonstração
VITE_DATA_PROVIDER=api         # produção
```

Componentes não sabem qual implementação está ativa.

## Envelope de resposta

```ts
interface ApiResponse<T> {
  data: T
  meta?: { page?: number; pageSize?: number; total?: number }
}
```

## Padrão de erro

```ts
interface ApiError {
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
  correlationId?: string
  details?: unknown
}
```

Mapeamento obrigatório no cliente HTTP:

| HTTP | Tratamento no frontend |
|---|---|
| 400 | Erro de validação, exibir por campo |
| 401 | Sessão expirada, redirecionar ao login |
| 403 | Acesso negado, tela com perfil atual e responsável que concede |
| 404 | Objeto inexistente, estado vazio explicativo |
| 409 | Conflito, oferecer recarregar e comparar |
| 422 | Regra de negócio, exibir justificativa do bloqueio |
| 429 | Limite excedido, informar janela de espera |
| 500 | Erro interno, com `correlationId` visível para suporte |
| 503 | Serviço indisponível, oferecer nova tentativa |

## Endpoints

```
GET    /organizations
POST   /organizations
GET    /companies
POST   /companies

GET    /people
POST   /people
PATCH  /people/:id
POST   /people/:id/suspend
POST   /people/:id/reactivate

GET    /roles
POST   /roles
PATCH  /roles/:id

GET    /operations
POST   /operations
GET    /operations/:id
PATCH  /operations/:id
POST   /operations/:id/publish
POST   /operations/:id/execute
POST   /operations/:id/pause
POST   /operations/:id/resume
GET    /operations/:id/versions

GET    /executions
GET    /executions/:id
POST   /executions/:id/pause
POST   /executions/:id/resume

GET    /approvals
POST   /approvals/:id/approve
POST   /approvals/:id/reject
POST   /approvals/:id/request-changes
POST   /approvals/:id/delegate

GET    /exceptions
POST   /exceptions/:id/resolve
POST   /exceptions/:id/reprocess

GET    /evidence
GET    /evidence/:id

GET    /policies
POST   /policies
PATCH  /policies/:id
POST   /policies/:id/submit
POST   /policies/:id/publish
POST   /policies/:id/suspend

GET    /risks
POST   /risks
PATCH  /risks/:id

GET    /integrations
POST   /integrations/:id/connect
POST   /integrations/:id/test
POST   /integrations/:id/renew
POST   /integrations/:id/disconnect
GET    /integrations/:id/logs

GET    /context-sources
POST   /context-sources
PATCH  /context-sources/:id
POST   /context-sources/:id/version

GET    /files/repositories
POST   /files/analyze
GET    /files/candidates
POST   /files/:id/quarantine
POST   /files/:id/restore
POST   /files/:id/request-deletion
POST   /files/:id/approve-deletion

GET    /work-units
GET    /budgets
POST   /work-units/request
POST   /work-units/:id/approve

GET    /environments
POST   /environments/:id/promote
POST   /environments/:id/rollback

GET    /audit-events
GET    /audit-events/:id
GET    /reports
POST   /reports/:id/export

GET    /notifications
POST   /notifications/read
POST   /assistant/context
```

## Exemplo de contrato

```ts
export interface OperationsRepository {
  list(params?: OperationQuery): Promise<PaginatedResult<Operation>>
  getById(id: string): Promise<Operation>
  create(input: CreateOperationInput): Promise<Operation>
  update(id: string, input: UpdateOperationInput): Promise<Operation>
  publish(id: string): Promise<Operation>
  pause(id: string): Promise<Operation>
  resume(id: string): Promise<Operation>
  createExecution(id: string, opts?: { test: boolean }): Promise<Execution>
  archive(id: string): Promise<void>
}
```

Todo método aceita `AbortSignal` opcional para cancelamento.

## O que o backend precisa produzir

Além dos endpoints, o backend é responsável por:

- **Evento de auditoria em toda alteração de estado.** O frontend registra localmente na demonstração; em produção a fonte da verdade é o backend.
- **Cálculo de Work Units.** A estimativa do wizard é indicativa; o consumo real é apurado no servidor.
- **Processamento assíncrono da execução.** O frontend acompanha por polling ou websocket, nunca executa.
- **Aplicação de política e gradiente.** A validação no frontend é conveniência; a barreira real é no servidor.
- **Retenção e descarte.** Prazos de retenção e expurgo são responsabilidade do backend.
- **Webhooks de gatilho.** Eventos externos que iniciam operações.
