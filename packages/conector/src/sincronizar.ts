import { lstat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { TAMANHO_MAXIMO, caminhoSincronizavel, hashDoConteudo, juntar, type MensagemArquivo, type MensagemDaSala, type MensagemEscrever } from "@coodevelopment/protocolo";
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
// O que saiu, com o conteúdo: base do merge local quando a pasta muda
// enquanto a escrita está no ar (gate da 3.3, DATA-005).
type Enviado = { hash: string; apagado: boolean; em: number; conteudo: string; binario: boolean };

// Escrita sem resposta da sala por tanto tempo se perdeu: sai de novo.
const SEM_RESPOSTA_MS = 30_000;

const mesmo = (a: { hash: string; apagado: boolean }, b: { hash: string; apagado: boolean }) => a.hash === b.hash && a.apagado === b.apagado;

export class Sincronizador {
  // Última versão de cada arquivo que este conector conhece da sala.
  private conhecidos = new Map<string, Versao>();
  // Escrita enviada esperando a resposta da sala, por arquivo.
  private emVoo = new Map<string, Enviado>();
  // Depois de um conflito, o próximo arquivo que chega é o atual; guarda o
  // que foi enviado, para saber se a pasta mudou depois.
  private esperandoAtual = new Map<string, Enviado>();
  // Arquivos que chegaram e não puderam ser gravados (presos por outro programa).
  private aGravar = new Map<string, MensagemArquivo>();
  // Data e tamanho de cada arquivo na última varredura: só relê o que mudou.
  private vistos = new Map<string, string>();
  private avisouVarredura = false;
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
    for (const c of await this.candidatos()) {
      this.naPartida.set(c, this.chave(await lerLocal(this.raiz, c)));
      this.vistos.set(c, await this.marca(c));
    }
  }

  // Data e tamanho do arquivo no disco; "" se não existe.
  private async marca(caminho: string): Promise<string> {
    const info = await lstat(join(this.raiz, ...caminho.split("/"))).catch(() => null);
    return info ? `${info.mtimeMs}:${info.size}` : "";
  }

  private async varrer(): Promise<void> {
    try {
      // O que chegou e não pôde ser gravado tenta de novo.
      for (const m of [...this.aGravar.values()]) await this.aplicar(m);
      // Escrita sem resposta há mais de 30 s sai de novo, mesmo sem edição
      // nova no arquivo (gate da 3.3, REL-008).
      for (const [c, e] of [...this.emVoo]) if (Date.now() - e.em >= SEM_RESPOSTA_MS) await this.enviarSePreciso(c);
      for (const c of await this.candidatos()) {
        // Só relê e calcula o hash do que mudou de data ou tamanho desde a
        // última varredura (gate da 3.3, PERF-001; NFR6).
        const marca = await this.marca(c);
        if (this.vistos.get(c) === marca) continue;
        if (this.naPartida.get(c) !== this.chave(await lerLocal(this.raiz, c))) {
          this.naPartida.delete(c);
          await this.enviarSePreciso(c);
        }
        // Marcado só depois do envio: se o git falhar no meio, a próxima
        // varredura tenta de novo (REL-008).
        this.vistos.set(c, marca);
      }
      this.avisouVarredura = false;
    } catch (e) {
      // A próxima varredura tenta de novo; avisa uma vez, sem encher o terminal.
      if (!this.avisouVarredura) this.amb.escrever(`Não consegui conferir a pasta agora (${e instanceof Error ? e.message : String(e)}). Tento de novo em instantes.`);
      this.avisouVarredura = true;
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
        // Nome que não funciona no Windows (":", "?", "~1"...) não vai, e a
        // pessoa fica sabendo uma vez; o que a lista fixa barra (.env,
        // node_modules) não vai em silêncio (gate da 3.3, SEC-004).
        for (const c of todos) {
          const permitido = caminhoSincronizavel(c);
          if (permitido.ok || permitido.motivo !== "caminho_invalido" || this.avisados.has(c)) continue;
          this.avisados.add(c);
          this.amb.escrever(`${c} tem um nome que não funciona no Windows e não vai para a jam.`);
        }
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
    // Uma escrita por vez: a próxima sai quando a sala responder. Sem
    // resposta em 30 s, a escrita se perdeu e sai de novo (gate da 3.3, DATA-001).
    const noAr = this.emVoo.get(caminho);
    if (noAr && Date.now() - noAr.em < SEM_RESPOSTA_MS) return;
    this.emVoo.delete(caminho);
    const local = await lerLocal(this.raiz, caminho);
    if (!local) return;
    const conhecido = this.conhecidos.get(caminho);
    if (conhecido && mesmo(conhecido, local)) return;

    // A partir da versão 0 (o baseSha), a base vai junto: a sala precisa dela
    // para juntar, mesmo que a pasta já tenha sido conferida igual à base
    // antes (gate da 3.3, DATA-003).
    let conteudoBase: string | null | undefined;
    if (!conhecido || conhecido.versao === 0) {
      const base = await arquivoNaBase(this.amb, this.raiz, this.baseSha, caminho);
      if (!conhecido) {
        if (!base.existe && local.apagado) return;
        if (base.existe && base.conteudo !== null && !local.apagado && (await hashDoConteudo(base.conteudo, false)) === local.hash) {
          this.conhecidos.set(caminho, { versao: 0, hash: local.hash, apagado: false });
          return;
        }
      }
      conteudoBase = base.existe ? base.conteudo : null;
    }

    if (local.existe && local.tamanho > TAMANHO_MAXIMO) {
      if (!this.avisados.has(caminho)) this.amb.escrever(`${caminho} tem mais de 1 MB e não vai para a jam.`);
      this.avisados.add(caminho);
      return;
    }

    this.emVoo.set(caminho, {
      hash: local.hash,
      apagado: local.apagado,
      em: Date.now(),
      conteudo: local.existe ? local.conteudo : "",
      binario: local.existe ? local.binario : false,
    });
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
      case "recusado": {
        const enviado = this.emVoo.get(m.caminho);
        this.emVoo.delete(m.caminho);
        if (m.motivo === "conflito_guardado") {
          if (enviado) this.esperandoAtual.set(m.caminho, enviado);
          this.amb.escrever(`Conflito em ${m.caminho}: outra pessoa mudou o mesmo trecho antes. A sua versão ficou guardada no histórico da jam, e o arquivo voltou para a versão atual.`);
        } else if (m.motivo === "grande_demais") {
          this.amb.escrever(`${m.caminho} tem mais de 1 MB e não vai para a jam.`);
        } else if (m.motivo === "erro") {
          this.amb.escrever(`A sala não conseguiu receber ${m.caminho}. Ele sai de novo na próxima mudança.`);
        }
        return;
      }
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
    const recusado = this.esperandoAtual.get(m.caminho);

    if (enviado) {
      if (m.origem === "merge" && m.autorId === this.eu) {
        // O merge que a sala fez com a nossa escrita resolve a escrita. Se a
        // pasta mudou depois do envio, não grava por cima: a pasta sai de novo
        // com a base antiga, e a sala junta com o que já tem (gate da 3.3, DATA-001).
        this.emVoo.delete(m.caminho);
        if (!mesmo(enviado, local)) {
          // A pasta mudou depois do envio (o Claude editou de novo). Junta
          // aqui: base = o que enviamos, nosso = a pasta, deles = o merge da
          // sala. Reenviar a pasta com a base antiga dava conflito falso
          // quando a segunda edição encostava na primeira (gate da 3.3, DATA-005).
          const juntado =
            local.existe && !local.binario && !enviado.binario && !enviado.apagado && !m.binario && !m.apagado
              ? juntar(enviado.conteudo, local.conteudo, m.conteudo)
              : null;
          if (juntado !== null) {
            try {
              if (!(await gravarNoDisco(this.raiz, m.caminho, { conteudo: juntado, binario: false, apagado: false }, this.crlf))) return;
            } catch {
              // Arquivo preso: a pasta sai como está, com a base antiga.
              await this.enviarSePreciso(m.caminho);
              return;
            }
            // A sala está no merge; o que juntamos sai a partir dele.
            this.conhecidos.set(m.caminho, { versao: m.versao, hash: m.hash, apagado: m.apagado });
          }
          // Sem como juntar (binário, apagado, trechos cruzados): a pasta sai
          // com a base antiga, e o que cruzar vai para o histórico da sala.
          await this.enviarSePreciso(m.caminho);
          return;
        }
      } else if (m.origem === "estado") {
        // A sala não reconheceu a versão da nossa escrita (perdeu o estado).
        // A pasta sai a partir do baseSha (versão 0): a sala junta com o que
        // tem, e o que cruzar vai para o histórico, em vez de a pasta
        // substituir a versão de outra pessoa (gate da 3.3, REL-007).
        this.emVoo.delete(m.caminho);
        // Pasta já igual ao que veio: a versão da sala é a conhecida, e nada
        // sai (marcar a versão 0 dava conflito falso depois; gate da 3.3, REL-009).
        if (mesmo(local, m)) {
          this.conhecidos.set(m.caminho, { versao: m.versao, hash: m.hash, apagado: m.apagado });
          return;
        }
        this.conhecidos.set(m.caminho, { versao: 0, hash: "", apagado: false });
        await this.enviarSePreciso(m.caminho);
        return;
      } else {
        // A escrita de outra pessoa chegou antes da resposta à nossa: a sala
        // vai juntar a nossa com ela e mandar o resultado.
        return;
      }
    } else if (recusado) {
      // Depois de um conflito: se a pasta mudou depois do envio que perdeu,
      // não sobrescreve; sai de novo, e o que cruzar vai inteiro para o
      // histórico da sala (gate da 3.3, DATA-002).
      this.esperandoAtual.delete(m.caminho);
      if (!mesmo(recusado, local)) {
        await this.enviarSePreciso(m.caminho);
        return;
      }
    } else if (!(await this.semMudancaLocal(m.caminho, local, m))) {
      await this.enviarSePreciso(m.caminho);
      return;
    }

    if (!mesmo(local, m)) {
      try {
        if (!(await gravarNoDisco(this.raiz, m.caminho, m, this.crlf))) return;
      } catch (e) {
        // Arquivo preso por outro programa: tenta de novo na varredura, em vez
        // de a pasta ficar para trás da sala (gate da 3.3, REL-003).
        if (!this.aGravar.has(m.caminho)) this.amb.escrever(`Não consegui gravar ${m.caminho} (${e instanceof Error ? e.message : String(e)}). Vou tentar de novo.`);
        this.aGravar.set(m.caminho, m);
        return;
      }
    }
    this.aGravar.delete(m.caminho);
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
