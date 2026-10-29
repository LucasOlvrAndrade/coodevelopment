import { assinarTokenSala } from "@coodevelopment/protocolo";
import { exigirSessaoDoConector } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { idDeJamValido, obterJam } from "@/servidor/dominio/jam";
import { ErroApp, rota } from "@/servidor/erros";

// Token da sala (Story 2.5): JWT de 10 minutos para quem participa da jam
// entrar na sala dela, conferido de novo aqui (a página já confere). Quem não
// participa e jam que não existe recebem o mesmo 403, como a 404 da página
// (Story 2.4). Sem a sala configurada, 503, e a página segue sem a presença
// (AC 4). O conector chega com a sessão própria como Bearer (Story 3.1), e
// o token diz à sala que é ele, para a página mostrar "conectado".
export const POST = rota(async (_req: Request, { params }: RouteContext<"/api/jams/[id]/token-sala">) => {
  const [{ usuario: eu, via }, { id }] = await Promise.all([exigirSessaoDoConector(), params]);
  const segredo = process.env.SEGREDO_SALA;
  const host = process.env.NEXT_PUBLIC_SALA_HOST;
  if (!segredo || !host) throw new ErroApp("sala_indisponivel", 503);
  // O id vai para o caminho da sala: só no formato do gerarIdJam.
  const daJam = idDeJamValido(id) ? await obterJam(db(), eu.id, id) : null;
  if (!daJam) throw new ErroApp("nao_participa", 403);
  // Jam fechada não recebe token: o conector para com a explicação, e a
  // página segue sem a presença (gate da 3.1, REL-008).
  if (daJam.estado !== "aberta") throw new ErroApp("jam_fechada", 409);

  const { token, expiraEm } = await assinarTokenSala({ usuarioId: eu.id, jamId: id, via }, segredo);
  // A sala local do `wrangler dev` não tem TLS.
  const protocolo = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "ws" : "wss";
  return Response.json(
    { token, salaUrl: `${protocolo}://${host}/parties/jam/${id}`, expiraEm: expiraEm.toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
});
