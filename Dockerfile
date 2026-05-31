# syntax=docker/dockerfile:1

# ───────────────────────────── Base ─────────────────────────────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ───────────────────── Dépendances + build ─────────────────────
FROM base AS build
# Manifestes + schéma d'abord (le postinstall « prisma generate » a besoin du schéma).
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
# Reste du code, puis build Next.
COPY . .
RUN pnpm build

# ───────────────────────── Image d'exécution ─────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# On rejoue le serveur TypeScript via tsx : on a donc besoin du code source,
# du build .next, de node_modules (avec le client Prisma + la CLI Prisma).
# L'image node fournit déjà un utilisateur non-root « node » (UID 1000) ; on
# fixe la propriété directement au COPY (--chown) plutôt qu'avec un chown -R lent.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/server.ts ./server.ts
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh
USER node

EXPOSE 3000
# Applique les migrations Prisma puis démarre le serveur.
ENTRYPOINT ["./docker-entrypoint.sh"]
