import { defineConfig, devices } from "@playwright/test";

// E2E contra o app local (next dev), com o .env.local. Os testes só leem
// páginas, com uma exceção: o clique em "Entrar com GitHub" grava o state do
// OAuth na tabela verification (linha que vence em minutos). A branch de
// testes do Neon tira isso do banco de verdade (pendente na Story 1.2).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/saude",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
