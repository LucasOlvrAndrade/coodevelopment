import { exigirSessaoDoConector } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { idDeJamValido, obterJam } from "@/servidor/dominio/jam";
import { ErroApp, rota } from "@/servidor/erros";

// O que o conector precisa para ligar a pasta à jam (Story 3.1, AC 2): o
// repositório (para clonar ou conferir o origin) e a branch. Só para quem
// participa; quem não participa e jam que não existe recebem o mesmo 403.
// O baseSha é a base do merge da primeira escrita de cada arquivo, e o id de
// quem chama separa as próprias escritas das dos outros (Story 3.3).
export const GET = rota(async (_req: Request, { params }: RouteContext<"/api/jams/[id]/conector">) => {
  const [{ usuario: eu }, { id }] = await Promise.all([exigirSessaoDoConector(), params]);
  const daJam = idDeJamValido(id) ? await obterJam(db(), eu.id, id) : null;
  if (!daJam) throw new ErroApp("nao_participa", 403);
  return Response.json(
    {
      jamId: daJam.id,
      nome: daJam.nome,
      estado: daJam.estado,
      repo: { owner: daJam.repoOwner, nome: daJam.repoNome, id: daJam.repoId },
      branch: daJam.branch,
      baseSha: daJam.baseSha,
      eu: eu.id,
    },
    { headers: { "cache-control": "no-store" } },
  );
});
