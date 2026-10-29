import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/servidor/db";
import { rota } from "@/servidor/erros";

// A sala responde? (Story 3.1: o diagnóstico do conector pergunta aqui, porque
// sem uma jam ele não sabe o endereço dela.) Qualquer resposta HTTP serve; a
// raiz da sala é 404. Sala fora do ar não derruba o app (Story 2.5, AC 4).
async function situacaoDaSala(): Promise<"ok" | "erro" | "desligada"> {
  const host = process.env.NEXT_PUBLIC_SALA_HOST;
  if (!host) return "desligada";
  const protocolo = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https";
  try {
    await fetch(`${protocolo}://${host}/`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    return "ok";
  } catch {
    return "erro";
  }
}

export const GET = rota(async () => {
  await connection();
  const sala = situacaoDaSala();
  try {
    await db().execute(sql`select 1`);
    return Response.json({ app: "ok", banco: "ok", sala: await sala });
  } catch (e) {
    unstable_rethrow(e);
    console.error(JSON.stringify({ nivel: "erro", rota: "saude", erro: String(e) }));
    return Response.json({ app: "ok", banco: "erro", sala: await sala }, { status: 503 });
  }
});
