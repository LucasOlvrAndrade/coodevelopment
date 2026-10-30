import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashDoConteudo, mensagemDaSala, mensagemDoConector, type MensagemDaSala } from "@coodevelopment/protocolo";
import { afterEach, describe, expect, it } from "vitest";
import { ArmazenamentoEmMemoria, Sincronizacao } from "../../../../apps/sala/src/sincronizacao";
import { ambienteReal } from "../../src/ambiente";
import { Sincronizador, type Vigiar } from "../../src/sincronizar";

// Teste de integração da Story 3.3 (AC 7): duas (ou três) pastas de verdade
// com git, o vigia de verdade e a regra de verdade da sala, ligados por uma
// "rede" em memória com um pequeno atraso. As mensagens passam por JSON e
// pelo zod do protocolo nas duas pontas, como no WebSocket.

const REDE_MS = 5;

class SalaEmMemoria {
  armazenamento = new ArmazenamentoEmMemoria();
  sinc = new Sincronizacao(this.armazenamento);
  conexoes = new Map<string, { eu: string; receber: (m: MensagemDaSala) => void }>();
  escritas = 0;

  private entregar(id: string, m: MensagemDaSala) {
    const texto = JSON.stringify(m);
    setTimeout(() => this.conexoes.get(id)?.receber(mensagemDaSala.parse(JSON.parse(texto))), REDE_MS);
  }

  // Injeta uma mensagem da sala direto num conector (para testar o que ele recusa).
  forcar(id: string, m: MensagemDaSala) {
    this.entregar(id, m);
  }

  conectar(id: string, eu: string, receber: (m: MensagemDaSala) => void) {
    this.conexoes.set(id, { eu, receber });
    for (const m of this.sinc.estado()) this.entregar(id, m);
    return {
      enviar: (msg: unknown) => {
        this.escritas++;
        const texto = JSON.stringify(msg);
        setTimeout(async () => {
          const escrita = mensagemDoConector.parse(JSON.parse(texto));
          for (const { para, mensagem } of await this.sinc.escrever(eu, escrita)) {
            for (const [outro] of this.conexoes) {
              if (para === "autor" ? outro === id : para === "outros" ? outro !== id : true) this.entregar(outro, mensagem);
            }
          }
        }, REDE_MS);
      },
    };
  }
}

const pastas: string[] = [];
const ligados: Sincronizador[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function pastaTemporaria(nome: string) {
  const p = mkdtempSync(join(tmpdir(), `coodev-${nome}-`));
  pastas.push(p);
  return p;
}

// Repositório de partida com o commit base, e clones dele (o mesmo baseSha).
function repositorioBase() {
  const origem = pastaTemporaria("origem");
  git(origem, "init", "-q", "-b", "main");
  git(origem, "config", "user.email", "teste@exemplo.test");
  git(origem, "config", "user.name", "Teste");
  git(origem, "config", "core.autocrlf", "false");
  writeFileSync(join(origem, "README.md"), "# projeto\n");
  writeFileSync(join(origem, "texto.txt"), "um\ndois\ntres\nquatro\ncinco\nseis\n");
  writeFileSync(join(origem, "windows.txt"), "linha a\r\nlinha b\r\n");
  writeFileSync(join(origem, ".gitignore"), "dist/\n*.log\n");
  git(origem, "add", "-A");
  git(origem, "commit", "-q", "-m", "base");
  return { origem, baseSha: git(origem, "rev-parse", "HEAD") };
}

function clonar(origem: string, nome: string) {
  const pasta = pastaTemporaria(nome);
  rmSync(pasta, { recursive: true });
  execFileSync("git", ["-c", "core.autocrlf=false", "clone", "-q", origem, pasta]);
  git(pasta, "config", "core.autocrlf", "false");
  return pasta;
}

// O vigia de verdade e, por padrão, a varredura a cada 1 s (em produção, 10 s).
async function ligar(sala: SalaEmMemoria, pasta: string, baseSha: string, eu: string, opcoes: { vigiar?: Vigiar; varreduraMs?: number } = {}) {
  const linhas: string[] = [];
  const anterior = diagnostico;
  diagnostico = () =>
    `${anterior()} | ${eu}: sala=${JSON.stringify(sala.armazenamento.todos().map((r) => [r.caminho, r.versao, r.apagado]))} escritas=${sala.escritas} ` +
    `disse=${JSON.stringify(linhas)} pasta=${JSON.stringify(["README.md", "texto.txt", "notas.md", "src/novo.ts"].map((c) => [c, ler(pasta, c)]))}`;
  const amb = { ...ambienteReal(), cwd: pasta, escrever: (l: string) => linhas.push(l) };
  let sinc: Sincronizador | undefined = undefined;
  const transporte = sala.conectar(pasta, eu, (m) => sinc?.receber(m));
  sinc = new Sincronizador(amb, pasta, baseSha, eu, transporte, opcoes.vigiar, undefined, opcoes.varreduraMs ?? 1000);
  await sinc.iniciar();
  ligados.push(sinc);
  return { sinc, linhas };
}

// Quando uma espera estoura, o erro diz o que a sala e as pastas têm.
let diagnostico: () => string = () => "";

async function ate(condicao: () => boolean, ms = 8000) {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > ms) throw new Error(`não aconteceu a tempo. ${diagnostico()}`);
    await new Promise((r) => setTimeout(r, 20));
  }
  return Date.now() - inicio;
}

const ler = (pasta: string, caminho: string) => (existsSync(join(pasta, caminho)) ? readFileSync(join(pasta, caminho), "utf8") : null);
const quieto = (ms = 600) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  diagnostico = () => "";
  for (const s of ligados.splice(0)) await s.parar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("sincronização entre duas pastas (Story 3.3)", () => {
  it("criar, mudar e apagar chegam à outra pasta em menos de 2 s (AC 1)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas");
    await ligar(sala, pai, baseSha, "pai");

    mkdirSync(join(lucas, "src"));
    writeFileSync(join(lucas, "src", "novo.ts"), "export const x = 1;\n");
    expect(await ate(() => ler(pai, "src/novo.ts") === "export const x = 1;\n")).toBeLessThan(2000);

    writeFileSync(join(pai, "README.md"), "# projeto\n\nmudado pelo pai\n");
    expect(await ate(() => ler(lucas, "README.md") === "# projeto\n\nmudado pelo pai\n")).toBeLessThan(2000);

    rmSync(join(lucas, "src", "novo.ts"));
    expect(await ate(() => ler(pai, "src/novo.ts") === null)).toBeLessThan(2000);

    rmSync(join(pai, "texto.txt"));
    expect(await ate(() => ler(lucas, "texto.txt") === null)).toBeLessThan(2000);
  }, 30_000);

  it("o .gitignore, o .env, as pastas de dependência e arquivo acima de 1 MB não saem (AC 2)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    const sala = new SalaEmMemoria();
    const { linhas } = await ligar(sala, lucas, baseSha, "lucas");
    await ligar(sala, pai, baseSha, "pai");

    mkdirSync(join(lucas, "dist"));
    writeFileSync(join(lucas, "dist", "app.js"), "compilado");
    writeFileSync(join(lucas, "debug.log"), "log");
    writeFileSync(join(lucas, ".env"), "SEGREDO=1");
    writeFileSync(join(lucas, ".env.local"), "SEGREDO=2");
    mkdirSync(join(lucas, "node_modules", "pacote"), { recursive: true });
    writeFileSync(join(lucas, "node_modules", "pacote", "index.js"), "x");
    writeFileSync(join(lucas, "grande.txt"), "x".repeat(1024 * 1024 + 10));
    writeFileSync(join(lucas, ".env.example"), "SEGREDO=");
    await ate(() => ler(pai, ".env.example") === "SEGREDO=");
    await quieto();

    for (const c of ["dist/app.js", "debug.log", ".env", ".env.local", "node_modules/pacote/index.js", "grande.txt"]) expect(ler(pai, c)).toBeNull();
    expect(sala.armazenamento.todos().map((r) => r.caminho)).toEqual([".env.example"]);
    expect(linhas).toContain("grande.txt tem mais de 1 MB e não vai para a jam.");
  }, 30_000);

  it("arquivo de fora da pasta, de dentro do .git ou por junção de pasta não é gravado (AC 3)", async () => {
    const { origem, baseSha } = repositorioBase();
    const pai = clonar(origem, "pai");
    const fora = pastaTemporaria("fora");
    symlinkSync(fora, join(pai, "atalho"), "junction");
    const sala = new SalaEmMemoria();
    await ligar(sala, pai, baseSha, "pai");

    const hash = await hashDoConteudo("invasão\n", false);
    for (const caminho of [".git/hooks/pre-commit", "atalho/x.txt", "../fora.txt"]) {
      sala.forcar(pai, { v: 1, tipo: "arquivo", caminho, versao: 1, hash, conteudo: "invasão\n", binario: false, apagado: false, autorId: "lucas", origem: "escrita" });
    }
    await quieto();
    expect(existsSync(join(pai, ".git", "hooks", "pre-commit"))).toBe(false);
    expect(existsSync(join(fora, "x.txt"))).toBe(false);
    expect(existsSync(join(pai, "..", "fora.txt"))).toBe(false);
  }, 30_000);

  it("CRLF e LF: cada pasta mantém o final de linha do arquivo, sem mudança falsa nem laço (AC 4)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    // Na pasta do pai, o texto.txt está em CRLF; na do lucas, em LF.
    writeFileSync(join(pai, "texto.txt"), "um\r\ndois\r\ntres\r\nquatro\r\ncinco\r\nseis\r\n");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas");
    await ligar(sala, pai, baseSha, "pai");
    await quieto();
    // Só trocar o final de linha não é mudança.
    expect(sala.escritas).toBe(0);

    writeFileSync(join(lucas, "texto.txt"), "um\ndois\ntres\nquatro\ncinco\nSEIS\n");
    await ate(() => ler(pai, "texto.txt") === "um\r\ndois\r\ntres\r\nquatro\r\ncinco\r\nSEIS\r\n");
    writeFileSync(join(lucas, "windows.txt"), "linha a\r\nlinha B\r\n");
    await ate(() => ler(pai, "windows.txt") === "linha a\r\nlinha B\r\n");
    await quieto();
    const escritas = sala.escritas;
    await quieto(1000);
    // Sem eco: a gravação na pasta do pai não volta como escrita.
    expect(sala.escritas).toBe(escritas);
    expect(escritas).toBe(2);
  }, 30_000);

  it("quem conecta depois recebe a versão atual da sala (AC 5)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas");
    writeFileSync(join(lucas, "notas.md"), "notas do lucas\n");
    writeFileSync(join(lucas, "README.md"), "# projeto do lucas\n");
    rmSync(join(lucas, "texto.txt"));
    await ate(() => sala.armazenamento.todos().length === 3);

    const pai = clonar(origem, "pai");
    await ligar(sala, pai, baseSha, "pai");
    await ate(() => ler(pai, "notas.md") === "notas do lucas\n" && ler(pai, "README.md") === "# projeto do lucas\n" && ler(pai, "texto.txt") === null);
  }, 30_000);

  it("mudanças em linhas diferentes do mesmo arquivo se juntam nas duas pastas (AC 6)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas");
    await ligar(sala, pai, baseSha, "pai");

    // As duas antes de qualquer uma chegar à outra pasta.
    writeFileSync(join(lucas, "texto.txt"), "UM\ndois\ntres\nquatro\ncinco\nseis\n");
    writeFileSync(join(pai, "texto.txt"), "um\ndois\ntres\nquatro\ncinco\nSEIS\n");
    const juntos = "UM\ndois\ntres\nquatro\ncinco\nSEIS\n";
    await ate(() => ler(lucas, "texto.txt") === juntos && ler(pai, "texto.txt") === juntos);
    expect(sala.armazenamento.historico).toEqual([]);
  }, 30_000);

  it("a mesma linha mudada nas duas pastas: fica uma, a outra vai para o histórico com aviso, e as pastas terminam iguais (AC 6)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    const sala = new SalaEmMemoria();
    const a = await ligar(sala, lucas, baseSha, "lucas");
    const b = await ligar(sala, pai, baseSha, "pai");

    writeFileSync(join(lucas, "texto.txt"), "um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nseis\n");
    writeFileSync(join(pai, "texto.txt"), "um\nDOIS DO PAI\ntres\nquatro\ncinco\nseis\n");
    await ate(() => sala.armazenamento.historico.length === 1);
    await ate(() => ler(lucas, "texto.txt") !== null && ler(lucas, "texto.txt") === ler(pai, "texto.txt"));
    const perdeu = sala.armazenamento.historico[0]!;
    expect(perdeu.motivo).toBe("conflito");
    expect([...a.linhas, ...b.linhas]).toContain(
      "Conflito em texto.txt: outra pessoa mudou o mesmo trecho antes. A sua versão ficou guardada no histórico da jam, e o arquivo voltou para a versão atual.",
    );
    // Nada se perdeu: a versão que não ficou está no histórico.
    expect([ler(lucas, "texto.txt"), perdeu.conteudo].sort()).toEqual(["um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nseis\n", "um\nDOIS DO PAI\ntres\nquatro\ncinco\nseis\n"]);
  }, 30_000);
});

describe("varredura: o que o vigia perde ainda chega (Story 3.3)", () => {
  // Um vigia que nunca avisa nada: só a varredura pode mandar.
  const surdo: Vigiar = async () => ({ parar: async () => {} });

  it("criar, mudar e apagar sem nenhum evento do vigia chegam pela varredura", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas", { vigiar: surdo, varreduraMs: 300 });
    await ligar(sala, pai, baseSha, "pai");

    writeFileSync(join(lucas, "notas.md"), "sem evento\n");
    writeFileSync(join(lucas, "README.md"), "# mudado sem evento\n");
    rmSync(join(lucas, "texto.txt"));
    await ate(() => ler(pai, "notas.md") === "sem evento\n" && ler(pai, "README.md") === "# mudado sem evento\n" && ler(pai, "texto.txt") === null);
  }, 30_000);

  it("o que já estava diferente na pasta antes de ligar não sai; mudar depois sai (divergência é a Story 5.2)", async () => {
    const { origem, baseSha } = repositorioBase();
    const lucas = clonar(origem, "lucas");
    const pai = clonar(origem, "pai");
    writeFileSync(join(lucas, "rascunho.md"), "trabalho de antes\n");
    writeFileSync(join(lucas, "README.md"), "# mudado antes da jam\n");
    const sala = new SalaEmMemoria();
    await ligar(sala, lucas, baseSha, "lucas", { varreduraMs: 300 });
    await ligar(sala, pai, baseSha, "pai");
    await quieto(1200);
    expect(sala.escritas).toBe(0);
    expect(ler(pai, "rascunho.md")).toBeNull();

    writeFileSync(join(lucas, "rascunho.md"), "trabalho de antes, mexido na jam\n");
    await ate(() => ler(pai, "rascunho.md") === "trabalho de antes, mexido na jam\n");
    expect(ler(pai, "README.md")).toBe("# projeto\n");
  }, 30_000);
});
