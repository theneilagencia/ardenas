# Arden.AS — Gap Analysis (v1)

Commit `aad61e5`. Categorias: **A** bloqueia backend · **B** depende do backend ·
**C** regra no lugar errado · **D** decisão de produto · **E** UX · **F** segurança ·
**G** escalabilidade · **H** qualidade. Severidade: bloqueador / crítica / alta /
média / baixa.

## Bloqueadores e críticos

| ID | Gap | Cat | Sev | Módulo | Impacto | Recomendação |
|---|---|---|---|---|---|---|
| GAP-01 | Sem autenticação/sessão/MFA | A | bloqueador | Auth | Nada é seguro; impossível associar ator real | Definir `AuthProvider`/sessão e emissor de token antes de qualquer escrita real |
| GAP-02 | Autorização só no cliente (`can()`) | F | bloqueador | Permissões | URL direta/estado local burlam tudo; `switchProfile` troca papel em memória | Reavaliar toda permissão no servidor por request; tratar cliente como conveniência |
| GAP-03 | Multitenancy só visual (filtro client-side por `organizationId`) | F | bloqueador | Multitenancy | Risco de vazamento entre organizações | Isolar por tenant no servidor a cada request; não confiar no header enviado |
| GAP-04 | Execução é síncrona/instantânea | A | crítica | Execuções | Não há fila/estado assíncrono/retry/timeout/idempotência | Engine assíncrona server-side com máquina de estados persistida |
| GAP-05 | Auditoria mutável em memória | F | crítica | Auditoria/Evidências | Eventos podem ser fabricados/alterados no cliente | Log append-only, imutável, com hash/correlação no backend |
| GAP-06 | Versões publicadas editáveis | A | crítica | Versionamento | Nada impede alterar uma versão publicada; execução/aprovação não fixam versão | Congelar versão publicada; vincular execução e aprovação ao `version` imutável |
| GAP-07 | UI não consome a camada de contrato | C | crítica | Serviços | Trocar para `api` não passa a escrever no backend (store mantém memória) | Rotear mutações da store pelos repositórios do container quando `provider=api` |
| GAP-08 | Modo `api` não hidrata no bootstrap | C | crítica | Serviços | `store` usa `emptySnapshot` em modo api (não chama `ApiDataProvider.load`) | Chamar `load()` no bootstrap em modo api |
| GAP-09 | Aprovações sem anti-fraude/concorrência | F | crítica | Aprovações | Solicitante pode aprovar; sem vínculo à versão; duplo-clique duplica | Regras server-side: proibir self-approval, exigir versão, optimistic locking |
| GAP-10 | Work Units/orçamento não transacionais | A | crítica | WU/Orçamento | Débito/crédito local, `number` sem moeda/decimal seguro | Ledger transacional no backend; inteiros de menor unidade + moeda |

## Altos

| ID | Gap | Cat | Sev | Módulo | Impacto | Recomendação |
|---|---|---|---|---|---|---|
| GAP-11 | Gradientes de Autoridade não alteram comportamento | A | alta | Autoridade | Matriz é display estático; não bloqueia ação nem exige aprovação | Ligar `authorityLevel` a execução, aprovação e limites (domínio já tem o enum) |
| GAP-12 | Wizard: maioria das 20 etapas é visual | E/A | alta | Wizard | Só ~7 etapas têm campos funcionais; muitos campos do domínio não são configuráveis | Completar campos por etapa e mapear cada um a domínio+contrato |
| GAP-13 | Integrações simuladas | B | alta | Integrações | "Conectar/Testar" apenas troca estado local | Conectores reais (OAuth/credenciais/teste) no backend |
| GAP-14 | Sem upload real de contexto/arquivos | B | alta | Contexto/Arquivos | Não há URL pré-assinada nem binário | Endpoint de assinatura + storage |
| GAP-15 | Escrita HTTP só em 3 domínios | A | alta | Serviços | 20+ domínios sem contrato de escrita | Estender repositórios por domínio conforme o contrato |
| GAP-16 | Módulo de Agentes ausente | D | alta | Agentes | Produto prevê agentes; não há entidade nem tela | Definir domínio de Agentes (tipo, provedor, modelo, ferramentas, autoridade, custo) |
| GAP-17 | Resultados/Assessment/Avaliador estáticos | B/D | alta | Resultados/Avaliação | Indicadores e avaliações são seed; Avaliador não persiste | Medição real + persistência do assessment |
| GAP-18 | Sem tela de Organizações/Config real | D | alta | Admin | `/organizations` redireciona; sem CRUD de org/empresa/unidade | Definir e construir a administração de estrutura |

## Médios / baixos

| ID | Gap | Cat | Sev | Módulo | Impacto | Recomendação |
|---|---|---|---|---|---|---|
| GAP-19 | Sem paginação/ordenção/filtro server-side | G | média | Listas | Listas carregam tudo em memória | Paginação real nos contratos de lista |
| GAP-20 | Cliente HTTP sem retry/timeout/idempotency/ETag | H | média | Serviços | Robustez insuficiente para produção | Adicionar timeout, retry idempotente, `Idempotency-Key`, `If-Match` |
| GAP-21 | Cobertura E2E/a11y estreita | H | média | Testes | Só wizard/implantação/⌘K/drawer em E2E; axe em 1 tela | Ampliar E2E aos módulos admin/execução; axe por módulo |
| GAP-22 | Bundle único ~744 kB (warning de build) | G | média | Build | Carga inicial pesada | Code-splitting por rota |
| GAP-23 | PWA cacheia shell offline para dados sensíveis | F | média | PWA | `navigateFallback` + IndexedDB retêm dados após logout | Estratégia de cache por tenant + limpeza no logout (ver §PWA) |
| GAP-24 | Notificações/busca global sem backend | B | baixa | Núcleo | Notificações vêm do seed; busca abre ⌘K | Feed real + índice de busca |
| GAP-25 | Dependência dev `brace-expansion` (12 high) | H | baixa | Tooling | Só dev/build, fora do bundle | Acompanhar upstream; sem conserto limpo hoje |
| GAP-26 | Equipes sem tela própria | D | baixa | Pessoas | `Team` existe no seed, sem UI | Definir gestão de equipes |

## Regras de negócio que devem migrar para o backend (GAP-C)

Hoje residem no frontend (store/domínio) e são conveniência, não barreira:
- Bloqueadores de publicação (`domain/operation-blockers.ts`)
- Cálculo/estimativa de Work Units e débito de orçamento (`store.startExecution`)
- Geração de evidência por etapa e transições de execução
- Aplicação de política e Gradiente de Autoridade
- Verificação de dois aprovadores para exclusão de arquivo
- Isolamento entre organizações (`hooks/use-session.ts`)

Todas devem ser **reimplementadas e impostas no servidor**; a versão do frontend
permanece apenas como ergonomia.
