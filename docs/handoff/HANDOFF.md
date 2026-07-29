# Handoff: Arden.AS — frontend corporativo

## Sobre este pacote

Os arquivos aqui são **referências de design criadas em HTML**: protótipos que demonstram aparência, comportamento e regras de negócio pretendidos. Não são código de produção para copiar.

A tarefa é **reconstruir estes designs no ambiente de destino** — React 19 + TypeScript + Vite, conforme a stack definida — usando os padrões e bibliotecas daquele projeto. O HTML serve como especificação executável: cada comportamento descrito aqui foi verificado clicando na interface do protótipo.

## Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamento, estados e interações são finais. A reconstrução deve ser fiel ao pixel, usando as bibliotecas do projeto de destino.

## Estado do repositório

`theneilagencia/ardenas` estava vazio no momento deste handoff — sem commits, sem branch materializada. O projeto React precisa ser criado do zero.

## O que precisa ser construído

Aplicação frontend completa, funcional sem backend, com serviços simulados substituíveis por HTTP.

### Stack definida

```
Node 22+ · React 19 · TypeScript · Vite
React Router · TanStack Query · Zustand
React Hook Form · Zod · i18next · date-fns
Dexie (IndexedDB) · vite-plugin-pwa
Recharts · Lucide React · Radix UI
Vitest · Testing Library · Playwright · Axe
ESLint · Prettier
```

Para UI, Radix com componentes próprios, ou shadcn completamente adaptado à identidade do Arden.AS. Não entregar aparência de template.

### Comandos que precisam funcionar

```
npm run dev · build · preview
npm run typecheck · lint
npm run test · test:e2e · test:a11y
```

## Identidade visual

### Cores

```
Claro
--bg      #F7F7F5   fundo
--sf      #FFFFFF   superfície
--mut     #EFEFEC   superfície secundária
--tx      #111111   texto primário
--tx2     #6D6D6A   texto secundário
--bd      #E4E4E0   borda
--ac      #B8F34A   acento
--acFg    #111111   texto sobre acento

Escuro
--bg      #111111
--sf      #181818
--mut     #222222
--tx      #F7F7F5
--tx2     #A3A3A0
--bd      #313131
--ac      #B8F34A

Estados operacionais (claro / escuro)
working    #2878D4 / #6BA6E8
completed  #29845A / #4FB183
waiting    #B7791F / #D9A441
failed     #C54444 / #E28585
paused     #777773 / #8A8A86
```

O acento aparece apenas em CTA principal, foco, seleção e trabalho ativo. Nunca como fundo de seção, gradiente ou brilho.

### Tipografia

Geist Sans para linguagem, Geist Mono para dados operacionais: horas, durações, métricas, identificadores, timestamps. Mono nunca como decoração.

```
Título de módulo   1.5rem   / -0.03em / 550
Título de seção    1.0625rem / -0.018em / 550
Corpo              0.875rem  / 1.55
Rótulo micro       9.5px     / 0.1em / uppercase / mono
Dado numérico      1.45rem   / -0.03em / mono
```

### Geometria

```
Raio: chip 6px · controle 8-9px · cartão 12-14px · pílula 999px
Espaçamento base 4px, inline 8/12/16, bloco 20/24/32
Borda antes de sombra. Elevação só em overlay.
```

### Movimento

```
hover 100-140ms · menu 140-200ms · painel 180-260ms
mudança de estado 200-280ms · progresso 700ms
cubic-bezier(.22,.61,.36,1)
```

Sem confete, partícula, brilho, pulso contínuo ou spinner grande. Tudo suprimido em `prefers-reduced-motion`.

## Linguagem do produto

Regra absoluta: **sempre `Arden.AS`**, nunca `Arden`, `ARDEN`, `Arden AS`, `Arden AI`. Em português com artigo masculino: `o Arden.AS`.

Vocabulário: trabalho, operação, resultado, concluído, revisar, decidir, aprovar, responsável, fonte, evidência, custo, capacidade, limite, SLA, exceção.

Proibido: revolutionary, game-changing, magical, seamless, effortless, powerful, innovative, disruptive, AI-powered, unlock, unleash, exclamação, emoji.

**Token nunca aparece como unidade comercial.** A unidade é Work Unit, capacidade operacional contratada.

## Documentos de especificação

Leia nesta ordem:

1. `DOMAIN_MODEL.md` — entidades, campos obrigatórios, bloqueadores de publicação, Gradientes de Autoridade, estados de execução, herança de política
2. `PERMISSIONS.md` — oito perfis, permissões nomeadas, nove cenários de bloqueio
3. `API_CONTRACTS.md` — endpoints, envelope, padrão de erro, mapeamento HTTP, o que o backend precisa produzir
4. `FRONTEND_BACKEND_INTEGRATION.md` — troca mock para api, divisão de responsabilidade, autenticação, processamento assíncrono

## Protótipos de referência

`mockup.html` — aplicação corporativa, 23 módulos. Abre direto no navegador.

`arden-as-landing-page.html` — landing page pública, 16 seções, pt-BR e en-US.

`arden-as-final/` — o protótipo corporativo sem empacotador, servido por HTTP. Exige rede para React via CDN.

## Comportamento verificado no protótipo

Cada item abaixo foi testado clicando. Reproduzir com este comportamento.

**Wizard de 20 etapas.** Trilho superior clicável para revisar qualquer etapa. Salvar rascunho persiste e é retomável após recarga. A etapa 19 lista bloqueadores; com qualquer um presente, o botão de publicar fica indisponível — impedimento, não aviso.

**Publicação.** Constrói a operação exclusivamente a partir dos dados do formulário. Não clona operação existente. Gera identificador, versão 1.0, entra no catálogo, grava auditoria, abre o detalhe.

**Execução de teste.** Percorre as `steps[]` configuradas na operação, gera evidência por etapa, consome Work Units, debita orçamento, cria aprovação quando a etapa exige, conclui em `awaiting_approval` ou `completed`. Grava dois eventos: execução iniciada e evidência registrada.

**Implantação corporativa.** 16 etapas sequenciais com trava: a etapa N+1 fica bloqueada até N concluir. Cada etapa tem responsável nomeado, ajuda contextual e resultado. Refazer uma etapa desfaz as seguintes. Concluir só habilita com as 16 completas, e grava evento de transição.

**Permissões.** A troca de perfil reconstrói a navegação e o escopo. Auditor recebe 8 módulos em leitura com selo no cabeçalho. Tela de acesso negado informa ação tentada, perfil atual, o que esse perfil pode, permissão necessária e quem concede.

**Arquivos e quarentena.** Candidatos com critério acionado, tamanho, idade e vínculo. Arquivo crítico vinculado a operação ativa não pode ser movido — o botão não existe. Movimentação vai para quarentena com recuperação em 30 dias. Exclusão definitiva existe apenas como solicitação, exigindo dois aprovadores nomeados.

**Matriz de risco.** Avaliação por ação, não por operação. Cada linha traz dado acessado, sistema, consequência, reversibilidade, gradiente e impacto. Classificação sempre em texto ao lado da cor.

**Assistente contextual.** Painel lateral determinístico, composto a partir da store. Em cada módulo informa fatos reais, próximo passo concreto e links que abrem objetos existentes. Sem API externa.

**Auditoria.** Estado anterior e novo em cada evento, com autor, papel, organização e justificativa. Aparece imediatamente na central.

## Pendências conhecidas no protótipo

Não estão prontas, e a reconstrução deve resolvê-las:

- internacionalização en-US no protótipo corporativo (a landing page tem os dois idiomas)
- ações administrativas de Pessoas, Papéis e Políticas gravando na store
- suíte automatizada Vitest, Playwright e Axe
- extração para módulos em `src/`

## Critérios de aceite

A entrega está pronta quando: inicia com `npm install` e `npm run dev`, gera build, instala como PWA, funciona offline com dados demonstrativos, TypeScript sem erros, store global com IndexedDB, contratos de API com repositórios intercambiáveis, wizard com 20 etapas, implantação integrada gravando na store, oito perfis com permissão por ação, pt-BR e en-US completos, assistente contextual lendo a store, testes unitários e E2E executados, documentação de integração.

Nenhum item deve ser declarado aprovado sem o comando correspondente executado.
