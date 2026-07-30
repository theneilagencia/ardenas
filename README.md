# Arden.AS — frontend corporativo

Reconstrução em React 19 + TypeScript + Vite do protótipo corporativo do Arden.AS,
a partir do handoff de design. A aplicação é funcional sem backend: usa serviços
simulados intercambiáveis por HTTP e persiste os dados de demonstração em IndexedDB.

> Regra de linguagem do produto: **sempre `Arden.AS`**. Em português, `o Arden.AS`.
> A unidade comercial é **Work Unit** — token é medida técnica interna e não aparece
> como unidade comercial em nenhuma tela.

## Stack

Node 22+ · React 19 · TypeScript · Vite · React Router · TanStack Query · Zustand ·
React Hook Form · Zod · i18next · date-fns · Dexie (IndexedDB) · vite-plugin-pwa ·
Recharts · Lucide React · Radix UI · Vitest · Testing Library · Playwright · Axe ·
ESLint · Prettier.

## Comandos

```bash
npm install
npm run dev         # servidor de desenvolvimento
npm run build       # typecheck + build de produção (gera PWA)
npm run preview     # serve o build
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint, zero warnings
npm run test        # Vitest — unidade + acessibilidade (jsdom + axe)
npm run test:a11y   # apenas o projeto de acessibilidade
npm run test:e2e    # Playwright (constrói, serve e navega)
```

Nenhum item é declarado aprovado sem o comando correspondente executado.

### Playwright neste ambiente

Se o Chromium estiver pré-instalado num caminho fixo, aponte o executável:

```bash
ARDEN_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

## Configuração de dados

O frontend consome contratos, nunca `fetch` direto. A implementação é resolvida por
variável de ambiente (ver `.env.example`):

```
VITE_DATA_PROVIDER=indexeddb   # demonstração (padrão), persiste offline
VITE_DATA_PROVIDER=mock        # memória, usado em testes
VITE_DATA_PROVIDER=api         # produção, conecta aos endpoints do contrato
```

Nenhum componente sabe qual implementação está ativa. Se a troca exigir alterar um
componente, o contrato está vazando — corrige-se o contrato, não o componente.

## Arquitetura

```
src/
  domain/       modelo de domínio, motor de permissões, bloqueadores, seed
  services/     contratos, cliente HTTP (mapa de erro), Dexie, providers, container
  store/        store global Zustand — fonte da verdade, grava auditoria e persiste
  i18n/         pt-BR e en-US completos
  hooks/        sessão, escopo por organização, avaliação de permissão
  components/   layout (shell, sidebar, topbar, assistente) e primitivos de UI
  features/     dashboard, operações, wizard, execuções, aprovações, implantação,
                arquivos, riscos, auditoria, e módulos mapeados
  app/          registro de módulos e rotas
  styles/       tokens (identidade visual), global, componentes, shell
```

A identidade visual está codificada em `src/styles/tokens.css`: paletas clara e
escura, cores de estado operacional, escala tipográfica (Geist Sans / Geist Mono),
geometria e durações de movimento. O acento (`--ac`) aparece apenas em CTA principal,
foco, seleção e trabalho ativo. Tudo é suprimido em `prefers-reduced-motion`.

## Comportamento verificado

Coberto por testes (`npm run test` e `npm run test:e2e`):

- **Wizard de 20 etapas** com trilho clicável, rascunho retomável e **bloqueio real na
  publicação** — os oito bloqueadores da etapa 19 tornam o botão de publicar
  indisponível (impedimento, não aviso). *(unidade + e2e)*
- **Publicação** que constrói a operação a partir dos dados do formulário, sem clonar,
  gera versão 1.0, entra no catálogo e grava auditoria. *(unidade)*
- **Execução** que percorre as `steps[]` configuradas, gera evidência por etapa,
  consome Work Units, debita orçamento, cria aprovação quando a etapa exige e grava
  dois eventos (execução iniciada e evidência registrada). *(unidade)*
- **Implantação corporativa** em 16 etapas com trava sequencial: a etapa N+1 fica
  bloqueada até N concluir; refazer uma etapa desfaz as seguintes; concluir só habilita
  com as 16 completas. *(unidade + e2e)*
- **Permissões** por perfil (oito perfis), aplicadas a rota, botão e campo; a troca de
  perfil reconstrói navegação e escopo; auditor recebe selo de leitura; tela de acesso
  negado informa ação, perfil, o que o perfil pode, permissão necessária e quem concede,
  gravando a tentativa na auditoria. Os nove cenários de bloqueio são testados. *(unidade)*
- **Arquivos e quarentena** com recuperação em 30 dias; arquivo crítico vinculado a
  operação ativa não pode ser movido (o botão não existe); exclusão definitiva exige
  **dois aprovadores nomeados distintos**. *(unidade)*
- **Ações administrativas gravando na store**, com auditoria por transição: Pessoas
  (convite, troca de papel, suspensão e reativação), Políticas (criação, submissão,
  publicação e suspensão), Integrações (conectar, testar, desconectar), Contexto
  (adicionar fonte e versionar), Work Units (solicitar e aprovar excedente), Orçamento
  (definir teto), Ambientes (promover e reverter com trava de ordem) e Exceções
  (resolver e reprocessar). *(unidade)*
- **Matriz de risco** por ação, com classificação sempre em texto ao lado da cor.
- **Assistente contextual** determinístico, composto a partir da store, sem API externa.
- **Auditoria** com estado anterior e novo em cada evento; a central de Segurança
  destaca as tentativas negadas.
- **Acessibilidade**: a tela de acesso negado passa o axe (WCAG 2 A/AA) sem violações
  críticas ou sérias.

### Os 23 módulos do mockup

A navegação reproduz os 23 módulos do protótipo corporativo, nos cinco grupos:

- **Operação** — Visão geral, Operações (catálogo, detalhe, wizard), Execuções, Aprovações
- **Resultado** — Resultados (portfólio de indicadores com método de obtenção),
  Evidências, Exceções
- **Controle** — Work Units, Gradientes de Autoridade (matriz por ação), Governança
  (políticas com herança, versões e retenção), Matriz de risco, Contexto, Integrações,
  Arquivos
- **Avaliação** — Assessment (Autonomous Work Assessment) e Avaliador (wizard de 12
  etapas de operação autônoma)
- **Empresa** — Implantação, Pessoas e equipes, Segurança, Ambientes, Auditoria,
  Relatórios, Administração (16 áreas administrativas em cinco grupos)

## Pendências conhecidas

Declaradas, não escondidas. Trabalho restante da reconstrução:

- Interações do mockup já implementadas: command palette (⌘K), tour guiado (Modo
  demonstração), aprovações em master-detail com delegar/solicitar ajuste, duplicar
  operação, comparar versões lado a lado, transformar Assessment em operação, e
  painéis de detalhe em *drawer* (Riscos e Evidências).
- Resta estender o padrão de *drawer* aos demais módulos de listagem e aprofundar
  telas específicas conforme necessidade.
- Repositórios por domínio no modo `api` (o cliente HTTP, o mapa de erro e o container
  estão prontos; falta implementar cada endpoint do contrato).
- Ampliar a cobertura E2E e de acessibilidade aos módulos administrativos e de avaliação.
- Alerta Dependabot em `brace-expansion` (GHSA-mh99-v99m-4gvg): cadeia exclusivamente
  de ferramentas de desenvolvimento (ESLint e workbox-build), nunca no bundle entregue.
  O único conserto oferecido pelo npm é subir ESLint para a major 10 (quebra a config);
  fixar a versão via `overrides` quebra o globbing do workbox no build, então o alerta
  fica documentado e adiado até o upstream publicar minimatch corrigido.

## Handoff e referência

- `docs/handoff/` — especificação: `HANDOFF.md`, `DOMAIN_MODEL.md`, `PERMISSIONS.md`,
  `API_CONTRACTS.md`, `FRONTEND_BACKEND_INTEGRATION.md`.
- `docs/reference/` — protótipos originais em HTML (`mockup.html`, `landing-page.html`)
  e o endpoint PHP do formulário (`contato.php`), preservados como referência funcional.
