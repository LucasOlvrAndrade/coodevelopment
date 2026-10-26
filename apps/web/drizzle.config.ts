import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Configuração do drizzle-kit, que roda fora do Next: não pode importar
// `servidor/env.ts` (é `server-only`), então é a única outra leitura de
// process.env permitida. O drizzle-kit não lê o `.env.local` sozinho.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL ausente: rode `vercel env pull apps/web/.env.local` antes.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/servidor/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
