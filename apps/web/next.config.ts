import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker autonome (.next/standalone) : voir Dockerfile à la racine du dépôt.
  output: "standalone",
  // Monorepo : le traçage des fichiers part de la racine pour embarquer les paquets de l'espace de travail.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Paquets Node natifs ou lourds, chargés tels quels par le serveur plutôt qu'empaquetés.
  serverExternalPackages: ["pg", "playwright"],
  // Fichiers lus à l'exécution que le traçage ne voit pas : données de Playwright, polices du moteur.
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/playwright/**", "../../node_modules/playwright-core/**", "../../packages/moteur/polices/**"],
  },
  poweredByHeader: false,
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
