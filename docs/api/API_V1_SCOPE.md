# Arden.AS — API v1 · Escopo (ARDEN-FE-003)

> Contratos definitivos da API v1. **Sem backend, sem banco, sem autenticação real,
> sem endpoints reais** nesta issue. Fonte única: `src/contracts` → `docs/api/openapi-v1.yaml`.

## Objetivo

Suportar o **primeiro fluxo real**: um usuário autenticado acessa uma organização,
cria uma operação, cria e edita uma versão em rascunho, define seu Gradiente de
Autoridade, publica a versão e consulta a trilha de auditoria — **sem acessar dados
de outra organização**.

## Princípios inegociáveis (resumo)

- Frontend e backend compartilham o **mesmo contrato**; o **backend é a fonte de verdade**.
- O frontend **não envia permissões** e **não define o tenant** arbitrariamente.
- O backend deriva usuário, organização e permissões da **sessão autenticada**.
- Toda entidade organizacional pertence a um **tenant**; toda ação crítica é **auditável**.
- Publicação é **explícita**; versões publicadas são **imutáveis**.
- Atualizações usam **concorrência otimista**; comandos críticos usam **idempotência**.
- Erros **tipados e consistentes**; datas **ISO 8601 em UTC**; valores financeiros com **moeda**; IDs **opacos**.
- API versionada em **`/api/v1`**. Contratos independentes de React/Zustand/IndexedDB.

## No escopo v1

**Identidade e sessão:** sessão atual, usuário autenticado, organizações disponíveis,
organização ativa, memberships, permissões, troca de organização, encerramento e
renovação de sessão.

**Operações:** listar, buscar, criar, editar rascunho (metadados), arquivar, duplicar,
pausar, retomar.

**Versões de operação:** listar, buscar, criar nova versão, editar rascunho, comparar,
publicar, consultar versão publicada.

**Gradiente de Autoridade:** consultar o gradiente da versão, atualizar em rascunho,
validar regras mínimas para publicação (contrato — não autorização final).

**Auditoria:** listar, filtrar, paginar (cursor), consultar detalhe. Eventos são
gerados/validados pelo backend — **sem endpoint público de escrita**.

## Fora do escopo v1 (documentados como futuros)

Agentes; fila/execução assíncrona; integrações reais; Work Units transacionais;
orçamento; billing; arquivos; evidências operacionais; aprovações complexas;
implantação; políticas; riscos; pessoas; convites; MFA; recuperação de senha;
relatórios; notificações; WebSockets; webhooks; marketplace; administração global.

## Números do contrato

- **22 operações** em **17 paths**; **34 schemas** nomeados.
- Áreas: Session (4), Operations (8), OperationVersions (6), Authority (2), Audit (2).

## Estratégia de tenant (path org-scoped)

`/api/v1/organizations/{organizationId}/...` — o path **identifica** o recurso
organizacional; a **autorização é derivada da sessão** e validada no backend. O
`organizationId` do path **não é prova suficiente de acesso**: o backend exige
membership ativa. A única exceção em que `organizationId` aparece em body é
`POST /session/switch-organization` (o alvo da troca, validado contra memberships).
