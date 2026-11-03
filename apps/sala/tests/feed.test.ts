import { hashDoConteudo, type EventoFeed, type MensagemEscrever } from "@coodevelopment/protocolo";
import { describe, expect, it } from "vitest";
import { ArmazenamentoFeedEmMemoria, Feed, type Mudanca } from "../src/feed";
import { ArmazenamentoEmMemoria, Sincronizacao, type Envio } from "../src/sincronizacao";

// Regra do feed (Story 3.4), com o armazenamento em memória e um relógio
// que a gente avança.

function relogio() {
  let t = Date.parse("2026-11-03T12:00:00.000Z");
  return {
    agora: () => new Date(t).toISOString(),
    passar: (ms: number) => {
      t += ms;
    },
  };
}

const mudanca = (autorId: string, caminho: string, extra: Partial<Mudanca> = {}): Mudanca => ({
  autorId,
  caminho,
  mudanca: "alterado",
  binario: false,
  diferenca: { adicionadas: 1, removidas: 0 },
  juntado: false,
  ...extra,
});

function novo() {
  const r = relogio();
  const feed = new Feed(new ArmazenamentoFeedEmMemoria(), r.agora);
  return { feed, ...r };
}

describe("Feed: agrupamento (AC 3)", () => {
  it("mudanças seguidas do mesmo autor entram no mesmo item, a mais recente em cima, e as linhas do mesmo arquivo somam", () => {
    const { feed, passar } = novo();
    const a = feed.mudanca(mudanca("lucas", "a.ts"));
    passar(60_000);
    feed.mudanca(mudanca("lucas", "b.ts", { diferenca: { adicionadas: 3, removidas: 2 } }));
    passar(60_000);
    const c = feed.mudanca(mudanca("lucas", "a.ts", { diferenca: { adicionadas: 2, removidas: 1 } }));
    expect(c.id).toBe(a.id);
    expect(feed.ultimos()).toHaveLength(1);
    expect(c).toMatchObject({
      tipo: "arquivos",
      em: "2026-11-03T12:00:00.000Z",
      atualizadoEm: "2026-11-03T12:02:00.000Z",
      arquivos: [
        { caminho: "a.ts", adicionadas: 3, removidas: 1 },
        { caminho: "b.ts", adicionadas: 3, removidas: 2 },
      ],
    });
  });

  it("outra pessoa mexendo no meio abre outro item", () => {
    const { feed } = novo();
    feed.mudanca(mudanca("lucas", "a.ts"));
    feed.mudanca(mudanca("pai", "b.ts"));
    feed.mudanca(mudanca("lucas", "c.ts"));
    expect(feed.ultimos().map((e) => e.autorId)).toEqual(["lucas", "pai", "lucas"]);
  });

  it("mais de 5 minutos parado abre outro item", () => {
    const { feed, passar } = novo();
    feed.mudanca(mudanca("lucas", "a.ts"));
    passar(5 * 60_000 + 1);
    feed.mudanca(mudanca("lucas", "a.ts"));
    expect(feed.ultimos()).toHaveLength(2);
  });

  it("criado e depois alterado continua criado; alterado e depois apagado fica apagado, sem contagem", () => {
    const { feed } = novo();
    feed.mudanca(mudanca("lucas", "novo.ts", { mudanca: "criado", diferenca: { adicionadas: 5, removidas: 0 } }));
    feed.mudanca(mudanca("lucas", "novo.ts", { diferenca: { adicionadas: 1, removidas: 1 } }));
    feed.mudanca(mudanca("lucas", "velho.ts"));
    const e = feed.mudanca(mudanca("lucas", "velho.ts", { mudanca: "apagado", diferenca: null }));
    expect(e).toMatchObject({
      arquivos: [
        { caminho: "velho.ts", mudanca: "apagado", adicionadas: null, removidas: null },
        { caminho: "novo.ts", mudanca: "criado", adicionadas: 6, removidas: 1 },
      ],
    });
  });

  it("passou de 50 arquivos, os mais antigos viram contagem", () => {
    const { feed } = novo();
    let e: EventoFeed | undefined;
    for (let i = 0; i < 53; i++) e = feed.mudanca(mudanca("lucas", `f${i}.ts`));
    expect(e).toMatchObject({ tipo: "arquivos", outros: 3 });
    expect(e!.tipo === "arquivos" && e!.arquivos).toHaveLength(50);
    expect(e!.tipo === "arquivos" && e!.arquivos[0]!.caminho).toBe("f52.ts");
  });
});

describe("Feed: dependências, conflito e arquivo grande (AC 2 e 5)", () => {
  it("arquivo de dependências vai para um item próprio, que não quebra o grupo dos arquivos", () => {
    const { feed } = novo();
    const a = feed.mudanca(mudanca("lucas", "src/a.ts"));
    const d = feed.mudanca(mudanca("lucas", "package.json"));
    feed.mudanca(mudanca("lucas", "pnpm-lock.yaml"));
    const b = feed.mudanca(mudanca("lucas", "src/b.ts"));
    expect(d).toMatchObject({ tipo: "dependencias", caminhos: ["package.json"] });
    expect(b.id).toBe(a.id);
    expect(feed.ultimos().map((e) => e.tipo)).toEqual(["arquivos", "dependencias"]);
    expect(feed.ultimos()[1]).toMatchObject({ caminhos: ["pnpm-lock.yaml", "package.json"] });
  });

  it("conflito sempre abre item próprio", () => {
    const { feed } = novo();
    feed.conflito("pai", "lucas", "a.ts", "guardado");
    feed.conflito("pai", "lucas", "a.ts", "guardado");
    expect(feed.ultimos()).toEqual([
      expect.objectContaining({ tipo: "conflito", autorId: "pai", outroId: "lucas", resolvido: "guardado" }),
      expect.objectContaining({ tipo: "conflito" }),
    ]);
  });

  it("o mesmo arquivo grande de novo (conector religado) não repete", () => {
    const { feed } = novo();
    expect(feed.grande("lucas", "video.mp4", 5_000_000)).toMatchObject({ tipo: "grande", caminho: "video.mp4", tamanho: 5_000_000 });
    expect(feed.grande("lucas", "video.mp4", 5_000_000)).toBeNull();
    expect(feed.grande("lucas", "video.mp4", 6_000_000)).not.toBeNull();
  });

  it("a página recebe no máximo os 100 últimos, do mais antigo ao mais novo (AC 6)", () => {
    const { feed } = novo();
    for (let i = 0; i < 120; i++) feed.conflito("lucas", "pai", `f${i}.ts`, "guardado");
    const ultimos = feed.ultimos();
    expect(ultimos).toHaveLength(100);
    expect(ultimos[0]).toMatchObject({ caminho: "f20.ts" });
    expect(ultimos.at(-1)).toMatchObject({ caminho: "f119.ts" });
  });
});

// A sincronização avisando o feed: o resumo da diferença sai da escrita.

async function escrita(caminho: string, conteudo: string, versaoBase: number, extra: Partial<MensagemEscrever> = {}): Promise<MensagemEscrever> {
  const binario = extra.binario ?? false;
  return { v: 1, tipo: "escrever", caminho, versaoBase, hash: await hashDoConteudo(conteudo, binario), conteudo, binario, apagado: false, ...extra };
}

function comFeed() {
  const r = relogio();
  const feed = new Feed(new ArmazenamentoFeedEmMemoria(), r.agora);
  return { feed, sinc: new Sincronizacao(new ArmazenamentoEmMemoria(), r.agora, feed) };
}

const doFeed = (envios: Envio[]) => envios.filter((e) => e.para === "paginas").flatMap((e) => (e.mensagem.tipo === "feed" ? e.mensagem.eventos : []));

describe("Sincronizacao com o feed (AC 1 e 5)", () => {
  it("escrita aceita vai para as páginas com autor, arquivo e resumo da diferença", async () => {
    const { sinc } = comFeed();
    const envios = await sinc.escrever("lucas", await escrita("src/a.ts", "um\ndois\ntres\n", 0, { conteudoBase: "um\n2\ntres\n" }));
    expect(doFeed(envios)).toEqual([
      expect.objectContaining({
        tipo: "arquivos",
        autorId: "lucas",
        arquivos: [{ caminho: "src/a.ts", mudanca: "alterado", binario: false, adicionadas: 1, removidas: 1, juntado: false }],
      }),
    ]);
  });

  it("arquivo novo, apagado e binário", async () => {
    const { sinc } = comFeed();
    await sinc.escrever("lucas", await escrita("novo.ts", "a\nb\n", 0, { conteudoBase: null }));
    await sinc.escrever("lucas", await escrita("velho.ts", "", 0, { apagado: true, conteudoBase: "x\n" }));
    const envios = await sinc.escrever("lucas", await escrita("logo.png", "iVBORw0KGgo=", 0, { binario: true, conteudoBase: null }));
    expect(doFeed(envios)[0]).toMatchObject({
      arquivos: [
        { caminho: "logo.png", mudanca: "criado", binario: true, adicionadas: null },
        { caminho: "velho.ts", mudanca: "apagado", adicionadas: null },
        { caminho: "novo.ts", mudanca: "criado", adicionadas: 2, removidas: 0 },
      ],
    });
  });

  it("só o final de linha mudou, ou apagar o que não existia: nada no feed (NFR7)", async () => {
    const { sinc, feed } = comFeed();
    await sinc.escrever("lucas", await escrita("a.ts", "um\r\ndois\r\n", 0, { conteudoBase: "um\ndois\n" }));
    await sinc.escrever("lucas", await escrita("fantasma.ts", "", 0, { apagado: true, conteudoBase: null }));
    expect(feed.ultimos()).toEqual([]);
  });

  it("merge sai marcado como juntado; trechos cruzados viram item de conflito para quem perdeu", async () => {
    const { sinc } = comFeed();
    const base = "a\nb\nc\nd\ne\n";
    await sinc.escrever("lucas", await escrita("x.txt", "a\nB\nc\nd\ne\n", 0, { conteudoBase: base }));
    const merge = await sinc.escrever("pai", await escrita("x.txt", "a\nb\nc\nd\nE\n", 0, { conteudoBase: base }));
    expect(doFeed(merge)[0]).toMatchObject({ autorId: "pai", arquivos: [{ caminho: "x.txt", juntado: true, adicionadas: 1, removidas: 1 }] });
    const cruzado = await sinc.escrever("lucas", await escrita("x.txt", "a\nB\nc\nd\nX\n", 1));
    expect(doFeed(cruzado)).toEqual([expect.objectContaining({ tipo: "conflito", autorId: "lucas", outroId: "pai", caminho: "x.txt", resolvido: "guardado" })]);
  });

  it("binário sobrescrito de outra pessoa vira item de conflito (gate da 3.3, REL-005)", async () => {
    const { sinc } = comFeed();
    await sinc.escrever("lucas", await escrita("logo.png", "AAAA", 0, { binario: true, conteudoBase: null }));
    const envios = await sinc.escrever("pai", await escrita("logo.png", "BBBB", 0, { binario: true, conteudoBase: null }));
    expect(doFeed(envios)).toEqual([
      expect.objectContaining({ tipo: "arquivos", autorId: "pai" }),
      expect.objectContaining({ tipo: "conflito", autorId: "pai", outroId: "lucas", resolvido: "sobrescrito" }),
    ]);
  });

  it("arquivo grande recusado pela sala e o ignorado pelo conector entram no feed (A14)", async () => {
    const { sinc, feed } = comFeed();
    await sinc.escrever("lucas", await escrita("grande.txt", "x".repeat(1024 * 1024 + 1), 0));
    sinc.ignorado("pai", { v: 1, tipo: "ignorado", caminho: "video.mp4", motivo: "grande_demais", tamanho: 9_000_000 });
    sinc.ignorado("pai", { v: 1, tipo: "ignorado", caminho: ".git/objects/x", motivo: "grande_demais", tamanho: 9_000_000 });
    expect(feed.ultimos()).toEqual([
      expect.objectContaining({ tipo: "grande", autorId: "lucas", caminho: "grande.txt", tamanho: 1024 * 1024 + 1 }),
      expect.objectContaining({ tipo: "grande", autorId: "pai", caminho: "video.mp4" }),
    ]);
  });

  it("erro no feed não derruba a escrita, que continua aceita", async () => {
    const r = relogio();
    const quebrado = new Feed(
      {
        inserir: () => {
          throw new Error("banco fora");
        },
        atualizar: () => {},
        ultimos: () => [],
      },
      r.agora,
    );
    const sinc = new Sincronizacao(new ArmazenamentoEmMemoria(), r.agora, quebrado);
    const envios = await sinc.escrever("lucas", await escrita("a.ts", "a\n", 0, { conteudoBase: null }));
    expect(envios.map((e) => e.mensagem.tipo)).toEqual(["aceito", "arquivo"]);
  });
});
