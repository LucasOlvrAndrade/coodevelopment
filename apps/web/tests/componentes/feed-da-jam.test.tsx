import type { EventoFeed } from "@coodevelopment/protocolo";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O partysocket de mentira, como no teste da presença: o teste dispara as
// mensagens da sala.
const { sockets, SocketDeTeste } = vi.hoisted(() => {
  const sockets: InstanceType<typeof SocketDeTeste>[] = [];
  class SocketDeTeste extends EventTarget {
    constructor(public opcoes: unknown) {
      super();
      sockets.push(this);
    }
    close() {}
  }
  return { sockets, SocketDeTeste };
});
vi.mock("partysocket", () => ({ default: SocketDeTeste }));

const { PresencaDaJam, aplicarFeed } = await import("@/componentes/jams/PresencaDaJam");
const { FeedDaJam, quando } = await import("@/componentes/jams/FeedDaJam");

const AGORA = Date.parse("2026-11-03T12:10:00.000Z");
const pessoas = [
  { id: "lucas", nome: "Lucas Andrade", foto: null, vaga: 1 },
  { id: "pai", nome: "Kelson", foto: null, vaga: 2 },
];

const comum = { em: "2026-11-03T12:00:00.000Z", atualizadoEm: "2026-11-03T12:08:00.000Z" };

function arquivos(id: number, autorId: string, extra: Partial<Extract<EventoFeed, { tipo: "arquivos" }>> = {}): EventoFeed {
  return {
    ...comum,
    id,
    tipo: "arquivos",
    autorId,
    arquivos: [{ caminho: "src/app.ts", mudanca: "alterado", binario: false, adicionadas: 3, removidas: 1, juntado: false }],
    outros: 0,
    ...extra,
  };
}

function feed(eventos: EventoFeed[], inicial: boolean) {
  act(() => {
    sockets.at(-1)!.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ v: 1, tipo: "feed", eventos, inicial }) }));
  });
}

async function pagina(eu = "pai") {
  render(
    <PresencaDaJam jamId="k7m2-rbq9">
      <FeedDaJam pessoas={pessoas} eu={eu} />
    </PresencaDaJam>,
  );
  await waitFor(() => expect(sockets).toHaveLength(1));
}

beforeEach(() => {
  sockets.length = 0;
  vi.useFakeTimers({ toFake: ["Date"], now: AGORA });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ token: "t", salaUrl: "wss://sala.teste/parties/jam/k7m2-rbq9" }))),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Os itens do feed (os filhos diretos da lista, não as listas de arquivos).
const itens = () => [...screen.getByRole("list", { name: /Mudanças/ }).children] as HTMLElement[];

describe("feed da jam (Story 3.4)", () => {
  it("antes da sala responder e com o feed vazio, diz o que esperar", async () => {
    await pagina();
    expect(screen.getByText("O feed aparece quando a sala da jam responder.")).toBeInTheDocument();
    feed([], true);
    expect(screen.getByText(/Nada mudou ainda/)).toBeInTheDocument();
  });

  it("mostra autor, arquivo e resumo da diferença, do mais novo ao mais antigo (AC 1)", async () => {
    await pagina();
    feed(
      [
        arquivos(1, "lucas"),
        arquivos(2, "pai", {
          arquivos: [
            { caminho: "src/novo.ts", mudanca: "criado", binario: false, adicionadas: 12, removidas: 0, juntado: false },
            { caminho: "velho.ts", mudanca: "apagado", binario: false, adicionadas: null, removidas: null, juntado: false },
            { caminho: "logo.png", mudanca: "alterado", binario: true, adicionadas: null, removidas: null, juntado: false },
            { caminho: "x.ts", mudanca: "alterado", binario: false, adicionadas: 1, removidas: 1, juntado: true },
          ],
          outros: 3,
        }),
      ],
      true,
    );
    const [primeiro, segundo] = itens();
    expect(primeiro).toHaveTextContent("Você mudou 7 arquivos");
    expect(primeiro).toHaveTextContent("src/novo.ts");
    expect(primeiro).toHaveTextContent("novo, 12 linhas");
    expect(primeiro).toHaveTextContent("apagado");
    expect(primeiro).toHaveTextContent("alterado, arquivo binário");
    expect(primeiro).toHaveTextContent("juntado com outra mudança");
    expect(primeiro).toHaveTextContent("e mais 3 arquivos");
    expect(segundo).toHaveTextContent("Lucas Andrade mudou 1 arquivo");
    expect(segundo).toHaveTextContent("3 linhas acrescentadas, 1 tirada");
    expect(segundo).toHaveTextContent("há 2 min");
  });

  it("dependências aparecem destacadas, pedindo reinstalação (AC 2)", async () => {
    await pagina();
    feed([{ ...comum, id: 1, tipo: "dependencias", autorId: "lucas", caminhos: ["package.json", "pnpm-lock.yaml"] }], true);
    const [item] = itens();
    expect(item).toHaveTextContent("Lucas Andrade mudou as dependências");
    expect(item).toHaveTextContent("Reinstale as dependências no seu PC.");
    expect(item!.className).toContain("ring-alerta");
  });

  it("conflito e arquivo grande contam quem perdeu e o porquê (AC 5)", async () => {
    await pagina();
    feed(
      [
        { ...comum, id: 1, tipo: "conflito", autorId: "pai", outroId: "lucas", caminho: "a.ts", resolvido: "guardado" },
        { ...comum, id: 2, tipo: "conflito", autorId: "lucas", outroId: "pai", caminho: "logo.png", resolvido: "sobrescrito" },
        { ...comum, id: 3, tipo: "grande", autorId: "lucas", caminho: "video.mp4", tamanho: 5 * 1024 * 1024 },
      ],
      true,
    );
    const [grande, sobrescrito, guardado] = itens();
    expect(guardado).toHaveTextContent("A sua mudança cruzou com uma de Lucas Andrade e ficou guardada no histórico da jam");
    expect(sobrescrito).toHaveTextContent("Lucas Andrade substituiu o arquivo binário; a sua versão anterior está guardada no histórico da jam.");
    expect(grande).toHaveTextContent("video.mp4 ficou fora da jam");
    expect(grande).toHaveTextContent("5 MB");
  });

  it("se atualiza sozinho: grupo atualizado no lugar, item novo em cima e anunciado (AC 3 e 4)", async () => {
    await pagina();
    feed([arquivos(1, "lucas")], true);
    expect(screen.getByRole("status")).toHaveTextContent("");
    feed([arquivos(1, "lucas", { outros: 1 })], false);
    expect(itens()).toHaveLength(1);
    expect(itens()[0]).toHaveTextContent("Lucas Andrade mudou 2 arquivos");
    feed([arquivos(2, "pai")], false);
    expect(itens()).toHaveLength(2);
    expect(itens()[0]).toHaveTextContent("Você mudou 1 arquivo");
    expect(screen.getByRole("status")).toHaveTextContent("Você mudou 1 arquivo");
  });

  it("quem saiu da jam aparece sem nome", async () => {
    await pagina();
    feed([arquivos(1, "ex")], true);
    expect(itens()[0]).toHaveTextContent("Alguém que saiu da jam mudou 1 arquivo");
  });
});

describe("aplicarFeed e quando", () => {
  it("o feed guardado substitui tudo, também ao reconectar", () => {
    const antes = aplicarFeed({ eventos: [], carregado: false, novo: null }, { v: 1, tipo: "feed", eventos: [arquivos(1, "a"), arquivos(2, "b")], inicial: true });
    expect(antes.eventos.map((e) => e.id)).toEqual([2, 1]);
    const depois = aplicarFeed(antes, { v: 1, tipo: "feed", eventos: [arquivos(5, "a")], inicial: true });
    expect(depois.eventos.map((e) => e.id)).toEqual([5]);
  });

  it("hora relativa", () => {
    expect(quando("2026-11-03T12:09:30.000Z", AGORA)).toBe("agora");
    expect(quando("2026-11-03T11:10:00.000Z", AGORA)).toBe("há 1 h");
    expect(quando("2026-11-01T11:10:00.000Z", AGORA)).toMatch(/1 de nov/);
  });
});
