import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(import.meta.dirname, "src"),
      // `server-only` refuse d'être importé hors du serveur React ; sans objet dans les tests.
      "server-only": path.join(import.meta.dirname, "test/vide.ts"),
    },
  },
  test: { testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
