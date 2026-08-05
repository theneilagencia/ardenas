<!-- Milestone: ARDEN-PRD-001 -->
# ARDEN-PRD-001 — Incident response

Estado atual: **NOT FOUND**. Classificação: **MISSING / P1**.

## Ciclo
```
detect → classify → contain → recover → communicate → review (postmortem)
```

## Severidades
| Sev | Definição | Exemplo | Resposta |
| --- | --- | --- | --- |
| SEV-1 | indisponibilidade/violação crítica | API/DB down, exposição de dados, cross-tenant, master key comprometida | on-call imediato, war room |
| SEV-2 | degradação séria | 5xx alto, latência acima do SLO, worker down | on-call, mitigação rápida |
| SEV-3 | impacto limitado | job preso, alerta de recurso | horário comercial |
| SEV-4 | baixo/insignificante | ruído, degradação cosmética | backlog |

## Runbooks mínimos (a criar na implementação)
data exposure · cross-tenant risk · API outage · database outage · worker outage · queue
backlog · secret compromise · **master key compromise** · credential decryption failure ·
connector abuse · webhook abuse · unexpected cost · deployment failure.

## Requisitos
- **Owners atribuídos** por área (plataforma, segurança, produto).
- **Comunicação:** canal de incidente + status page + notificação a tenants quando aplicável
  (LGPD/GDPR breach notification — ver privacy).
- **Postmortem** sem culpa para SEV-1/SEV-2, com ações de correção rastreadas.
