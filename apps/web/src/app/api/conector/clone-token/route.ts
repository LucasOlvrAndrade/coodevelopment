import { z } from "zod";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { idDeJamValido, obterJam } from "@/servidor/dominio/jam";
import { ErroApp, rota } from "@/servidor/erros";
import { githubApp } from "@/servidor/github-app";

const corpo = z.object({ jamId: z.string().refine(idDeJamValido) });

// Token só para o git clone do repositório da jam (Story 3.1, AC 2): o
// conector nunca recebe o token do GitHub do usuário (NFR8). É um token de
// instalação do GitHub App, só de leitura, só desse repositório, de 1 hora.
export const POST = rota(async (req: Request) => {
  const eu = await exigirSessao();
  const lido = corpo.safeParse(await req.json().catch(() => null));
  if (!lido.success) throw new ErroApp("entrada_invalida");
  const daJam = await obterJam(db(), eu.id, lido.data.jamId);
  if (!daJam) throw new ErroApp("nao_participa", 403);
  if (daJam.estado !== "aberta") throw new ErroApp("jam_fechada", 409);

  const { token, expiraEm } = await githubApp().tokenDeLeitura({ owner: daJam.repoOwner, nome: daJam.repoNome, id: daJam.repoId });
  return Response.json({ token, expiraEm }, { headers: { "cache-control": "no-store" } });
});
