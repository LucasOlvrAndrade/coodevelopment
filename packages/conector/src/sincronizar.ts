import { basename, relative, sep } from "node:path";
import { TAMANHO_MAXIMO, hashDoConteudo, type MensagemArquivo, type MensagemDaSala, type MensagemEscrever } from "@coodevelopment/protocolo";
import type { Ambiente } from "./ambiente";
import { PREFIXO_TEMPORARIO, gravarNoDisco, lerLocal, type Local } from "./disco";
import { arquivoNaBase, crlfPorPadrao, ignoradosPeloGit, podeCircular } from "./filtro";

// Sincronização da pasta com a sala (Story 3.3). Regras do conector
// (core-workflows.md): sem eco (o hash do que gravou é o conhecido), espera de
// 150 ms sem eventos por arquivo, uma escrita por vez por arquivo, e arquivo
// que chega sobre mudança local ainda não enviada não é gravado: a mudança
// local sai com a base antiga e a sala junta as duas.

export type Transporte = { enviar(mensagem: MensagemEscrever): void };

export type Vigia = { parar(): Promise<void> };
// absolutos null: o vigia avisou que perdeu eventos.
export type Vigiar = (raiz: string, aoMudar: (absolutos: string[] | null) => void) => Promise<Vigia>;

// O vigia do sistema pode perder eventos com a máquina ocupada (no Windows, o
// ReadDirectoryChangesW descarta quando está cheio). Uma varredura pelo git
// de tempos em tempos manda o que escapou. 10 s mantém a CPU baixa (NFR6)
// mesmo em repositório grande; os testes usam menos.
export const VARREDURA_MS = 10_000;

// Pastas que nem chegam ao filtro: o vigia não as acompanha.
const NAO_VIGIAR = [".git", "node_modules", ".venv", "venv", ".next", "__pycache__", "**/node_modules", "**/.next", "**/__pycache__", "**/.git"];

export const vigiarComParcel: Vigiar = async (raiz, aoMudar) => {
  const { subscribe } = await import("@parcel/watcher");
  const assinatura = await subscribe(
    raiz,
    // Erro do vigia (eventos perdidos): null pede uma varredura na hora.
    (erro, eventos) => aoMudar(erro ? null : eventos.map((e) => e.path)),
    { ignore: NAO_VIGIAR },
  );
  return { parar: () => assinatura.unsubscribe() };
};

type Versao = { versao: number; hash: string; apagado: boolean };
type Enviado = { hash: string; apagado: boolean };

const mesmo = (a: { hash: string; apagado: boolean }, b: { hash: string; apagado: boolean }) => a.hash === b.hash && a.apagado === b.apagado;

export class Sincronizador {
  // Última versão de cada arquivo que este conector conhece da sala.
  private conhecidos = new Map<string, Versao>();
  // Escrita enviada esperando a resposta da sala, por arquivo.
  private emVoo = new Map<string, Enviado>();
  // Depois de um conflito, o próximo arquivo que chega é o atual: grava.
  private esperandoAtual = new Set<string>();
  private relogios = new Map<string, ReturnType<typeof setTimeout>>();
  private prontos = new Set<string>();
  private lote?: ReturnType<typeof setTimeout>;
  private avisados = new Set<string>();
  private crlf = false;
  private vigia?: Vigia;
  private varredura?: ReturnType<typeof setInterval>;
  // Como cada arquivo diferente do repositório estava quando o conector
  // ligou: a varredura não manda o que já estava assim antes (isso é a
  // divergência da Story 5.2), só o que mudou depois.
  private naPartida = new Map<string, string>();
  // Tudo passa por uma fila só: vigia e sala nunca mexem no mesmo arquivo ao mesmo tempo.
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    private amb: Ambiente,
    private raiz: string,
    private baseSha: string,
    private eu: string,
    private transporte: Transporte,
    private vigiar: Vigiar = vigiarComParcel,
    private esperaMs = 150,
    private varreduraMs = VARREDURA_MS,
  ) {}

  async iniciar(): Promise<void> {
    await this.preparar();
    await this.comecarAVigiar();
  }

  // O que precisa estar pronto antes de a sala mandar o primeiro arquivo.
  async preparar(): Promise<void> {
    this.crlf = await crlfPorPadrao(this.amb, this.raiz);
  }

  async comecarAVigiar(): Promise<void> {
    this.vigia = await this.vigiar(this.raiz, (absolutos) => (absolutos ? this.aoMudar(absolutos) : this.enfileirar(() => this.varrer())));
    // A foto vem depois de o vigia estar ligado: o que mudar a partir daqui
    // ou chega pelo vigia, ou aparece diferente da foto na varredura.
    await new Promise<void>((pronto) => this.enfileirar(async () => (await this.fotografar(), pronto())));
    this.varredura = setInterval(() => this.enfileirar(() => this.varrer()), this.varreduraMs);
  }

  // Arquivos diferentes do repositório agora (pelo git, respeitando o
  // .gitignore) e os que já circularam na jam.
  private async candidatos(): Promise<string[]> {
    const r = await this.amb.rodar("git", ["ls-files", "-z", "--modified", "--others", "--deleted", "--exclude-standard"], { cwd: this.raiz });
    if (r.codigo !== 0) throw new Error(`git ls-files falhou (${r.codigo})`);
    return [...new Set([...r.saida.split("\0").filter(Boolean), ...this.conhecidos.keys()])].filter(podeCircular);
  }

  private chave(local: Local | null) {
    return local ? `${local.apagado ? "apagado" : local.hash}` : "";
  }

  private async fotografar(): Promise<void> {
    for (const c of await this.candidatos()) this.naPartida.set(c, this.chave(await lerLocal(this.raiz, c)));
  }

  private async varrer(): Promise<void> {
    try {
      for (const c of await this.candidatos()) {
        if (this.naPartida.get(c) === this.chave(await lerLocal(this.raiz, c))) continue;
        this.naPartida.delete(c);
        await this.enviarSePreciso(c);
      }
    } catch {
      // A próxima varredura tenta de novo.
    }
  }

  // A conexão caiu e voltou: as escritas no ar se perderam. A sala manda o
  // estado de novo, e o que só existe aqui sai outra vez com a base antiga.
  reconectou(): void {
    this.enfileirar(async () => {
      this.emVoo.clear();
      this.esperandoAtual.clear();
    });
  }

  async parar(): Promise<void> {
    for (const r of this.relogios.values()) clearTimeout(r);
    clearTimeout(this.lote);
    clearInterval(this.varredura);
    await this.vigia?.parar();
    await this.fila;
  }

  // Termina quando tudo o que já chegou foi tratado (para os testes).
  ocioso(): Promise<void> {
    return this.fila.then(() => undefined);
  }

  receber(mensagem: MensagemDaSala): void {
    this.enfileirar(() => this.tratar(mensagem));
  }

  private enfileirar(tarefa: () => Promise<void>) {
    const vez = this.fila.then(tarefa);
    this.fila = vez.catch((e: unknown) => this.amb.escrever(`Erro na sincronização: ${e instanceof Error ? e.message : String(e)}`));
  }

  // Eventos do vigia: espera 150 ms sem eventos no arquivo e junta num lote.
  private aoMudar(absolutos: string[]) {
    for (const absoluto of absolutos) {
      if (basename(absoluto).startsWith(PREFIXO_TEMPORARIO)) continue;
      const caminho = relative(this.raiz, absoluto).split(sep).join("/");
      if (!caminho || caminho.startsWith("..")) continue;
      clearTimeout(this.relogios.get(caminho));
      this.relogios.set(
        caminho,
        setTimeout(() => {
          this.relogios.delete(caminho);
          this.prontos.add(caminho);
          clearTimeout(this.lote);
          this.lote = setTimeout(() => this.enviarLote(), 0);
        }, this.esperaMs),
      );
    }
  }

  private enviarLote(tentativa = 0) {
    const caminhos = [...this.prontos];
    this.prontos.clear();
    this.enfileirar(async () => {
      try {
        // Pasta apagada: os arquivos conhecidos dentro dela foram juntos.
        const todos = new Set(caminhos);
        for (const c of caminhos) for (const k of this.conhecidos.keys()) if (k.startsWith(`${c}/`)) todos.add(k);
        const circulam = [...todos].filter(podeCircular);
        const ignorados = await ignoradosPeloGit(this.amb, this.raiz, circulam);
        for (const c of circulam) if (!ignorados.has(c)) await this.enviarSePreciso(c);
      } catch (e) {
        // O git falhou (máquina ocupada, arquivo travado): o lote volta e sai
        // de novo daqui a pouco, em vez de sumir.
        if (tentativa === 0) this.amb.escrever(`Não consegui conferir as mudanças agora (${e instanceof Error ? e.message : String(e)}). Tentando de novo...`);
        for (const c of caminhos) this.prontos.add(c);
        clearTimeout(this.lote);
        this.lote = setTimeout(() => this.enviarLote(tentativa + 1), Math.min(500 * 2 ** tentativa, 10_000));
      }
    });
  }

  private async enviarSePreciso(caminho: string): Promise<void> {
    // Uma escrita por vez: a próxima sai quando a sala responder.
    if (this.emVoo.has(caminho)) return;
    const local = await lerLocal(this.raiz, caminho);
    if (!local) return;
    const conhecido = this.conhecidos.get(caminho);
    if (conhecido && mesmo(conhecido, local)) return;

    let conteudoBase: string | null | undefined;
    if (!conhecido) {
      // Nunca veio da sala: a referência é o arquivo no baseSha.
      const base = await arquivoNaBase(this.amb, this.raiz, this.baseSha, caminho);
      if (!base.existe && local.apagado) return;
      if (base.existe && base.conteudo !== null && !local.apagado && (await hashDoConteudo(base.conteudo, false)) === local.hash) {
        this.conhecidos.set(caminho, { versao: 0, hash: local.hash, apagado: false });
        return;
      }
      conteudoBase = base.existe ? base.conteudo : null;
    }

    if (local.existe && local.tamanho > TAMANHO_MAXIMO) {
      if (!this.avisados.has(caminho)) this.amb.escrever(`${caminho} tem mais de 1 MB e não vai para a jam.`);
      this.avisados.add(caminho);
      return;
    }

    this.emVoo.set(caminho, { hash: local.hash, apagado: local.apagado });
    this.transporte.enviar({
      v: 1,
      tipo: "escrever",
      caminho,
      versaoBase: conhecido?.versao ?? 0,
      hash: local.hash,
      conteudo: local.existe ? local.conteudo : "",
      binario: local.existe ? local.binario : false,
      apagado: local.apagado,
      ...(conteudoBase !== undefined ? { conteudoBase } : {}),
    });
  }

  private async tratar(m: MensagemDaSala): Promise<void> {
    switch (m.tipo) {
      case "aceito": {
        const enviado = this.emVoo.get(m.caminho);
        this.emVoo.delete(m.caminho);
        this.conhecidos.set(m.caminho, { versao: m.versao, hash: m.hash, apagado: enviado?.apagado ?? false });
        // O arquivo pode ter mudado enquanto a escrita estava no ar.
        await this.enviarSePreciso(m.caminho);
        return;
      }
      case "recusado":
        this.emVoo.delete(m.caminho);
        if (m.motivo === "conflito_guardado") {
          this.esperandoAtual.add(m.caminho);
          this.amb.escrever(`Conflito em ${m.caminho}: outra pessoa mudou o mesmo trecho antes. A sua versão ficou guardada no histórico da jam, e o arquivo voltou para a versão atual.`);
        } else if (m.motivo === "grande_demais") {
          this.amb.escrever(`${m.caminho} tem mais de 1 MB e não vai para a jam.`);
        }
        return;
      case "arquivo":
        await this.aplicar(m);
        return;
      default:
        return;
    }
  }

  private async aplicar(m: MensagemArquivo): Promise<void> {
    const local = await lerLocal(this.raiz, m.caminho);
    // Caminho que não pode ser gravado aqui (fora da raiz, .git, link): recusa (FR18).
    if (!local) return;
    const enviado = this.emVoo.get(m.caminho);
    const atualDepoisDoConflito = this.esperandoAtual.has(m.caminho);
    // O merge que a sala fez com a nossa escrita: só grava se a pasta ainda
    // tem o que enviamos (senão a mudança nova sai com a base antiga).
    const nossoMerge = m.origem === "merge" && m.autorId === this.eu && enviado !== undefined && mesmo(enviado, local);
    // Nossa escrita está no ar: a resposta da sala resolve; não grava por cima.
    if (enviado && !nossoMerge && !atualDepoisDoConflito) return;

    if (!nossoMerge && !atualDepoisDoConflito && !(await this.semMudancaLocal(m.caminho, local, m))) {
      await this.enviarSePreciso(m.caminho);
      return;
    }

    this.esperandoAtual.delete(m.caminho);
    this.emVoo.delete(m.caminho);
    if (!mesmo(local, m) && !(await gravarNoDisco(this.raiz, m.caminho, m, this.crlf))) return;
    this.conhecidos.set(m.caminho, { versao: m.versao, hash: m.hash, apagado: m.apagado });
  }

  // A pasta não tem mudança deste arquivo que a sala ainda não conhece?
  private async semMudancaLocal(caminho: string, local: Local, chegou: { hash: string; apagado: boolean }): Promise<boolean> {
    if (mesmo(local, chegou)) return true;
    const conhecido = this.conhecidos.get(caminho);
    if (conhecido) return mesmo(conhecido, local);
    const base = await arquivoNaBase(this.amb, this.raiz, this.baseSha, caminho);
    if (!base.existe) return local.apagado;
    return !local.apagado && base.conteudo !== null && (await hashDoConteudo(base.conteudo, false)) === local.hash;
  }
}
