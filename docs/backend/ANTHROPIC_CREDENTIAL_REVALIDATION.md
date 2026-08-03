# Anthropic — revalidação de credencial após rotação (ARDEN-BE-008.4)

> A verificação smoke `PASSED` está atada à **versão de credencial**. Rotação/revogação cria
> uma nova versão sem o metadado de verificação → o smoke é invalidado automaticamente e um
> novo é exigido. Sem fallback para a credencial antiga. Fonte: código do 008.4. Complementa
> `ANTHROPIC_CREDENTIAL_ROTATION.md`.

## 1. Onde vive a verificação (VERIFIED)

Ao passar (`PASSED`), o smoke grava nos metadados da **versão de credencial**:

```
smokeTest = { status: PASSED, credentialVersionId, modelId, at }
```

Não há migração nova: a verificação vive no metadado da versão de credencial (não em tabela
separada). A execução normal de agente exige que a versão de credencial **ativa** carregue esse
metadado (ver `ANTHROPIC_NON_PROD_ENABLEMENT.md`).

## 2. Rotação invalida o smoke (VERIFIED)

Rotação (ou revogação seguida de nova credencial) cria uma **nova** versão de credencial
**sem** o metadado `smokeTest`. Efeito automático:

- a verificação anterior deixa de valer (estava atada à versão antiga, agora inativa);
- a nova versão **não** tem smoke `PASSED` → execução normal de agente é negada até novo smoke;
- é preciso rodar `npm run smoke:anthropic` de novo contra a nova versão.

O teste `rotation invalidates smoke` comprova essa invalidação offline.

## 3. Sem fallback para credencial antiga (ARCHITECTURAL_DECISION)

O sistema **não** reutiliza a versão de credencial anterior (nem seu smoke) após rotação. A
verificação é sempre da versão **ativa**; a antiga está inativa e sua marca não é herdada. Isso
impede que uma key rotacionada continue "verificada" por herança.

## 4. NUNCA

- herdar o metadado `smokeTest` de uma versão de credencial para outra;
- cair de volta para a versão de credencial antiga (ou seu smoke) após rotação/revogação;
- executar agente normal com versão de credencial ativa **sem** smoke `PASSED`;
- tratar rotação como preservadora de verificação — ela sempre exige novo smoke.
