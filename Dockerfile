# AEEMCI Studio : une seule image (application Next.js + Chromium pour le moteur de rendu).
# Construite par l'intégration continue, publiée sur ghcr.io depuis main, lancée sur le serveur par `deploiement/compose.yaml` (doc 10).
# Au démarrage, le conteneur applique les migrations de `apps/web/drizzle/` puis lance le serveur.

ARG NODE_VERSION=22
ARG PLAYWRIGHT_VERSION=1.63.0

# ── Dépendances ────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/moteur/package.json packages/moteur/
RUN npm ci

# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Script de migration en un seul fichier, lancé avant le serveur (pg vient de la sortie standalone).
RUN npx esbuild apps/web/scripts/migrer.ts --bundle --platform=node --format=esm --target=node22 \
      --external:pg --outfile=apps/web/scripts/migrer.mjs

# ── Exécution ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS run
ARG PLAYWRIGHT_VERSION
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    STOCKAGE_DOSSIER=/tmp/aeemci-stockage

# Chromium sans interface (même version que le moteur) et ses bibliothèques système.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/apps/web/scripts/migrer.mjs ./apps/web/scripts/
COPY --from=build --chown=node:node /app/apps/web/drizzle ./apps/web/drizzle

USER node
EXPOSE 8080
# La base est mise à jour avant chaque démarrage : une migration en échec empêche le serveur de démarrer
# (docker compose logs app), l'ancienne version reste disponible par VERSION=<commit> (doc 10).
CMD ["sh", "-c", "node apps/web/scripts/migrer.mjs && exec node apps/web/server.js"]
