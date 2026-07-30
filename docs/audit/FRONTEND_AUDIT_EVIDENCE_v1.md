# Arden.AS — Evidências da Auditoria de Frontend (v1)

Registro reproduzível de comandos, resultados e evidências de código. Nenhuma
afirmação de prontidão neste pacote foi feita sem execução ou leitura de código
correspondente. Onde não foi possível comprovar, consta `NÃO COMPROVADO`.

## 1. Preparação do ambiente

| Campo | Valor |
|---|---|
| Repository | https://github.com/theneilagencia/ardenas |
| Branch | `claude/spec-functional-reference-5wxll1` |
| Commit SHA | `aad61e5fb47dab759913f2f48df8ab7b44859b8a` |
| Audit date (UTC) | 2026-07-30T11:35:57Z |
| Node version | v22.22.2 (engines: `>=22` em `package.json`) |
| Package manager | npm 10.9.7 (único lockfile: `package-lock.json`) |
| Default data provider | `indexeddb` (`.env.example` + `src/services/service-container.ts` `resolveKind()`) |
| Working tree status | limpo (`git status --porcelain` vazio no início) |

## 2. Comandos executados

Scripts reais lidos de `package.json`:
`dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `test:watch`,
`test:e2e`, `test:a11y`.

| Comando | Executado | Status | Duração | Aprovados | Reprovados | Warnings | Observação |
|---|---|---|---|---|---|---|---|
| `npm ci --no-audit --no-fund` | sim | PASS | ~19s | — | — | — | Lockfile **não** alterado (`git status` limpo após) |
| `npm run typecheck` (`tsc -b --noEmit`) | sim | PASS | ~6s | — | — | 0 | Sem erros de tipo |
| `npm run lint` (`eslint . --max-warnings=0`) | sim | PASS | ~5s | — | — | 0 | Zero warnings (limiar 0) |
| `npm run test` (`vitest run`) | sim | PASS | ~4s | 49 | 0 | — | 6 arquivos de teste |
| `npm run test:a11y` (`vitest run --project a11y`) | sim | PASS | ~2s | 1 | 0 | — | axe-core em 1 tela (acesso negado) |
| `npm run build` (`tsc -b && vite build`) | sim | PASS | ~16s | — | — | 1 | Warning "chunk > 500 kB" (bundle único ~744 kB) + PWA gerado (`sw.js`, `manifest.webmanifest`) |
| `npm run test:e2e` (`playwright test`) | sim | PASS | ~23s | 5 | 0 | — | Chromium via `ARDEN_CHROMIUM_PATH` (pré-instalado no ambiente) |
| `npm audit` | sim | — | — | — | — | — | 12 high, 0 critical/moderate/low (ver §6) |

Resumo de vulnerabilidades (`npm audit --json` → `metadata.vulnerabilities`):
`{"info":0,"low":0,"moderate":0,"high":12,"critical":0,"total":12}`.

## 3. Suíte de testes (arquivos e cobertura)

| Arquivo | Tipo | Alvo |
|---|---|---|
| `src/domain/permissions.test.ts` | unit | `can()` + os 9 cenários de bloqueio + escopo por organização |
| `src/domain/operation-blockers.test.ts` | unit | 8 bloqueadores de publicação da etapa 19 |
| `src/store/app-store.test.ts` | unit | execução percorrendo `steps[]`, publicação, trava da implantação, 2 aprovadores em arquivos, ações admin, duplicar, assessment→operação |
| `src/services/providers.test.ts` | unit | `ApiDataProvider.load` (fetch mockado) + mapeamento de erro HTTP |
| `src/services/repositories/repositories.test.ts` | unit | `ApiOperationsRepository`, `ApiApprovalsRepository`, `ApiFilesRepository`, `StoreOperationsRepository` |
| `src/features/access-denied.a11y.test.tsx` | a11y | axe (WCAG 2 A/AA) na tela de acesso negado |
| `e2e/wizard.spec.ts` | e2e | bloqueio real da publicação no wizard |
| `e2e/deployment.spec.ts` | e2e | trava sequencial da implantação |
| `e2e/command-palette.spec.ts` | e2e | ⌘K abre/filtra/navega |
| `e2e/detail-drawer.spec.ts` | e2e | drawer de detalhe na matriz de risco |

Cobertura de teste é **funcional/comportamental** (não há relatório de cobertura de
linhas configurado). Módulos administrativos e de avaliação **não** têm E2E dedicado.

## 4. Evidências de arquitetura (greps executados no SHA auditado)

### 4.1. Nenhum componente de UI consome os repositórios do container
Comando: `grep -rn "getOperationsRepository\|getApprovalsRepository\|getFilesRepository\|StoreOperationsRepository\|ApiOperationsRepository" src/features src/components src/hooks`
Resultado: **nenhum uso na UI**. Os repositórios existem apenas em
`src/services/service-container.ts`, `src/services/repositories/*` e nos testes.
Consequência: a UI escreve **direto na store** (`useAppStore`), não pelo contrato.

### 4.2. Nenhuma chamada HTTP fora da camada de serviços
Comando: `grep -rn "fetch(\|axios\|new WebSocket\|EventSource" src | grep -v src/services/`
Resultado: **nenhuma**. O único `fetch` está em `src/services/api-client.ts`.
Não há WebSocket/EventSource/polling implementados (execução assíncrona é inexistente).

### 4.3. Superfície de segurança do cliente
- `dangerouslySetInnerHTML` / `eval(`: **nenhum** (`grep -rn` sem resultado).
- `localStorage`/`sessionStorage`: **somente** preferência de idioma em
  `src/i18n/index.ts` (linhas 12–13, 31). Nenhum dado sensível.
- Fluxo de autenticação (`login`, `authProvider`, `getSession`, `password`, `jwt`,
  `bearer`): **nenhum**. O `ApiClient` (`src/services/api-client.ts`) tem um
  `getToken?()` opcional nas opções, mas **não é populado por nenhum fluxo real**.

### 4.4. Store como fonte da verdade; persistência no modo api é no-op
`src/store/app-store.ts`:
- linha 176: `if (provider.kind === 'api') return;` no `persist()` — mutações **não**
  são enviadas ao backend no modo api; ficam só em memória.
- linha 199: `const data = provider.kind === 'api' ? emptySnapshot : await provider.load();`
  — no bootstrap em modo api, o snapshot inicia **vazio** (o `ApiDataProvider.load`
  existe e é testado, mas o store **não o chama** no bootstrap).
- linha 220: `switchProfile` troca o papel da sessão em memória (impersonation de
  demonstração), atrás da flag `VITE_ENABLE_PROFILE_SWITCHER` (`Topbar.tsx:34`).
- 16 arquivos em `src/features/**` importam `useAppStore` (acesso direto à store).

### 4.5. Rotas e navegação
`src/app/routes.tsx` — 30 entradas `path:` + rota index + guardas
`RequirePermission` (29 ocorrências). `src/app/modules.ts` — 23 módulos de menu
(confirmado por render headless = 23 links de navegação).

## 5. Configuração relevante

| Item | Evidência |
|---|---|
| PWA | `vite.config.ts` `VitePWA({ registerType:'autoUpdate', workbox:{ globPatterns, navigateFallback:'/index.html' } })`; `src/main.tsx:10` `registerSW({ immediate:true })` |
| Providers de dados | `VITE_DATA_PROVIDER` ∈ {`mock`,`indexeddb`(default),`api`} — `service-container.ts` `resolveKind()` |
| i18n | `src/i18n/index.ts` (pt-BR + en-US), idioma persistido em `localStorage` |
| Alias | `@` → `src` (`vite.config.ts`, `tsconfig.app.json`) |
| CI | `.github/workflows/ci.yml` — job `verify` (typecheck/lint/test/build) + job `e2e` |

## 6. `npm audit` — detalhe

12 vulnerabilidades **high**, todas na cadeia transitiva de `brace-expansion`
(GHSA-mh99-v99m-4gvg, DoS por expansão) via `eslint`, `minimatch`, `workbox-build` —
**exclusivamente ferramentas de desenvolvimento/build**, ausentes do bundle entregue.
O único conserto oferecido pelo npm é subir ESLint para a major 10 (quebra a config
flat); um `overrides` para a linha 2.x quebra o globbing do `workbox-build` no build
(testado previamente). Registrado como informativo/dev — não corrigido nesta auditoria.

## 7. Método e limites

- Análise baseada em **leitura de código e execução de comandos**, não no README.
- Não foi possível abrir a aplicação em navegador interativo manual dentro desta
  etapa; onde a verificação exigiria interação humana visual (contraste fino, leitor
  de tela real), consta `NÃO COMPROVADO` e a evidência disponível (axe automático,
  render headless anterior) é citada como parcial.
- Nenhum arquivo existente foi modificado. Apenas `docs/audit/*` foi criado.
