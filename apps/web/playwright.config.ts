import { defineConfig, devices } from "@playwright/test";

// E2E contra o app local (next dev). Usa o .env.local, mas os testes só leem
// páginas: nada grava no banco.
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
