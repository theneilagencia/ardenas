# Arden.AS API — imagem de produção (ARDEN-BE-001).
# Contexto de build: RAIZ do repositório (monorepo). Multi-stage.

# ── Build ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /repo

# Prisma precisa de openssl.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Instala dependências do workspace (cache de camadas).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

# Código-fonte e build.
COPY . .
RUN npm -w @arden/contracts run build \
  && npm -w @arden/api run db:generate \
  && npm run build:api

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copia apenas o necessário para executar.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/docs/api/openapi-v1.yaml ./docs/api/openapi-v1.yaml

EXPOSE 3000
# Usuário não-root.
USER node
CMD ["node", "apps/api/dist/main.js"]
