# Taxonomia de Ações de Autoridade — v1 (ARDEN-BE-004)

Taxonomia **estável e fechada** de ações governáveis. O contrato (`actionKey`, enum)
rejeita qualquer valor fora desta lista — não há texto livre. Cada ação pertence a uma
**camada de capacidade** (tier) e pode ser **destrutiva**.

## Camadas

- **READ** — leitura; nunca efetiva mudança.
- **PREPARE** — preparo/rascunho; não efetiva a ação no mundo.
- **EXECUTE** — efetiva a ação (envio, execução financeira, concessão de acesso, etc.).

## Tabela canônica

| actionKey              | Tier    | Destrutiva |
| ---------------------- | ------- | ---------- |
| `data.read`            | READ    | não        |
| `data.write`           | PREPARE | não        |
| `record.create`        | PREPARE | não        |
| `record.update`        | PREPARE | não        |
| `record.delete`        | EXECUTE | **sim**    |
| `document.generate`    | PREPARE | não        |
| `communication.prepare`| PREPARE | não        |
| `communication.send`   | EXECUTE | não        |
| `approval.request`     | PREPARE | não        |
| `financial.prepare`    | PREPARE | não        |
| `financial.execute`    | EXECUTE | **sim**    |
| `access.grant`         | EXECUTE | não        |
| `access.revoke`        | EXECUTE | **sim**    |
| `integration.invoke`   | EXECUTE | não        |
| `operation.pause`      | EXECUTE | **sim**    |
| `operation.resume`     | EXECUTE | não        |

A classificação vive em `apps/api/src/enforcement/authority-evaluation.ts`
(`ACTION_TIER`, `DESTRUCTIVE_ACTIONS`) e é a mesma consumida pelo motor e pelos testes.

## Regras derivadas

- Ação **destrutiva** exige `destructiveActionsAllowed` no perfil; caso contrário é
  negada (`DESTRUCTIVE_NOT_ALLOWED`), independentemente do nível.
- Quando o perfil declara `allowedActions`, uma ação **EXECUTE não declarada** é negada
  (`ACTION_NOT_DECLARED`). Ações READ nunca são negadas por não estarem declaradas.
- O nível efetivo de uma ação declarada é o `semanticLevel` da própria ação; sem
  declaração, usa-se o `level` da versão.
