import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Só para os testes: o valor de verdade fica na Cloudflare e na Vercel.
      miniflare: { bindings: { SEGREDO_SALA: "segredo-so-dos-testes-da-sala-0123456789" } },
    }),
  ],
});
