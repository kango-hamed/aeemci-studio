# AEEMCI Studio : une seule image (application Next.js + Chromium pour le moteur de rendu).
# Construite par l'intégration continue, publiée sur ghcr.io depuis main, lancée sur le serveur par `deploiement/compose.yaml` (doc 10).

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

USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
