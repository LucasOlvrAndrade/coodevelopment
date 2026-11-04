import {
  mensagemDoConector,
  normalizarCaminho,
  textoLimpo,
  type MensagemAviso,
  type MensagemClaudes,
  type MensagemFeed,
  type MensagemParou,
  type MensagemPresenca,
  type MensagemStatus,
  type QuemNaSala,
  validarTokenSala,
} from "@coodevelopment/protocolo";
import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { ArmazenamentoFeedSqlite, ArmazenamentoSqlite } from "./armazenamento-sqlite";
import { Feed } from "./feed";
import { Sincronizacao, type Envio } from "./sincronizacao";

// O estado de cada conexão sobrevive à hibernação. No conector, desde quando
// o Claude daquela pasta está trabalhando (Story 4.1); null quando parado.
// O aviso ativo do Claude da pasta (Story 4.2) e quando o último terminou,
// para a folga do "sem aviso".
type Estado = Pick<QuemNaSala, "usuarioId" | "via"> & {
  trabalhandoDesde?: string | null;
  aviso?: { resumo: string; arquivos: readonly string[] } | null;
  avisoTerminouEm?: string | null;
  // Os últimos avisos que já viraram item no feed (gate da 4.2, UX-004).
  avisosVistos?: readonly string[];
};

// Quantos avisos de cada conexão a sala lembra para não repetir no feed.
const AVISOS_LEMBRADOS = 10;

// Gravações que ainda saem depois do fim do aviso não contam como "sem aviso".
const FOLGA_DO_AVISO_MS = 30_000;

// Uma sala por jam (Story 2.5). Só entra quem traz o token que o app emitiu
// para esta jam, conferido aqui na entrada; a cada entrada e saída a sala
// avisa a todos quem está com a página aberta e quem está com o conector
// ligado, uma vez por pessoa mesmo com várias abas.
// O estado de cada conexão sobrevive à hibernação. Os arquivos da jam
// circulam entre os conectores e ficam guardados no SQLite da sala (Story 3.3),
// e cada mudança entra no feed, que as páginas recebem (Story 3.4). O status
// do Claude de cada um vem dos hooks pelo conector e vai às páginas (Story 4.1).
export class Jam extends Server<Env> {
  static options = { hibernate: true };

  private sincronizacaoCriada?: Sincronizacao;
  private feedCriado?: Feed;

  private get feed() {
    this.feedCriado ??= new Feed(new ArmazenamentoFeedSqlite(this.ctx.storage.sql));
    return this.feedCriado;
  }

  private get sincronizacao() {
    this.sincronizacaoCriada ??= new Sincronizacao(new ArmazenamentoSqlite(this.ctx.storage.sql), undefined, this.feed);
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
    // O conector que chega recebe o que mudou desde o baseSha (FR21) e os
    // Claudes trabalhando (Story 4.3).
    if (quem.via === "conector") {
      for (const m of this.sincronizacao.estado()) conexao.send(JSON.stringify(m));
      conexao.send(JSON.stringify(this.claudes()));
    }
    // A página que abre recebe os últimos itens do feed (Story 3.4, AC 6).
    else {
      conexao.send(JSON.stringify({ v: 1, tipo: "feed", eventos: this.feedGuardado(), inicial: true } satisfies MensagemFeed));
      conexao.send(JSON.stringify(this.claudes()));
    }
  }

  // Erro ao ler o feed: a página recebe o feed vazio em vez de esperar para
  // sempre (gate da 3.4, REL-001).
  private feedGuardado() {
    try {
      return this.feed.ultimos();
    } catch (e) {
      console.error(JSON.stringify({ nivel: "erro", evento: "feed_guardado", erro: String(e) }));
      return [];
    }
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
    if (msg.data.tipo === "status") {
      this.mudarStatus(conexao, msg.data);
      return;
    }
    if (msg.data.tipo === "aviso") {
      this.anunciar(conexao, msg.data);
      return;
    }
    if (msg.data.tipo === "aviso_fim") {
      this.terminarAviso(conexao);
      return;
    }
    const envios =
      msg.data.tipo === "ignorado"
        ? this.sincronizacao.ignorado(conexao.state.usuarioId, msg.data)
        : await this.sincronizacao.escrever(conexao.state.usuarioId, msg.data, this.semAviso(conexao.state.usuarioId));
    this.entregar(conexao, envios);
  }

  // Para o autor, para os outros conectores, para todos os conectores ou
  // para as páginas abertas.
  private entregar(autor: Connection<Estado>, envios: Envio[]) {
    for (const { para, mensagem } of envios) {
      const texto = JSON.stringify(mensagem);
      if (para === "autor") {
        autor.send(texto);
        continue;
      }
      for (const c of this.getConnections<Estado>()) {
        if (!c.state) continue;
        if (para === "paginas" ? c.state.via !== "pagina" : c.state.via !== "conector" || (para === "outros" && c.id === autor.id)) continue;
        c.send(texto);
      }
    }
  }

  onClose(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
    if (conexao.state?.trabalhandoDesde) this.anunciarClaudes(conexao.id);
  }

  onError(conexao: Connection<Estado>) {
    this.anunciarPresenca(conexao.id);
    if (conexao.state?.trabalhandoDesde) this.anunciarClaudes(conexao.id);
  }

  // O Claude da pasta deste conector começou ou parou (Story 4.1). Parada
  // por erro vai às páginas como "parou", que elas mostram por alguns segundos.
  private mudarStatus(conexao: Connection<Estado>, msg: MensagemStatus) {
    const estado = conexao.state!;
    const antes = estado.trabalhandoDesde ?? null;
    const depois = msg.estado === "trabalhando" ? (antes ?? new Date().toISOString()) : null;
    // O aviso termina quando o Claude termina (Story 4.2, AC 6).
    const terminou = !depois && estado.aviso;
    conexao.setState({
      ...estado,
      trabalhandoDesde: depois,
      ...(terminou ? { aviso: null, avisoTerminouEm: new Date().toISOString() } : {}),
      // Período de trabalho novo: o mesmo anúncio volta a ser item do feed (gate da 4.2, UX-005).
      ...(depois ? {} : { avisosVistos: [] }),
    });
    if (antes !== depois || terminou) this.anunciarClaudes();
    if (msg.estado === "parado" && msg.motivo) {
      const parou: MensagemParou = { v: 1, tipo: "parou", usuarioId: estado.usuarioId, motivo: msg.motivo };
      this.paraAsPaginas(JSON.stringify(parou));
    }
  }

  // O Claude da pasta anunciou (Story 4.2): o aviso fica no estado da
  // conexão, vira item do feed e o resumo vai para o status.
  private anunciar(conexao: Connection<Estado>, aviso: MensagemAviso) {
    const estado = conexao.state!;
    // O texto vai à página e ao Claude dos outros: limpo, e só caminhos de
    // verdade (gate da 4.3, SEC-001 e SEC-002).
    const resumo = textoLimpo(aviso.resumo);
    if (!resumo) return;
    const caminhos = aviso.arquivos.map((a) => normalizarCaminho(textoLimpo(a))).filter((a): a is string => Boolean(a) && a!.length <= 1024);
    const msg = { ...aviso, resumo, arquivos: [...new Set(caminhos)] };
    // Um aviso que já virou item volta (reconexão do conector, duas sessões
    // do Claude alternando): só o status muda, sem outro item no feed (gate
    // da 4.2, UX-001 e UX-004).
    const chave = JSON.stringify([msg.resumo, msg.arquivos]);
    const vistos = estado.avisosVistos ?? [];
    const repetido = vistos.includes(chave);
    conexao.setState({
      ...estado,
      aviso: { resumo: msg.resumo, arquivos: msg.arquivos },
      avisosVistos: repetido ? vistos : [...vistos, chave].slice(-AVISOS_LEMBRADOS),
    });
    if (repetido) {
      this.anunciarClaudes();
      return;
    }
    const evento = (() => {
      try {
        return this.feed.aviso(estado.usuarioId, msg.resumo, msg.arquivos);
      } catch (e) {
        console.error(JSON.stringify({ nivel: "erro", evento: "feed_aviso", erro: String(e) }));
        return null;
      }
    })();
    if (evento) this.paraAsPaginas(JSON.stringify({ v: 1, tipo: "feed", eventos: [evento], inicial: false } satisfies MensagemFeed));
    this.anunciarClaudes();
  }

  // O aviso acabou antes do status (prompt novo depois de um Esc, aviso
  // vencido; gate da 4.2, REL-001 e REL-002).
  private terminarAviso(conexao: Connection<Estado>) {
    const estado = conexao.state!;
    if (!estado.aviso) return;
    conexao.setState({ ...estado, aviso: null, avisoTerminouEm: new Date().toISOString() });
    this.anunciarClaudes();
  }

  // A pessoa está sem aviso ativo em nenhuma pasta dela, e o último terminou
  // há mais que a folga? Então a mudança dela é "sem aviso" (FR19).
  private semAviso(usuarioId: string): boolean {
    const limite = Date.now() - FOLGA_DO_AVISO_MS;
    for (const c of this.getConnections<Estado>()) {
      if (c.state?.via !== "conector" || c.state.usuarioId !== usuarioId) continue;
      if (c.state.aviso) return false;
      if (c.state.avisoTerminouEm && Date.parse(c.state.avisoTerminouEm) > limite) return false;
    }
    return true;
  }

  // Quem está com o Claude trabalhando, uma vez por pessoa (o desde mais
  // antigo, se ela tem duas pastas ligadas, e os arquivos anunciados de todas
  // elas; Story 4.3). O conector que está saindo fica de fora pelo id.
  private claudes(saindo?: string): MensagemClaudes {
    const desde = new Map<string, string>();
    const resumo = new Map<string, string>();
    const arquivos = new Map<string, Set<string>>();
    for (const c of this.getConnections<Estado>()) {
      const d = c.id === saindo ? null : c.state?.trabalhandoDesde;
      if (!d || c.state?.via !== "conector") continue;
      const atual = desde.get(c.state.usuarioId);
      if (!atual || d < atual) desde.set(c.state.usuarioId, d);
      if (c.state.aviso) {
        resumo.set(c.state.usuarioId, c.state.aviso.resumo);
        const dele = arquivos.get(c.state.usuarioId) ?? new Set<string>();
        for (const a of c.state.aviso.arquivos) dele.add(a);
        arquivos.set(c.state.usuarioId, dele);
      }
    }
    return {
      v: 1,
      tipo: "claudes",
      trabalhando: [...desde]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([usuarioId, d]) => ({ usuarioId, desde: d, resumo: resumo.get(usuarioId) ?? null, arquivos: [...(arquivos.get(usuarioId) ?? [])] })),
    };
  }

  // Para as páginas (status) e para os conectores, que passam os avisos dos
  // outros ao Claude de cada pasta (Story 4.3).
  private anunciarClaudes(saindo?: string) {
    const texto = JSON.stringify(this.claudes(saindo));
    for (const c of this.getConnections<Estado>()) if (c.id !== saindo && c.state) c.send(texto);
  }

  private paraAsPaginas(texto: string) {
    for (const c of this.getConnections<Estado>()) if (c.state?.via === "pagina") c.send(texto);
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
