import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/servidor/db";
import { rota } from "@/servidor/erros";

export const GET = rota(async () => {
  await connection();
  try {
    await db().execute(sql`select 1`);
    return Response.json({ app: "ok", banco: "ok" });
  } catch (e) {
    unstable_rethrow(e);
    console.error(JSON.stringify({ nivel: "erro", rota: "saude", erro: String(e) }));
    return Response.json({ app: "ok", banco: "erro" }, { status: 503 });
  }
});
