import "server-only";
import { z } from "zod";

// Único lugar que lê process.env. Lido sob demanda para o build não exigir segredos.
const esquema = z.object({
  DATABASE_URL: z.url(),
});

export type Env = z.infer<typeof esquema>;

let cache: Env | undefined;

export function env(): Env {
  cache ??= esquema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
  return cache;
}
