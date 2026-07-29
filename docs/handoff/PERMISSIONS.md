# Arden.AS — Matriz de permissões

Oito perfis. Permissão se aplica a rota, componente, botão, campo e exportação — nunca apenas ao menu.

## Motor central

```ts
can({ action: "operation.publish", subject: operation, session })
```

## Perfis e escopo

| Perfil | Pode | Não pode |
|---|---|---|
| Administrador corporativo | Tudo: organizações, pessoas, papéis, políticas, integrações, contexto, orçamento, operações | — |
| Administrador financeiro | Work Units, orçamento, centros de custo, aprovar excedente, relatórios de consumo | Alterar política, publicar operação, administrar papéis |
| Proprietário da operação | Criar e editar operações sob sua responsabilidade, revisar resultados, acompanhar consumo, tratar exceções relacionadas | Administrar outra empresa, alterar papéis, alterar política corporativa |
| Supervisor | Acompanhar execuções, pausar, retomar, comentar, tratar exceções, solicitar reprocessamento | Alterar papéis, alterar configuração da operação, alterar orçamento |
| Aprovador | Aprovar, rejeitar, solicitar ajuste, delegar, adicionar condição | Alterar configuração da operação, orçamento, papel ou política |
| Administrador de segurança | Revisar acessos, configurar políticas, administrar permissões, bloquear ações, revisar integrações, tratar alertas | Alterar orçamento, publicar operação de negócio |
| Analista | Visualizar operações autorizadas, consultar resultados, evidências permitidas, gerar relatórios autorizados | Aprovar ação crítica, editar operação, exportar dado restrito |
| Auditor | Somente leitura em auditoria, evidências, aprovações, versões, resultados e histórico | Qualquer edição |

## Permissões nomeadas

```
organization.view | organization.manage
people.view | people.create | people.edit | people.suspend
role.view | role.manage
operation.view | operation.create | operation.edit | operation.publish | operation.pause
execution.view | execution.start | execution.pause | execution.resume
approval.view | approval.resolve
policy.view | policy.manage | policy.publish
risk.view | risk.manage
integration.view | integration.manage
context.view | context.manage
file.view | file.quarantine | file.restore | file.delete.request | file.delete.approve
security.view | security.manage
budget.view | budget.manage | budget.overage.approve
audit.view | report.export
onboarding.execute
```

## Cenários de bloqueio obrigatórios

Cada um deve ser testado e registrar tentativa negada na auditoria:

1. Auditor tenta editar qualquer campo
2. Analista tenta aprovar ação crítica
3. Aprovador tenta alterar configuração da operação
4. Supervisor tenta alterar papel de usuário
5. Administrador financeiro tenta publicar política
6. Administrador de segurança tenta alterar orçamento
7. Proprietário tenta administrar operação de outra empresa
8. Usuário suspenso tenta acessar qualquer rota
9. Usuário sem permissão tenta exportar dado restrito

## Tela de acesso negado

Deve informar, e o protótipo já informa:

- ação que foi tentada
- perfil atual
- o que esse perfil pode fazer
- permissão necessária
- pessoa ou equipe que pode conceder
- botão de solicitar acesso, que grava na auditoria
- caminho de volta
