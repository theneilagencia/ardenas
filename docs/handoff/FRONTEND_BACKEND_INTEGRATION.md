# Arden.AS — Guia de integração com o backend

## Como trocar mock por API

Uma variável de ambiente:

```
VITE_DATA_PROVIDER=api
VITE_API_BASE_URL=https://api.exemplo.com/v1
```

O container de serviços resolve a implementação:

```ts
// services/service-container.ts
const provider = import.meta.env.VITE_DATA_PROVIDER
export const operations: OperationsRepository =
  provider === 'api'
    ? new ApiOperationsRepository(apiClient)
    : new IndexedDbOperationsRepository(db)
```

Nenhum componente, página, hook de UI ou formulário muda. Se a troca exigir alterar componente, o contrato está vazando — corrija o contrato, não o componente.

## Divisão de responsabilidade

### Permanece no frontend

- validação de formato e obrigatoriedade (Zod), como conveniência
- estado de interface: filtros, ordenação, abas, painéis
- composição de telas e navegação
- formatação regional de data, número e moeda
- estimativa indicativa de Work Units no wizard
- respostas determinísticas do assistente contextual

### Pertence ao backend

- **autoridade real.** Gradientes e políticas são barreira de servidor. A validação no frontend é ergonomia, não segurança.
- **cálculo de Work Units** e débito de orçamento
- **execução da operação**, assíncrona, com progressão de etapas
- **evento de auditoria** em toda alteração de estado, como fonte da verdade
- **retenção e expurgo** de evidências e arquivos
- **exclusão de arquivo**, com verificação dos dois aprovadores
- **sessão, MFA e revogação**
- **isolamento entre organizações**, verificado no servidor a cada requisição

## Autenticação

O protótipo usa seletor de perfil como impersonation de demonstração. Em produção:

```ts
interface AuthProvider {
  getSession(): Promise<Session | null>
  login(credentials: LoginInput): Promise<Session>
  logout(): Promise<void>
  refresh(): Promise<Session>
}

interface Session {
  personId: string
  organizationId: string
  companyId?: string
  roleIds: string[]
  permissions: Permission[]
  expiresAt: string
}
```

O seletor de perfil deve ficar atrás de flag e não existir em produção.

## Organizações

Toda requisição carrega a organização ativa, em header:

```
X-Arden-Organization: org_123
```

O servidor valida se a sessão tem acesso àquela organização. Não confiar no valor enviado.

## Processamento assíncrono

Iniciar execução retorna imediatamente com o objeto em `preparing`. O frontend acompanha por:

- **polling** em `GET /executions/:id` com intervalo crescente, ou
- **websocket** em `/executions/:id/stream` para transições de etapa

Não bloquear a interface esperando conclusão. A operação pode levar horas — a interface, não.

## Uploads

Contexto e arquivos usam URL pré-assinada:

1. `POST /uploads/sign` retorna URL e campos
2. cliente envia direto ao armazenamento
3. `POST /context-sources` referencia a chave retornada

Não trafegar binário pela API principal.

## Webhooks

Gatilhos externos que iniciam operação:

```
POST /webhooks/:operationId/:token
```

Verificação por assinatura HMAC. O token é por operação e revogável.

## Notificações

O backend produz; o frontend consome por `GET /notifications` e marca lidas. Canal em tempo real é opcional.

## O que já está pronto no protótipo

Verificado por interação real, e reaproveitável como especificação:

- wizard de 20 etapas com bloqueadores de publicação
- publicação criando operação a partir dos dados do formulário, sem clonar
- execução de teste percorrendo as etapas configuradas, gerando evidência e consumindo Work Units
- implantação corporativa em 16 etapas sequenciais com auditoria por etapa
- oito perfis alterando navegação e escopo
- tela de acesso negado com permissão necessária e responsável
- assistente contextual determinístico lendo dados reais
- arquivos e quarentena com exclusão definitiva exigindo dois aprovadores
- matriz de risco por ação, com classificação em texto
- central de auditoria com estado anterior e novo

## O que falta, e não vou fingir que está pronto

- internacionalização en-US no protótipo corporativo
- ações administrativas de Pessoas, Papéis e Políticas gravando na store
- suíte automatizada Vitest, Playwright e Axe
- extração para módulos em `src/`
