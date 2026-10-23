import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/servidor/env";
import * as schema from "./schema";

function criarDb() {
  return drizzle({ client: neon(env().DATABASE_URL), schema });
}

let instancia: ReturnType<typeof criarDb> | undefined;

export function db() {
  instancia ??= criarDb();
  return instancia;
}
