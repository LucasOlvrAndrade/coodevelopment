import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashDoConteudo, type MensagemDaSala, type MensagemEscrever } from "@coodevelopment/protocolo";
import { afterEach, describe, expect, it, vi } from "vitest";

// Cada caso cria um repositório e roda git de verdade: com a máquina ocupada
// (o monorepo inteiro testando junto), passa dos 5 s padrão.
vi.setConfig({ testTimeout: 30_000 });
import { ArmazenamentoEmMemoria, Sincronizacao } from "../../../../apps/sala/src/sincronizacao";
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
  const tocar = async (nome = "texto.txt") => {
    avisar([join(raiz, nome)]);
    await new Promise((r) => setTimeout(r, 100));
    await sinc.ocioso();
  };
  // O vigia avisando que perdeu eventos pede uma varredura na hora.
  const varrer = async () => {
    avisar(null);
    await sinc.ocioso();
  };
  return { raiz, enviados, linhas, mudar, tocar, varrer, daSala, arquivo, ler: () => readFileSync(join(raiz, "texto.txt"), "utf8") };
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

    // A segunda edição não se perdeu: o conector juntou com o merge da sala
    // (DATA-005) e mandou o resultado a partir da versão do merge.
    const tudo = "UM\nDOIS\ntres\nquatro\ncinco\nSEIS\n";
    expect(t.ler()).toBe(tudo);
    expect(t.enviados.at(-1)).toMatchObject({ versaoBase: 2, conteudo: tudo });

    // E a resposta seguinte da sala é tratada: nada ficou preso.
    await t.daSala({ v: 1, tipo: "aceito", caminho: "texto.txt", versao: 3, hash: await hashDoConteudo(tudo, false) });
    expect(t.ler()).toBe(tudo);
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

describe("com a regra de verdade da sala (gate da 3.3, DATA-005)", () => {
  it("duas edições seguidas em linhas vizinhas enquanto outra pessoa muda outro trecho: tudo se junta, sem conflito falso", async () => {
    const t = await preparar();
    const armazenamento = new ArmazenamentoEmMemoria();
    const sala = new Sincronizacao(armazenamento);
    const base = "um\ndois\ntres\nquatro\ncinco\nseis\n";
    // Entrega à sala o que o lucas mandou e devolve a ele as respostas.
    const levar = async (m: MensagemEscrever) => {
      for (const { para, mensagem } of await sala.escrever("lucas", m)) if (para !== "outros") await t.daSala(mensagem);
    };

    // 1. O Claude do lucas muda a linha 1; a escrita fica no ar.
    const primeira = await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    // 2. Enquanto isso, a escrita do pai na linha 6 chega antes à sala.
    await sala.escrever("pai", { v: 1, tipo: "escrever", caminho: "texto.txt", versaoBase: 0, hash: await hashDoConteudo("um\ndois\ntres\nquatro\ncinco\nSEIS\n", false), conteudo: "um\ndois\ntres\nquatro\ncinco\nSEIS\n", binario: false, apagado: false, conteudoBase: base });
    // 3. O Claude do lucas edita de novo, na linha 2, colada na primeira.
    writeFileSync(join(t.raiz, "texto.txt"), "UM\nDOIS\ntres\nquatro\ncinco\nseis\n");
    // 4. Só agora a primeira escrita do lucas chega à sala, que junta com a do pai.
    const antes = t.enviados.length;
    await levar(primeira);
    // O conector juntou a segunda edição com o merge da sala e mandou o resultado.
    await vi.waitFor(() => expect(t.enviados.length).toBeGreaterThan(antes), { timeout: 15_000 });
    await levar(t.enviados.at(-1)!);

    const tudo = "UM\nDOIS\ntres\nquatro\ncinco\nSEIS\n";
    expect(t.ler()).toBe(tudo);
    expect(armazenamento.ler("texto.txt")).toMatchObject({ conteudo: tudo });
    expect(armazenamento.historico).toEqual([]);
    expect(t.linhas.filter((l) => l.startsWith("Conflito"))).toEqual([]);
  });

  it("escrita sem resposta sai de novo na varredura, mesmo sem edição nova (REL-008)", async () => {
    const t = await preparar();
    const primeira = await t.mudar("UM\ndois\ntres\nquatro\ncinco\nseis\n");
    const agora = Date.now();
    const relogio = vi.spyOn(Date, "now").mockReturnValue(agora + 31_000);
    try {
      await t.varrer();
      expect(t.enviados.at(-1)).toMatchObject({ conteudo: primeira.conteudo, versaoBase: 0 });
      expect(t.enviados).toHaveLength(2);
    } finally {
      relogio.mockRestore();
    }
  });

  it("nome que não funciona no Windows avisa uma vez e não sai (SEC-004)", async () => {
    const t = await preparar();
    writeFileSync(join(t.raiz, "backup~1.txt"), "x");
    await t.tocar("backup~1.txt");
    await t.tocar("backup~1.txt");
    expect(t.enviados).toEqual([]);
    expect(t.linhas.filter((l) => l === "backup~1.txt tem um nome que não funciona no Windows e não vai para a jam.")).toHaveLength(1);
  });
});
