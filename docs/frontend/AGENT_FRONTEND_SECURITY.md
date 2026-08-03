# Segurança do frontend de agentes (ARDEN-BE-007.7)

Postura: o browser **nunca** persiste nem vaza segredo, prompt ou instrução de agente.

## Nenhum dado sensível persistido

Nenhum prompt, instrução, schema sensível ou segredo vai para:

- `localStorage`, `sessionStorage`, IndexedDB;
- Zustand persistido / qualquer store de domínio;
- cache do react-query além do necessário à tela (respostas da API não ecoam segredo);
- URL / query string, logs de console, analytics ou erro serializado.

Os formulários (editor de versão, drawer de configuração de modelo) mantêm rascunho
**só em memória transitória** do componente; ao desmontar, o rascunho some. O repositório é
API-only — não há snapshot local de agentes para persistir.

## A API não devolve segredo

As respostas de leitura nunca trazem instrução/segredo de volta. Credenciais de modelo
vivem no cofre (BE-006.4), referenciadas por conexão; não há campo de API key na UI. Chaves
de idempotência são opacas (`crypto.randomUUID`) e **nunca** contêm segredo.

## Esconder-e-proteger + revalidação no backend

As checagens de permissão no cliente (`assertPermission`, `usePermission`) são **defesa de
UX** (hide-and-guard). O backend **revalida** toda ação e todo acesso — a decisão final
nunca é do cliente.

## Teste canário

Um teste canário (ver `src/contracts/agents/secret-canary.contract.test.ts` e os canários
de backend) injeta marcadores sensíveis e verifica que eles **não** aparecem em respostas
serializadas, storage do browser, logs ou payloads. Garante que a superfície de agentes só
expõe campos seguros (status, contadores, hashes, custo estimado).
