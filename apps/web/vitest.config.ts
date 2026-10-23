import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" lança fora do runtime do React Server; nos testes vira módulo vazio.
      "server-only": fileURLToPath(new URL("./tests/apoio/vazio.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/apoio/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
