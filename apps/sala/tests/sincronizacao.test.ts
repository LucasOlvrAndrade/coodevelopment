import { hashDoConteudo, type MensagemEscrever } from "@coodevelopment/protocolo";
import { describe, expect, it } from "vitest";
import { ArmazenamentoEmMemoria, Sincronizacao, juntar } from "../src/sincronizacao";

// Regra da sincronização (Story 3.3), com o armazenamento em memória.

async function escrita(caminho: string, conteudo: string, versaoBase: number, extra: Partial<MensagemEscrever> = {}): Promise<MensagemEscrever> {
  const binario = extra.binario ?? false;
  return { v: 1, tipo: "escrever", caminho, versaoBase, hash: await hashDoConteudo(conteudo, binario), conteudo, binario, apagado: false, ...extra };
}

function nova() {
  const armazenamento = new ArmazenamentoEmMemoria();
  return { armazenamento, sinc: new Sincronizacao(armazenamento, () => "2026-10-29T12:00:00.000Z") };
}

describe("juntar (merge de três vias)", () => {
  it("junta mudanças em lugares diferentes, em LF", () => {
    expect(juntar("a\nb\nc\nd\ne\n", "a\nB\nc\nd\ne\n", "a\nb\nc\nd\nE\n")).toBe("a\nB\nc\nd\nE\n");
    expect(juntar("a\r\nb\r\nc\r\nd\r\n", "A\r\nb\r\nc\r\nd\r\n", "a\nb\nc\nD\n")).toBe("A\nb\nc\nD\n");
  });

  it("trechos cruzados não juntam", () => {
    expect(juntar("a\nb\nc\n", "a\nX\nc\n", "a\nY\nc\n")).toBeNull();
  });

  it("a mesma mudança dos dois lados não é conflito", () => {
    expect(juntar("a\nb\n", "a\nB\n", "a\nB\n")).toBe("a\nB\n");
  });
});

describe("Sincronizacao.escrever (Story 3.3)", () => {
  it("primeira escrita entra como veio: aceito para o autor e o arquivo para os outros (AC 1)", async () => {
    const { sinc } = nova();
    const envios = await sinc.escrever("lucas", await escrita("src\\app.ts", "um\r\n", 0, { conteudoBase: "zero\r\n" }));
    expect(envios).toEqual([
      { para: "autor", mensagem: { v: 1, tipo: "aceito", caminho: "src/app.ts", versao: 1, hash: await hashDoConteudo("um\n", false) } },
      { para: "outros", mensagem: expect.objectContaining({ tipo: "arquivo", caminho: "src/app.ts", versao: 1, conteudo: "um\r\n", autorId: "lucas", origem: "escrita" }) },
    ]);
  });

  it("recusa caminho que sai da raiz, a lista fixa e arquivo acima de 1 MB (AC 2 e 3)", async () => {
    const { sinc, armazenamento } = nova();
    expect(await sinc.escrever("lucas", await escrita("../fora.txt", "x", 0))).toEqual([{ para: "autor", mensagem: { v: 1, tipo: "recusado", caminho: "../fora.txt", motivo: "caminho_invalido" } }]);
    expect((await sinc.escrever("lucas", await escrita(".git/config", "x", 0)))[0]!.mensagem).toMatchObject({ motivo: "proibido" });
    expect((await sinc.escrever("lucas", await escrita(".env.local", "x", 0)))[0]!.mensagem).toMatchObject({ motivo: "proibido" });
    expect((await sinc.escrever("lucas", await escrita("grande.txt", "x".repeat(1024 * 1024 + 1), 0)))[0]!.mensagem).toMatchObject({ motivo: "grande_demais" });
    expect(armazenamento.todos()).toEqual([]);
  });

  it("duas escritas da mesma versão em lugares diferentes: a sala junta e manda para todos (AC 6)", async () => {
    const { sinc } = nova();
    const base = "a\nb\nc\nd\ne\n";
    await sinc.escrever("lucas", await escrita("x.txt", "a\nB\nc\nd\ne\n", 0, { conteudoBase: base }));
    const envios = await sinc.escrever("pai", await escrita("x.txt", "a\nb\nc\nd\nE\n", 0, { conteudoBase: base }));
    expect(envios).toEqual([{ para: "todos", mensagem: expect.objectContaining({ tipo: "arquivo", versao: 2, conteudo: "a\nB\nc\nd\nE\n", origem: "merge", autorId: "pai" }) }]);
  });

  it("trechos cruzados: fica a primeira, a segunda vai para o histórico e o autor recebe o arquivo atual (AC 6)", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("x.txt", "a\nX\nc\n", 0, { conteudoBase: "a\nb\nc\n" }));
    const envios = await sinc.escrever("pai", await escrita("x.txt", "a\nY\nc\n", 0, { conteudoBase: "a\nb\nc\n" }));
    expect(envios).toEqual([
      { para: "autor", mensagem: { v: 1, tipo: "recusado", caminho: "x.txt", motivo: "conflito_guardado" } },
      { para: "autor", mensagem: expect.objectContaining({ tipo: "arquivo", versao: 1, conteudo: "a\nX\nc\n" }) },
    ]);
    expect(armazenamento.historico).toEqual([expect.objectContaining({ caminho: "x.txt", autorId: "pai", motivo: "conflito", conteudo: "a\nY\nc\n" })]);
    expect(armazenamento.ler("x.txt")).toMatchObject({ versao: 1, conteudo: "a\nX\nc\n" });
  });

  it("arquivo novo criado nos dois lados ao mesmo tempo não se perde", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("novo.txt", "do lucas\n", 0, { conteudoBase: null }));
    const envios = await sinc.escrever("pai", await escrita("novo.txt", "do pai\n", 0, { conteudoBase: null }));
    expect(envios[0]!.mensagem).toMatchObject({ tipo: "recusado", motivo: "conflito_guardado" });
    expect(armazenamento.historico[0]).toMatchObject({ autorId: "pai", conteudo: "do pai\n" });
  });

  it("binário de versão antiga: a última vence e a anterior vai para o histórico", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("img.png", btoa("\x00um"), 0, { binario: true, conteudoBase: null }));
    const envios = await sinc.escrever("pai", await escrita("img.png", btoa("\x00dois"), 0, { binario: true }));
    expect(envios[0]!.mensagem).toMatchObject({ tipo: "aceito", versao: 2 });
    expect(armazenamento.historico[0]).toMatchObject({ autorId: "lucas", motivo: "sobrescrito", conteudo: btoa("\x00um") });
  });

  it("apagar entra como escrita; editar de versão antiga um arquivo apagado vai para o histórico", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("x.txt", "a\n", 0, { conteudoBase: "a\n" }));
    expect((await sinc.escrever("lucas", await escrita("x.txt", "", 1, { apagado: true })))[1]!.mensagem).toMatchObject({ tipo: "arquivo", versao: 2, apagado: true, conteudo: "" });
    const envios = await sinc.escrever("pai", await escrita("x.txt", "a\nb\n", 1));
    expect(envios[0]!.mensagem).toMatchObject({ motivo: "conflito_guardado" });
    expect(armazenamento.ler("x.txt")).toMatchObject({ apagado: true });
  });

  it("escritas que chegam juntas entram uma de cada vez, sem perder nenhuma", async () => {
    const { sinc } = nova();
    const base = "1\n2\n3\n4\n5\n6\n";
    const [a, b] = await Promise.all([
      sinc.escrever("lucas", await escrita("x.txt", "um\n2\n3\n4\n5\n6\n", 0, { conteudoBase: base })),
      sinc.escrever("pai", await escrita("x.txt", "1\n2\n3\n4\n5\nseis\n", 0, { conteudoBase: base })),
    ]);
    expect(a[0]!.mensagem).toMatchObject({ tipo: "aceito", versao: 1 });
    expect(b[0]!.mensagem).toMatchObject({ tipo: "arquivo", versao: 2, origem: "merge", conteudo: "um\n2\n3\n4\n5\nseis\n" });
  });

  it("versão base à frente da sala: o autor recebe o arquivo atual para recomeçar", async () => {
    const { sinc } = nova();
    await sinc.escrever("lucas", await escrita("x.txt", "a\n", 0, { conteudoBase: null }));
    const envios = await sinc.escrever("lucas", await escrita("x.txt", "b\n", 7));
    expect(envios).toEqual([{ para: "autor", mensagem: expect.objectContaining({ tipo: "arquivo", versao: 1, origem: "estado" }) }]);
  });
});

describe("Sincronizacao depois do gate (Story 3.3)", () => {
  it("caminho que só muda a caixa de um que já circula é recusado (REL-001)", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("README.md", "a\n", 0, { conteudoBase: null }));
    expect((await sinc.escrever("pai", await escrita("Readme.md", "b\n", 0, { conteudoBase: null })))[0]!.mensagem).toMatchObject({ tipo: "recusado", motivo: "caminho_invalido" });
    expect(armazenamento.todos().map((r) => r.caminho)).toEqual(["README.md"]);
  });

  it("o mesmo nome com o acento em outra forma Unicode (NFD do macOS) também colide (REL-011)", async () => {
    const { sinc } = nova();
    await sinc.escrever("lucas", await escrita("Ação.md", "a\n", 0, { conteudoBase: null }));
    const nfd = "Ação.md".normalize("NFD");
    expect(nfd).not.toBe("Ação.md");
    expect((await sinc.escrever("pai", await escrita(nfd, "b\n", 0, { conteudoBase: null })))[0]!.mensagem).toMatchObject({ motivo: "caminho_invalido" });
  });

  it("sem a base da versão 0, a escrita concorrente vai para o histórico em vez de ser juntada contra base errada (DATA-003)", async () => {
    const { sinc, armazenamento } = nova();
    // A primeira escrita veio sem conteudoBase (conector antigo).
    await sinc.escrever("lucas", await escrita("x.txt", "a\nB\nc\nd\ne\n", 0));
    expect(armazenamento.lerVersao("x.txt", 0)).toBeNull();
    const envios = await sinc.escrever("pai", await escrita("x.txt", "a\nb\nc\nd\nE\n", 0));
    expect(envios[0]!.mensagem).toMatchObject({ tipo: "recusado", motivo: "conflito_guardado" });
    expect(armazenamento.historico[0]).toMatchObject({ autorId: "pai", conteudo: "a\nb\nc\nd\nE\n" });
  });

  it("conteudoBase acima de 1 MB não é guardado (REL-002)", async () => {
    const { sinc, armazenamento } = nova();
    await sinc.escrever("lucas", await escrita("y.txt", "pequeno\n", 0, { conteudoBase: "x".repeat(1024 * 1024 + 1) }));
    expect(armazenamento.lerVersao("y.txt", 0)).toBeNull();
    expect(armazenamento.ler("y.txt")).toMatchObject({ versao: 1, conteudo: "pequeno\n" });
  });

  it("erro no meio (base64 inválido) volta como recusado, e a próxima escrita segue (REL-002)", async () => {
    const { sinc } = nova();
    const ruim = { ...(await escrita("img.png", "AAAA", 0, { binario: true })), conteudo: "isto não é base64!!" };
    expect(await sinc.escrever("lucas", ruim)).toEqual([{ para: "autor", mensagem: { v: 1, tipo: "recusado", caminho: "img.png", motivo: "erro" } }]);
    expect((await sinc.escrever("lucas", await escrita("ok.txt", "ok\n", 0, { conteudoBase: null })))[0]!.mensagem).toMatchObject({ tipo: "aceito" });
  });
});

describe("Sincronizacao.estado (AC 5)", () => {
  it("quem conecta depois recebe o manifesto e cada arquivo atual", async () => {
    const { sinc } = nova();
    await sinc.escrever("lucas", await escrita("b.txt", "bê\n", 0, { conteudoBase: null }));
    await sinc.escrever("pai", await escrita("a.txt", "a\n", 0, { conteudoBase: "a0\n" }));
    const [manifesto, ...arquivos] = sinc.estado();
    expect(manifesto).toMatchObject({ tipo: "manifesto", arquivos: [{ caminho: "a.txt", versao: 1 }, { caminho: "b.txt", versao: 1 }] });
    expect(arquivos.map((a) => a.tipo === "arquivo" && [a.caminho, a.conteudo, a.origem])).toEqual([
      ["a.txt", "a\n", "estado"],
      ["b.txt", "bê\n", "estado"],
    ]);
  });
});
