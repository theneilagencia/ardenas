<!-- Milestone: ARDEN-PRD-001.2A -->
# ARDEN-PRD-001.2A — Rede privada e controle de egress

Decisão **proposta** e provider-neutra. Fatos remetem a S6 do
`ARDEN_PRD_001_2A_SOURCE_REGISTER.md`. Invariantes do produto: **banco não público**,
**egress padrão DENY**, **Anthropic bloqueado**.

## Duas camadas de defesa (complementares, não substitutas)

1. **Camada de aplicação (já existente — ARDEN-BE-006.5):** `SecureHttpClient` + SSRF
   guard + network policy + IP classifier. Bloqueia destinos privados/inesperados e é a
   base da segurança de saída no nível do processo.
2. **Camada de plataforma (esta decisão — a implementar em 001.2B):** rede privada +
   firewall de egress **default DENY** + allowlist explícita. Adiciona controle
   independente do processo; sobrevive a bugs de aplicação.

A decisão de infraestrutura **acrescenta** a camada 2 — não remove a camada 1.

## Topologia proposta

- **Banco não público:** PostgreSQL só acessível pela rede privada (subnets privadas /
  VNet / 6PN). Sem IP público; sem exposição direta à internet.
- **API/worker em rede privada;** apenas o ingress necessário (ex.: front-door/LB) é público.
- **Egress padrão DENY** para todo o compute; allowlist explícita mínima:
  - banco (rede privada);
  - secret manager (endpoint privado/serviço gerenciado);
  - registro de imagem (pull no deploy);
  - observabilidade (Sentry/Grafana/coletor) — endpoint específico;
  - **destinos de conector aprovados** (quando/where houver execução de tool externa —
    ainda restrito pelo SSRF guard da camada 1).
- **Anthropic:** **bloqueado** por allowlist (não consta) **e** por provider DISABLED na
  aplicação — bloqueio em duas camadas.

## Suporte por plataforma (S6)

| Recurso | AWS (A) | GCP (B) | Azure (C) | PaaS (D) |
| --- | --- | --- | --- | --- |
| Rede privada | VPC + subnets privadas | VPC + PSA/PSC | VNet + Private Link | 6PN / rede privada (S6.2/S6.4) |
| Banco não público | Subnet privada + SG | IP privado | Private Link | Restrição de IP/privado (reconfirmar) |
| Egress default DENY | SG/NACL + egress rules | Firewall + Cloud NAT | NSG + Azure Firewall | Network Policies deny-all (S6.1) |
| Allowlist de saída | Endpoints/prefix lists | Firewall egress | Firewall rules | Regras explícitas por direção |

> Fly.io: ao criar regra numa direção, o default daquela direção vira **deny all** (S6.1)
> — modelo alinhado ao requisito. Render/Railway: rede privada out-of-the-box (S6.3/S6.4);
> **reconfirmar** granularidade de egress DENY antes de assumir para produção.

## Requisito de residência (jurídico)

A **região** da rede/banco e a rota de egress têm implicação de **residência de dados** e
transferência internacional → `REQUIRES_LEGAL_REVIEW` (S8). Não decidido aqui.

## Itens de IMPLEMENTAÇÃO (001.2B — não feitos nesta fase)

1. Provisionar rede privada; colocar banco sem IP público.
2. Aplicar egress **default DENY** + allowlist mínima acima.
3. Provar, por teste, que: (a) banco não é alcançável da internet; (b) egress a destino
   fora da allowlist é negado; (c) Anthropic é inalcançável.
4. Endpoints privados para secret manager e registro, quando disponíveis.

## Estado atual

- Camada 1 (aplicação): **entregue** (BE-006.5). Camada 2 (plataforma):
  **STILL_OPEN** (001.2B). Gate "Rede privada + egress deny" permanece **MISSING**.
- Bloqueio Anthropic: **mantido** (DISABLED na app; ausente da allowlist proposta).
