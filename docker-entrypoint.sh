#!/bin/sh
set -e

# Applique les migrations Prisma sur la base (idempotent : ne fait rien si à jour).
echo "→ Application des migrations Prisma…"
node_modules/.bin/prisma migrate deploy

echo "→ Démarrage d'AQOJ…"
# NODE_ENV=production est défini dans le Dockerfile.
exec node_modules/.bin/tsx server.ts
