import { mensagemDoConector, type MensagemPresenca, type QuemNaSala, validarTokenSala } from "@coodevelopment/protocolo";
import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { ArmazenamentoSqlite } from "./armazenamento-sqlite";
import { Sincronizacao, type Envio } from "./sincronizacao";

type Estado = Pick<QuemNaSala, "usuarioId" | "via">;

// Uma sala por jam (Story 2.5). Só entra quem traz o token que o app emitiu
// para esta jam, conferido aqui na entrada; a cada entrada e saída a sala
// avisa a todos quem está com a página aberta e quem está com o conector
// ligado, uma vez por pessoa mesmo com várias abas.
// O estado de cada conexão sobrevive à hibernação. Os arquivos da jam
// circulam entre os conectores e ficam guardados no SQLite da sala (Story 3.3).
export class Jam extends Server<Env> {
  static options = { hibernate: true };

  private sincronizacaoCriada?: Sincronizacao;

  private get sincronizacao() {
    this.sincronizacaoCriada ??= new Sincronizacao(new ArmazenamentoSqlite(this.ctx.storage.sql));
    return this.sincronizacaoCriada;
  }

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
    // O conector que chega recebe o que mudou desde o baseSha (FR21).
    if (quem.via === "conector") for (const m of this.sincronizacao.estado()) conexao.send(JSON.stringify(m));
  }

  // Só o conector escreve arquivo; a página só lê a presença.
  async onMessage(conexao: Connection<Estado>, dados: WSMessage) {
    if (conexao.state?.via !== "conector" || typeof dados !== "string") return;
    let lido: unknown;
    try {
      lido = JSON.parse(dados);
    } catch {
      return;
    }
    const msg = mensagemDoConector.safeParse(lido);
    if (!msg.success) return;
    const envios = await this.sincronizacao.escrever(conexao.state.usuarioId, msg.data);
    this.entregar(conexao, envios);
  }

  // Para o autor, para os outros conectores ou para todos os conectores.
  private entregar(autor: Connection<Estado>, envios: Envio[]) {
    for (const { para, mensagem } of envios) {
      const texto = JSON.stringify(mensagem);
      if (para === "autor") {
        autor.send(texto);
        continue;
      }
      for (const c of this.getConnections<Estado>()) {
        if (c.state?.via !== "conector" || (para === "outros" && c.id === autor.id)) continue;
        c.send(texto);
      }
    }
  }

  onClose(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
  }

  onError(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
  }

  // Quem está saindo fica de fora pelo id, mesmo se o fechamento ainda corre.
  // A página aberta conta em `online`; o conector ligado, em `conectados`.
  private anunciarPresenca(saindo?: string) {
    const online = new Set<string>();
    const conectados = new Set<string>();
    for (const conexao of this.getConnections<Estado>()) {
      if (conexao.id === saindo || !conexao.state) continue;
      (conexao.state.via === "conector" ? conectados : online).add(conexao.state.usuarioId);
    }
    const mensagem: MensagemPresenca = { v: 1, tipo: "presenca", online: [...online].sort(), conectados: [...conectados].sort() };
    this.broadcast(JSON.stringify(mensagem), saindo ? [saindo] : undefined);
  }
}
