import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashDoConteudo, type MensagemDaSala, type MensagemEscrever } from "@coodevelopment/protocolo";
import { afterEach, describe, expect, it, vi } from "vitest";

// Cada caso cria um repositório e roda git de verdade: com a máquina ocupada
// (o monorepo inteiro testando junto), passa dos 5 s padrão.
vi.setConfig({ testTimeout: 30_000 });
import { ambienteReal } from "../../src/ambiente";
import { Sincronizador, type Vigiar } from "../../src/sincronizar";

// A máquina de estados do conector (gate da 3.3: DATA-001, DATA-002,
// DATA-003), com pasta e git de verdade, mas vigia e sala na mão: os eventos
// chegam na ordem exata de cada cenário.

const pastas: string[] = [];
const ligados: Sincronizador[] = [];

afterEach(async () => {
  for (const s of ligados.splice(0)) await s.parar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

function repositorio() {
  const raiz = mkdtempSync(join(tmpdir(), "coodev-maquina-"));
  pastas.push(raiz);
  const git = (...a: string[]) => execFileSync("git", a, { cwd: raiz, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.email", "t@exemplo.test");
  git("config", "user.name", "T");
  git("config", "core.autocrlf", "false");
  writeFileSync(join(raiz, "texto.txt"), "um\ndois\ntres\nquatro\ncinco\nseis\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  return { raiz, baseSha: git("rev-parse", "HEAD") };
}

async function preparar() {
  const { raiz, baseSha } = repositorio();
  const enviados: MensagemEscrever[] = [];
  let avisar: (absolutos: string[] | null) => void = () => {};
  const vigiar: Vigiar = async (_r, aoMudar) => {
    avisar = aoMudar;
    return { parar: async () => {} };
  };
  const linhas: string[] = [];
  const sinc = new Sincronizador({ ...ambienteReal(), cwd: raiz, escrever: (l) => linhas.push(l) }, raiz, baseSha, "lucas", { enviar: (m) => enviados.push(m) }, vigiar, 10, 3_600_000);
  await sinc.iniciar();
  ligados.push(sinc);
  const mudar = async (conteudo: string) => {
    writeFileSync(join(raiz, "texto.txt"), conteudo);
    const antes = enviados.length;
    avisar([join(raiz, "texto.txt")]);
    await vi.waitFor(() => expect(enviados.length).toBeGreaterThan(antes), { timeout: 15_000 });
    return enviados.at(-1)!;
  };
  const daSala = async (m: MensagemDaSala) => {
    sinc.receber(m);
    await sinc.ocioso();
  };
  const arquivo = async (conteudo: string, versao: number, origem: "merge" | "escrita" | "estado", autorId = "lucas"): Promise<MensagemDaSala> => ({
    v: 1,
    tipo: "arquivo",
    caminho: "texto.txt",
    versao,
    hash: await hashDoConteudo(conteudo, false),
    conteudo,
    binario: false,
    apagado: false,
    autorId,
    origem,
  });
  // Evento do vigia sem esperar escrita (para mudança que não deve sair).
  const tocar = async () => {
    avisar([join(raiz, "texto.txt")]);
    await new Promise((r) => setTimeout(r, 100));
    await sinc.ocioso();
  };
  return { raiz, enviados, linhas, mudar, tocar, daSala, arquivo, ler: () => readFileSync(join(raiz, "texto.txt"), "utf8") };
}

describe("merge da nossa escrita com a pasta mudada no meio (DATA-001)", () => {
  it("não grava por cima, não trava e manda a pasta de novo a partir da base antiga", async () => {
    const t = await preparar();
    const primeira = await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    expect(primeira).toMatchObject({ versaoBase: 0 });

    // O Claude edita de novo antes da resposta da sala.
    writeFileSync(join(t.raiz, "texto.txt"), "UM\nDOIS\ntres\nquatro\ncinco\nseis\n");
    // A sala juntou a primeira com a escrita de outra pessoa (linha seis).
    await t.daSala(await t.arquivo("UM\ndois\ntres\nquatro\ncinco\nSEIS\n", 2, "merge"));

    // A pasta não foi sobrescrita e a segunda edição saiu, com a base antiga,
    // para a sala juntar com o que já tem.
    expect(t.ler()).toBe("UM\nDOIS\ntres\nquatro\ncinco\nseis\n");
    expect(t.enviados.at(-1)).toMatchObject({ versaoBase: 0, conteudo: "UM\nDOIS\ntres\nquatro\ncinco\nseis\n" });

    // E a resposta seguinte da sala (o novo merge) é gravada: nada ficou preso.
    await t.daSala(await t.arquivo("UM\nDOIS\ntres\nquatro\ncinco\nSEIS\n", 3, "merge"));
    expect(t.ler()).toBe("UM\nDOIS\ntres\nquatro\ncinco\nSEIS\n");
  });

  it("merge com a pasta igual ao que enviamos é gravado", async () => {
    const t = await preparar();
    await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    await t.daSala(await t.arquivo("UM\ndois\ntres\nquatro\ncinco\nSEIS\n", 2, "merge"));
    expect(t.ler()).toBe("UM\ndois\ntres\nquatro\ncinco\nSEIS\n");
  });

  it("escrita sem resposta por 30 s sai de novo", async () => {
    const t = await preparar();
    await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    const agora = Date.now();
    const relogio = vi.spyOn(Date, "now").mockReturnValue(agora + 31_000);
    try {
      expect((await t.mudar("UM\nDOIS\ntres\nquatro\ncinco\nseis\n")).conteudo).toBe("UM\nDOIS\ntres\nquatro\ncinco\nseis\n");
    } finally {
      relogio.mockRestore();
    }
  });
});

describe("conflito com a pasta mudada depois do envio (DATA-002)", () => {
  it("não sobrescreve o que mudou depois; manda de novo para a sala guardar inteiro", async () => {
    const t = await preparar();
    await t.mudar("um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nseis\n");
    await t.daSala({ v: 1, tipo: "recusado", caminho: "texto.txt", motivo: "conflito_guardado" });
    // Depois do envio, o lucas continuou editando outra linha.
    writeFileSync(join(t.raiz, "texto.txt"), "um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nSEIS DO LUCAS\n");
    await t.daSala(await t.arquivo("um\nDOIS DO PAI\ntres\nquatro\ncinco\nseis\n", 1, "escrita", "pai"));

    expect(t.ler()).toBe("um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nSEIS DO LUCAS\n");
    expect(t.enviados.at(-1)).toMatchObject({ versaoBase: 0, conteudo: "um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nSEIS DO LUCAS\n" });
  });

  it("sem mudança depois do envio, grava o arquivo atual da sala (a versão do autor está no histórico)", async () => {
    const t = await preparar();
    await t.mudar("um\nDOIS DO LUCAS\ntres\nquatro\ncinco\nseis\n");
    await t.daSala({ v: 1, tipo: "recusado", caminho: "texto.txt", motivo: "conflito_guardado" });
    await t.daSala(await t.arquivo("um\nDOIS DO PAI\ntres\nquatro\ncinco\nseis\n", 1, "escrita", "pai"));
    expect(t.ler()).toBe("um\nDOIS DO PAI\ntres\nquatro\ncinco\nseis\n");
  });
});

describe("base da versão 0 (DATA-003)", () => {
  it("salvar sem mudança e depois editar: a escrita leva o conteúdo do baseSha", async () => {
    const t = await preparar();
    // "Salvar" sem mudar nada: o vigia avisa, a pasta é igual à base, nada sai.
    writeFileSync(join(t.raiz, "texto.txt"), "um\ndois\ntres\nquatro\ncinco\nseis\n");
    await t.tocar();
    expect(t.enviados).toEqual([]);
    const editada = await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    expect(editada).toMatchObject({ versaoBase: 0, conteudoBase: "um\ndois\ntres\nquatro\ncinco\nseis\n" });
  });
});
