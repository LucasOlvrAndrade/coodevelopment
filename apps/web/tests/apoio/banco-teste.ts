import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/servidor/db/schema";

// Postgres em memória (PGlite) com as migrações de verdade de apps/web/drizzle:
// as regras rodam contra checks, unique e CTEs reais, sem tocar no Neon.
export async function criarBancoDeTeste() {
  const cliente = new PGlite();
  const banco = drizzle({ client: cliente, schema });
  await migrate(banco, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  return {
    banco,
    limpar: () => banco.execute(sql`truncate table pedido_amizade, amizade, "user" cascade`),
    fechar: () => cliente.close(),
  };
}

type Banco = Awaited<ReturnType<typeof criarBancoDeTeste>>["banco"];

let proximoGithubId = 1;

export async function criarUsuario(banco: Banco, id: string, login: string, nome = login, githubId = proximoGithubId++) {
  await banco.insert(schema.user).values({ id, name: nome, email: `${githubId}@exemplo.test`, githubId, login });
  return id;
}
