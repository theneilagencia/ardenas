# Catálogo canônico de providers de modelo (ARDEN-BE-007.2)

Fonte canônica em código (`@arden/contracts` → `MODEL_PROVIDER_DEFINITIONS`), projetada
para o banco pela função pura `runModelProviderCatalogProjection` (reutilizada pelo seed e
pelo `ModelProviderCatalogProjector` Nest). Idempotente: cria ausentes, atualiza campos
system-managed só quando o `catalogHash` (SHA-256 canônico) muda, marca removidos como
`DEPRECATED` (nunca apaga), não toca dados tenant. IDs estáveis; `(key, version)` único.

Provider inicial: **`internal.test-model`** — `productionAllowed=false`, `systemManaged=true`,
capabilities `STRUCTURED_OUTPUT`/`TOOL_CALLING`. **Runtime ainda inexistente**: útil apenas
para futuras fases de teste determinístico; permanece catalogado em produção mas não é
ativável/publicável lá. Nenhum provider comercial real é adicionado nesta fase.
