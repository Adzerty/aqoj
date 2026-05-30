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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh \
  && useradd -m -u 1001 aqoj \
  && chown -R aqoj:aqoj /app
USER aqoj

EXPOSE 3000
# Applique les migrations Prisma puis démarre le serveur.
ENTRYPOINT ["./docker-entrypoint.sh"]
