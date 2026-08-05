<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# Manifesto de artefato imutável

Ferramenta: `tooling/infrastructure/artifact-manifest.ts`; comandos `npm run artifact:build`
/ `npm run artifact:verify`. Saída em `config/infrastructure/artifact-manifest.json`
(**git-ignored** — regenerado por SHA).

## Campos
`commitSha` · `buildTimestamp` · `applicationVersion` · `frontendArtifactHash` ·
`apiArtifactHash` · `openApiHash` · `migrationCount` (11) · `runtimeDependenciesHash`.

## Invariantes (verify)
- `commitSha` presente (≥7); **`latest` rejeitado**.
- Nenhuma chave denota secret; nenhum valor com aparência de secret (canário).
- O **mesmo** manifesto é promovido de staging para produção (sem rebuild).
