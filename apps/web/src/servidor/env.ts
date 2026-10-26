import "server-only";
import { z } from "zod";

// Único lugar que lê process.env. Lido sob demanda para o build não exigir segredos.
const esquema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  // Caminho da página de instalação (github.com/apps/<slug>/installations/new).
  GITHUB_APP_SLUG: z.string().min(1),
});

export type Env = z.infer<typeof esquema>;

let cache: Env | undefined;

export function env(): Env {
  cache ??= esquema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
  });
  return cache;
}
