import { type MensagemPresenca, type QuemNaSala, validarTokenSala } from "@coodevelopment/protocolo";
import { Server, type Connection, type ConnectionContext } from "partyserver";

type Estado = Pick<QuemNaSala, "usuarioId" | "via">;

// Uma sala por jam (Story 2.5). Só entra quem traz o token que o app emitiu
// para esta jam, conferido aqui na entrada; a cada entrada e saída a sala
// avisa a todos quem está online, uma vez por pessoa mesmo com várias abas.
// O estado de cada conexão sobrevive à hibernação.
export class Jam extends Server<Env> {
  static options = { hibernate: true };

  async onConnect(conexao: Connection<Estado>, ctx: ConnectionContext) {
    const token = new URL(ctx.request.url).searchParams.get("token");
    const quem = token
      ? await validarTokenSala(token, this.name, this.env.SEGREDO_SALA).catch((e: unknown) => {
          console.error(JSON.stringify({ nivel: "erro", evento: "validar_token_sala", erro: String(e) }));
          return null;
        })
      : null;
    if (!quem) {
      conexao.close(4401, "token inválido");
      return;
    }
    conexao.setState({ usuarioId: quem.usuarioId, via: quem.via });
    this.anunciarPresenca();
  }

  onClose(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
  }

  onError(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
  }

  // Quem está saindo fica de fora pelo id, mesmo se o fechamento ainda corre.
  private anunciarPresenca(saindo?: string) {
    const online = new Set<string>();
    for (const conexao of this.getConnections<Estado>()) {
      if (conexao.id !== saindo && conexao.state) online.add(conexao.state.usuarioId);
    }
    const mensagem: MensagemPresenca = { v: 1, tipo: "presenca", online: [...online].sort() };
    this.broadcast(JSON.stringify(mensagem), saindo ? [saindo] : undefined);
  }
}
