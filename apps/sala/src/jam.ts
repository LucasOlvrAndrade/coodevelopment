import {
  mensagemDoConector,
  normalizarCaminho,
  textoLimpo,
  type MensagemAviso,
  type MensagemClaudes,
  type MensagemFeed,
  type MensagemParou,
  type MensagemPresenca,
  type MensagemReserva,
  type MensagemReservaPedida,
  type MensagemStatus,
  type QuemNaSala,
  validarTokenSala,
} from "@coodevelopment/protocolo";
import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import { ArmazenamentoAvisosSqlite, ArmazenamentoFeedSqlite, ArmazenamentoSqlite, type AvisoGuardado } from "./armazenamento-sqlite";
import { Feed } from "./feed";
import { Sincronizacao, type Envio } from "./sincronizacao";

// O estado de cada conexão sobrevive à hibernação. No conector, desde quando
// o Claude daquela pasta está trabalhando (Story 4.1); null quando parado.
// Se o Claude da pasta tem aviso ativo (Story 4.2; os avisos ficam no SQLite,
// gate da 4.4, REL-008) e quando o último terminou, para a folga do "sem aviso".
type Estado = Pick<QuemNaSala, "usuarioId" | "via"> & {
  trabalhandoDesde?: string | null;
  temAviso?: boolean;
  avisoTerminouEm?: string | null;
  // Marcas dos últimos avisos que já viraram item no feed (gate da 4.2, UX-004)
  // e dos últimos pedidos de reserva desta conexão (gate da 4.4, SEC-001). Só
  // as marcas, de tamanho fixo, para o estado nunca passar do teto (REL-008).
  avisosVistos?: readonly string[];
  reservasVistas?: readonly string[];
};

// Marca curta de um texto, só para reconhecer repetição (cyrb53). Uma colisão
// no máximo deixa de repetir um item do feed.
function marca(texto: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`;
}

const mesmoAviso = (a: { resumo: string; arquivos: readonly string[] }, b: { resumo: string; arquivos: readonly string[] }) =>
  a.resumo === b.resumo && a.arquivos.join("\n") === b.arquivos.join("\n");

// Depois de uma queda da conexão de quem anunciou (não de uma saída normal),
// a reserva vale mais um tempo: a rede pode voltar (gate da 4.4, REL-010).
export const QUEDA_TOLERADA_MS = 2 * 60 * 1000;

// A saída normal do conector (Ctrl+C) fecha com este código.
const FECHOU_NORMAL = 1000;

// Quantos avisos de cada conexão a sala lembra para não repetir no feed.
const AVISOS_LEMBRADOS = 10;

// Quantos pedidos de reserva de cada conexão a sala lembra.
const RESERVAS_LEMBRADAS = 50;

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
  private avisosCriados?: ArmazenamentoAvisosSqlite;

  private get avisos() {
    this.avisosCriados ??= new ArmazenamentoAvisosSqlite(this.ctx.storage.sql);
    return this.avisosCriados;
  }

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
    this.soltarOrfaos();
    this.anunciarPresenca();
    // O conector que chega recebe o que mudou desde o baseSha (FR21) e os
    // Claudes trabalhando (Story 4.3).
    if (quem.via === "conector") {
      for (const m of this.sincronizacao.estado()) conexao.send(JSON.stringify(m));
      conexao.send(JSON.stringify(this.claudes(undefined, true)));
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
    if (msg.data.tipo === "reserva") {
      this.reservar(conexao, msg.data);
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

  onClose(conexao: Connection<Estado>, codigo: number) {
    this.saiu(conexao, codigo === FECHOU_NORMAL);
  }

  onError(conexao: Connection<Estado>) {
    this.saiu(conexao, false);
  }

  // Saída normal encerra os avisos; queda mantém a reserva por um tempo, só
  // para os outros conectores (a página mostra quem está de fato ali).
  private saiu(conexao: Connection<Estado>, normal: boolean) {
    const desde = conexao.state?.trabalhandoDesde;
    if (normal || !desde) this.avisos.limpar(conexao.id);
    else {
      this.avisos.caiu(conexao.id, desde, Date.now());
      this.agendarVencimento();
    }
    this.anunciarPresenca(conexao.id);
    if (desde) this.anunciarClaudes(conexao.id);
  }

  private agendarVencimento() {
    const primeira = this.avisos.primeiraQueda();
    if (primeira !== null) void this.ctx.storage.setAlarm(primeira + QUEDA_TOLERADA_MS);
  }

  private soltarOrfaos() {
    const vivas = new Set<string>();
    for (const c of this.getConnections<Estado>()) vivas.add(c.id);
    this.avisos.soltarOrfaos(vivas, Date.now());
    this.agendarVencimento();
  }

  // A tolerância da queda acabou: a reserva termina.
  onAlarm() {
    this.avisos.vencer(Date.now() - QUEDA_TOLERADA_MS);
    this.agendarVencimento();
    this.anunciarClaudes();
  }

  // O Claude da pasta deste conector começou ou parou (Story 4.1). Parada
  // por erro vai às páginas como "parou", que elas mostram por alguns segundos.
  private mudarStatus(conexao: Connection<Estado>, msg: MensagemStatus) {
    const estado = conexao.state!;
    const antes = estado.trabalhandoDesde ?? null;
    const depois = msg.estado === "trabalhando" ? (antes ?? new Date().toISOString()) : null;
    // O aviso termina quando o Claude termina (Story 4.2, AC 6).
    const terminou = !depois && estado.temAviso;
    if (terminou) this.avisos.limpar(conexao.id);
    conexao.setState({
      ...estado,
      trabalhandoDesde: depois,
      ...(terminou ? { temAviso: false, avisoTerminouEm: new Date().toISOString() } : {}),
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
    const limpo = (a: { resumo: string; arquivos: readonly string[] }) => ({
      resumo: textoLimpo(a.resumo),
      arquivos: [...new Set(a.arquivos.map((x) => normalizarCaminho(textoLimpo(x))).filter((x): x is string => Boolean(x) && x!.length <= 1024))],
    });
    const msg = limpo(aviso);
    if (!msg.resumo) return;
    // Um aviso que já virou item volta (reconexão do conector, duas sessões
    // do Claude alternando): só o status muda, sem outro item no feed (gate
    // da 4.2, UX-001 e UX-004).
    const chave = marca(JSON.stringify([msg.resumo, msg.arquivos]));
    const vistos = estado.avisosVistos ?? [];
    const repetido = vistos.includes(chave);
    // O id vem do conector; o conector antigo não manda, e o mesmo aviso
    // reenviado com a conexão de pé mantém o que a sala gerou (gate da 4.4, REL-005).
    const atuais = this.avisos.todos().filter((a) => a.conexao === conexao.id);
    const id = aviso.id ?? atuais.find((a) => mesmoAviso(a, msg))?.id ?? crypto.randomUUID();
    const outros = (aviso.outros ?? []).map((o) => ({ id: o.id, ...limpo(o) })).filter((o) => o.resumo && o.id !== id);
    this.avisos.trocar(conexao.id, estado.usuarioId, [{ id, ...msg }, ...outros]);
    conexao.setState({ ...estado, temAviso: true, avisosVistos: repetido ? vistos : [...vistos, chave].slice(-AVISOS_LEMBRADOS) });
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

  // O Claude da pasta pediu para mexer num arquivo (Story 4.4). A sala
  // decide de quem é o arquivo pelos avisos ativos dos outros; sem dono, nada
  // (o aviso pode ter acabado no caminho). Vira item do feed para todos e
  // aviso no terminal de quem anunciou.
  private reservar(conexao: Connection<Estado>, msg: MensagemReserva) {
    const autorId = conexao.state!.usuarioId;
    const caminho = normalizarCaminho(textoLimpo(msg.caminho));
    if (!caminho) return;
    // Com dois donos, o de menor id, e o resumo do aviso que tem o arquivo: a
    // mesma ordem do claudes que o conector usa (gate da 4.4, UX-001 e REL-013).
    const dono = this.avisos.todos().find((a) => a.usuarioId !== autorId && a.arquivos.includes(caminho));
    if (!dono) return;
    // O mesmo pedido de novo (conector modificado em loop, reconexão) não
    // vira outro item nem outro aviso no terminal do dono (gate da 4.4, SEC-001).
    const estado = conexao.state!;
    // Com o id do aviso: o mesmo resumo num aviso novo do dono é pedido novo (REL-006).
    const chave = marca(JSON.stringify([caminho, dono.usuarioId, dono.id]));
    const vistas = estado.reservasVistas ?? [];
    if (vistas.includes(chave)) return;
    conexao.setState({ ...estado, reservasVistas: [...vistas, chave].slice(-RESERVAS_LEMBRADAS) });
    const evento = (() => {
      try {
        return this.feed.reserva(autorId, dono.usuarioId, caminho, dono.resumo, dono.id);
      } catch (e) {
        console.error(JSON.stringify({ nivel: "erro", evento: "feed_reserva", erro: String(e) }));
        return null;
      }
    })();
    if (evento) this.paraAsPaginas(JSON.stringify({ v: 1, tipo: "feed", eventos: [evento], inicial: false } satisfies MensagemFeed));
    const pedida: MensagemReservaPedida = { v: 1, tipo: "reserva_pedida", autorId, caminho, donoId: dono.usuarioId };
    const texto = JSON.stringify(pedida);
    for (const c of this.getConnections<Estado>()) if (c.state?.via === "conector" && c.state.usuarioId === dono.usuarioId) c.send(texto);
  }

  // O aviso acabou antes do status (prompt novo depois de um Esc, aviso
  // vencido; gate da 4.2, REL-001 e REL-002).
  private terminarAviso(conexao: Connection<Estado>) {
    const estado = conexao.state!;
    if (!estado.temAviso) return;
    this.avisos.limpar(conexao.id);
    conexao.setState({ ...estado, temAviso: false, avisoTerminouEm: new Date().toISOString() });
    this.anunciarClaudes();
  }

  // A pessoa está sem aviso ativo em nenhuma pasta dela, e o último terminou
  // há mais que a folga? Então a mudança dela é "sem aviso" (FR19).
  private semAviso(usuarioId: string): boolean {
    const limite = Date.now() - FOLGA_DO_AVISO_MS;
    for (const c of this.getConnections<Estado>()) {
      if (c.state?.via !== "conector" || c.state.usuarioId !== usuarioId) continue;
      if (c.state.temAviso) return false;
      if (c.state.avisoTerminouEm && Date.parse(c.state.avisoTerminouEm) > limite) return false;
    }
    return true;
  }

  // Quem está com o Claude trabalhando, uma vez por pessoa (o desde mais
  // antigo, se ela tem duas pastas ligadas, e os arquivos anunciados de todas
  // elas; Story 4.3). O conector que está saindo fica de fora pelo id. Para os
  // conectores, entram também os avisos de quem caiu há pouco (gate da 4.4, REL-010).
  private claudes(saindo?: string, comQuedas = false): MensagemClaudes {
    type Dele = { desde: string; resumo: string | null; avisoId?: string; avisos: (AvisoGuardado & { queda?: true })[] };
    const pessoas = new Map<string, Dele>();
    const daPessoa = (usuarioId: string, desde: string) => {
      const atual = pessoas.get(usuarioId);
      if (!atual) pessoas.set(usuarioId, { desde, resumo: null, avisos: [] });
      else if (desde < atual.desde) atual.desde = desde;
      return pessoas.get(usuarioId)!;
    };
    const guardados = this.avisos.todos();
    for (const c of this.getConnections<Estado>()) {
      const d = c.id === saindo ? null : c.state?.trabalhandoDesde;
      if (!d || c.state?.via !== "conector") continue;
      const dele = daPessoa(c.state.usuarioId, d);
      const daConexao = guardados.filter((a) => a.conexao === c.id);
      // O primeiro de cada conexão é o mais recente dela.
      if (daConexao[0]) {
        dele.resumo = daConexao[0].resumo;
        dele.avisoId = daConexao[0].id;
      }
      dele.avisos.push(...daConexao);
    }
    if (comQuedas) {
      for (const a of guardados) {
        if (a.caiuEm === null || !a.desde) continue;
        const dele = daPessoa(a.usuarioId, a.desde);
        if (dele.resumo === null) {
          dele.resumo = a.resumo;
          dele.avisoId = a.id;
        }
        dele.avisos.push({ ...a, queda: true });
      }
    }
    return {
      v: 1,
      tipo: "claudes",
      // A mesma ordem do reservar, para o dono ser o mesmo nos dois lados.
      trabalhando: [...pessoas]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([usuarioId, d]) => ({
          usuarioId,
          desde: d.desde,
          resumo: d.resumo,
          arquivos: [...new Set(d.avisos.flatMap((a) => a.arquivos))],
          ...(d.avisoId ? { avisoId: d.avisoId } : {}),
          avisos: d.avisos.map((a) => ({ id: a.id, resumo: a.resumo, arquivos: a.arquivos, ...(a.queda ? { queda: true } : {}) })),
        })),
    };
  }

  // Para as páginas (status) e para os conectores, que passam os avisos dos
  // outros ao Claude de cada pasta (Story 4.3).
  private anunciarClaudes(saindo?: string) {
    const paginas = JSON.stringify(this.claudes(saindo));
    const conectores = JSON.stringify(this.claudes(saindo, true));
    for (const c of this.getConnections<Estado>()) if (c.id !== saindo && c.state) c.send(c.state.via === "conector" ? conectores : paginas);
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
