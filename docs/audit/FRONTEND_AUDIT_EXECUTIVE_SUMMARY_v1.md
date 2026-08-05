# Arden.AS — Resumo Executivo da Auditoria de Frontend (v1)

Commit `aad61e5` · 2026-07-30 · decisão de negócio. Base: código + comandos
executados (todos verdes: 49 testes unit/a11y, 5 E2E, build, typecheck, lint).

## Respostas diretas

- **O que o frontend realmente faz?** Uma aplicação corporativa local, navegável e
  fiel ao protótipo: 23 módulos, wizard com bloqueio real de publicação, execução
  simulada que percorre etapas e consome recursos, implantação com trava sequencial,
  permissões por perfil, quarentena com dois aprovadores, auditoria — tudo em
  Zustand + IndexedDB, sem backend.
- **O que é apenas visual (F1)?** Resultados, Gradientes de Autoridade (matriz),
  Papéis, Assessment, Avaliador, Administração, e ~11 das 20 etapas do wizard.
- **O que é simulado (F2)?** Execuções (síncronas), Integrações (flip local),
  Relatórios (só auditoria), Notificações, troca de perfil/organização.
- **O que funciona localmente (F3)?** Operações, Aprovações, Exceções, Work Units,
  Orçamento, Governança, Contexto, Arquivos, Pessoas, Ambientes, Evidências,
  Segurança, Implantação, Auditoria, Assistente.
- **Módulos mais maduros:** Implantação, Arquivos/quarentena, Aprovações, Operações.
- **Módulos mais incompletos:** Agentes (ausente), Execução assíncrona (ausente),
  Gradientes (não alteram comportamento), Avaliador/Resultados (estáticos).
- **O frontend representa corretamente o Arden.AS?** Em estrutura e vocabulário,
  **sim**; em capacidade executável e de governança **real**, **não** — falta backend.
- **O wizard cria uma operação utilizável?** Cria uma **configuração parcial** com
  bloqueio real; **não** uma definição executável completa (gatilhos/entradas/saídas/
  etapas/indicadores não são configuráveis).
- **As execuções são reais?** **Não** — são simuladas de forma síncrona.
- **Os Gradientes de Autoridade alteram comportamento?** **Quase nada** — só o
  bloqueador de publicação por ação destrutiva. A matriz do módulo é informativa.
- **As permissões são suficientes?** **Não** — são client-side; insuficientes para
  produção por definição.
- **Existe multitenancy real?** **Não** — filtro visual por `organizationId`.
- **Existe segurança de produção?** **Não** — sem auth, autorização server, auditoria
  imutável ou isolamento de tenant.
- **Os contratos estão prontos para API?** **Parcialmente** — envelope, erros, cliente
  HTTP e 3 repositórios prontos e testados, mas **não conectados à UI**.
- **O frontend está pronto para receber backend?** **SIM, COM AJUSTES.**
- **O que corrigir antes?** GAP-06 (imutabilidade de versão), GAP-07/08 (ligar UI ao
  contrato e hidratar em modo api), GAP-05 (auditoria append-only), GAP-11 (autoridade
  efetiva), GAP-12 (campos essenciais do wizard) — ver `FRONTEND_GAPS_v1.md`.
- **Qual o backend v1?** Ver §"Escopo do backend v1".
- **O frontend pode ser preservado?** **Sim** — as mudanças são de integração e
  segurança, não estruturais.
- **Maior risco técnico:** a UI escreve na store, não no contrato; migrar para o
  backend sem rotear a escrita cria divergência silenciosa.
- **Maior risco de produto:** percepção de que operações "executam" e que governança/
  autoridade "funcionam", quando são simuladas/informativas.

## Notas (0–10) — não usar média simples

| Dimensão | Nota | Justificativa curta |
|---|---:|---|
| Aderência ao produto | 8 | Fiel ao mockup e vocabulário; Agentes ausentes |
| Cobertura funcional | 6 | Muitos F3; execução async e Agentes ausentes |
| Maturidade da UX | 7 | Design consistente, ⌘K, drawers; wizard parcial |
| Qualidade do domínio | 6 | Tipos coerentes; `number` p/ dinheiro, sem imutabilidade |
| Qualidade dos contratos | 5 | Bom núcleo; só 3 domínios de escrita, não conectados |
| Segurança | 2 | Client-only, auditoria mutável, sem auth |
| Multitenancy | 2 | Segregação apenas visual |
| Acessibilidade | 5 | Base sólida; axe em 1 tela; manual NÃO COMPROVADO |
| Responsividade | 6 | CSS responsivo; breakpoints não comprovados manualmente |
| Testabilidade | 7 | 49 unit + 5 E2E + CI verdes; cobertura estreita |
| Prontidão para backend | 5 | Contratos existem; regras a migrar; UI não usa contrato |
| Prontidão para produção | 1 | Nenhuma camada de produção |

**Leitura ponderada (não média):** como produto **demonstrável e íntegro em
apresentação**, está forte (7–8). Como **sistema de produção**, está no início
(1–2), limitado pela ausência total de backend, segurança e multitenancy reais. A
prontidão geral é **"pronto para iniciar o backend, com ajustes"** — não "pronto para
produção".

## Comparação README × código (afirmações-chave)

Evidência é o código/testes, não o README.

| Declaração do README | Comprovada | Parcial | Não comprovada | Evidência |
|---|:--:|:--:|:--:|---|
| 23 módulos | ✅ | | | `app/modules.ts`, render headless = 23 |
| Wizard de 20 etapas com bloqueio real | ✅ | | | `new-operation.ts`, `operation-blockers.test.ts`, `e2e/wizard` |
| Publicação cria operação v1.0 sem clonar | ✅ | | | `store.publishOperation`, `app-store.test.ts` |
| Execução percorre `steps[]`, gera evidência, consome WU | | ✅ | | real porém **síncrona/local** (`store.startExecution`) |
| Implantação 16 etapas com trava | ✅ | | | `DeploymentPage`, `e2e/deployment` |
| Oito perfis, nove cenários de bloqueio | ✅ | | | `permissions.ts`, `permissions.test.ts` |
| Arquivos: exclusão exige 2 aprovadores | ✅ | | | `store.approveFileDeletion`, teste |
| i18n pt-BR e en-US completos | ✅ | | | `i18n/locales/*` |
| PWA offline com IndexedDB | ✅ | | | `vite.config.ts`, `db.ts`, `main.tsx` |
| Providers intercambiáveis por `VITE_DATA_PROVIDER` | | ✅ | | providers existem; **UI não usa o contrato**; api não hidrata |
| Auditoria com estado anterior/novo | ✅ | | | `store.recordAudit`, `AuditPage` (mas **mutável**) |
| Gradientes de Autoridade | | ✅ | | matriz existe; **não altera comportamento** |
| Modo `api` (repositórios) | | ✅ | | 3 repos + load testados; sem backend e sem uso na UI |

Nenhuma afirmação do README foi encontrada **contradita** pelo código; várias são
verdadeiras apenas no escopo "demonstração/local", o que o próprio README declara.

## Escopo do backend v1 (proposta, sem implementação)

Alinhado ao primeiro marco (criar operação → versão → autoridade → publicar → auditar,
com isolamento de organização).

**Obrigatório no backend v1**
1. Autenticação + sessão (emissão/validação de token), remoção do profile-switcher em prod.
2. Autorização server-side por request, reusando o vocabulário de `permissions.ts`.
3. Isolamento de tenant por request (não confiar no header do cliente).
4. Organizações/empresas/unidades/áreas + pessoas/papéis (fonte da verdade).
5. Operações: CRUD + rascunho; validação server dos bloqueadores.
6. Versões **imutáveis** após publicação; execução/aprovação fixam a versão.
7. Gradiente de Autoridade **efetivo** (barreira por ação).
8. Auditoria **append-only** imutável.
9. Ligar `ApiDataProvider.load` ao bootstrap e rotear as mutações da store aos
   repositórios do container quando `provider=api` (trabalho de frontend habilitador).

**Posterior ao backend v1 (pode seguir local/simulado)**
Execução assíncrona completa (fila/retry/rollback), Work Units transacional, orçamento
com moeda/decimal, integrações reais, upload de contexto, resultados/medição,
relatórios/exportação, notificações em tempo real.

**Fora de escopo do primeiro marco**
Agentes (exige decisão de produto e domínio novo), BI avançado, offline seguro por
tenant, multi-região.

## Recomendação

Preservar o frontend. Antes de construir a API: resolver GAP-06/07/08/05/11/12 e
definir auth/tenant (GAP-01/02/03). O primeiro marco é **parcialmente suportado** hoje
e torna-se plenamente suportável com o backend v1 acima. **Não** classificar nenhum
módulo como pronto para produção (F5) até existir backend real.
