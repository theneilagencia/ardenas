<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Inventário atômico de requisitos

**105 requisitos** (100 obrigatórios, 5 opcionais) cobrindo os domínios A–X. Fonte
machine-readable completa (com layers, evidência e status por item):
`arden-scope-001-requirements.json`. Cada `scopeId` é único (validado).

## Distribuição por domínio
| Cód | Domínio | Nº req |
| --- | --- | --- |
| A | Autenticação e sessão | 5 |
| B | Organizações e tenancy | 4 |
| C | Usuários, roles e permissões | 4 |
| D | Operações | 4 |
| E | Versionamento e publicação | 3 |
| F | Autoridade | 3 |
| G | Policies e approvals | 6 |
| H | Work Units | 2 |
| I | Execution engine | 3 |
| J | Workers e filas | 3 |
| K | Connectors | 5 |
| L | Credentials e SecretVault | 4 |
| M | Tools | 3 |
| N | Agents | 5 |
| O | Model configurations | 2 |
| P | Runtime de IA | 4 |
| Q | Usage, custo e avaliação | 4 |
| R | Auditoria e evidências | 3 |
| S | Frontend e UX | 10 |
| T | Contratos de API | 3 |
| U | Persistência e migrations | 3 |
| V | Segurança | 5 |
| W | Infraestrutura e operação | 12 |
| X | Produção e go-live | 5 |

Cada requisito registra: scopeId, domínio, feature, requisito, status, obrigatório, camadas
exigidas e evidência (arquivo/símbolo/teste). Regras aplicadas: um comportamento por
requisito; nenhum requisito inventado sem fonte; `COMPLETE` só quando nenhuma camada
obrigatória falta.
