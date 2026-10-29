import { afterEach, describe, expect, it, vi } from "vitest";
import { conectarNaSala } from "../../src/sala";
import { ambienteFalso, type RespostaFalsa } from "../apoio/ambiente-falso";

// A conexão do conector com a sala (gate da 3.1, TEST-001), com um WebSocket
// falso no lugar do de verdade: cada conexão nova fica em `conexoes`, com a URL
// que o partysocket montou (o token vai na query).
const conexoes: WebSocketFalso[] = [];

class WebSocketFalso extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  binaryType = "blob";
  constructor(public url: string) {
    super();
    conexoes.push(this);
  }
  abrir() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  cair(code: number) {
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event("close"), { code, reason: "", wasClean: code === 1000 }));
  }
  close() {
    this.readyState = 3;
  }
  send() {}
}

const SALA = { salaUrl: "wss://sala.teste/parties/jam/k7m2-rbq9", expiraEm: "2026-10-29T15:00:00Z" };

function preparar(tokens: RespostaFalsa[]) {
  const falso = ambienteFalso({ respostas: { "POST /api/jams/k7m2-rbq9/token-sala": tokens } });
  const aoConectar = vi.fn();
  return { ...falso, aoConectar };
}

const tokenDaUrl = (ws: WebSocketFalso) => new URL(ws.url).searchParams.get("token");

afterEach(() => {
  conexoes.length = 0;
});

describe("conectarNaSala (Story 3.1, AC 3)", () => {
  it("conecta com o primeiro token e avisa uma vez; cada reconexão pede um token novo", async () => {
    const { amb, aoConectar, linhas, pedidos } = preparar([
      { corpo: { token: "t1", ...SALA } },
      { corpo: { token: "t2", ...SALA } },
    ]);
    const conexao = await conectarNaSala(amb, "sessao", "k7m2-rbq9", aoConectar, WebSocketFalso as unknown as typeof WebSocket);
    await vi.waitFor(() => expect(conexoes).toHaveLength(1));
    expect(conexoes[0]!.url).toMatch(/^wss:\/\/sala\.teste\/parties\/jam\/k7m2-rbq9\?/);
    expect(tokenDaUrl(conexoes[0]!)).toBe("t1");
    conexoes[0]!.abrir();
    expect(aoConectar).toHaveBeenCalledTimes(1);

    conexoes[0]!.cair(1006);
    expect(linhas).toContain("A conexão com a jam caiu. Tentando de novo...");
    await vi.waitFor(() => expect(conexoes).toHaveLength(2), { timeout: 15_000 });
    expect(tokenDaUrl(conexoes[1]!)).toBe("t2");
    conexoes[1]!.abrir();
    expect(aoConectar).toHaveBeenCalledTimes(1);
    expect(linhas).toContain("Reconectado à jam.");
    expect(pedidos.every((p) => p.cabecalhos.authorization === "Bearer sessao")).toBe(true);
    conexao.fechar();
    expect(await conexao.fechou).toBe("");
  }, 20_000);

  it("a sala recusa o token (4401): o conector para com a explicação", async () => {
    const { amb, aoConectar } = preparar([{ corpo: { token: "t1", ...SALA } }]);
    const conexao = await conectarNaSala(amb, "sessao", "k7m2-rbq9", aoConectar, WebSocketFalso as unknown as typeof WebSocket);
    await vi.waitFor(() => expect(conexoes).toHaveLength(1));
    conexoes[0]!.cair(4401);
    expect(await conexao.fechou).toBe("A sala recusou a entrada. Rode o comando de novo.");
  });

  it.each([
    [401, "Sua sessão deste computador foi encerrada. Rode o comando de novo para entrar."],
    [403, "Você não participa mais dessa jam."],
    [409, "A jam foi fechada."],
  ])("na reconexão, o app responde %i: o conector para em vez de tentar para sempre (REL-001)", async (status, motivo) => {
    const { amb, aoConectar } = preparar([{ corpo: { token: "t1", ...SALA } }, { status, corpo: { error: { code: "x", message: "x" } } }]);
    const conexao = await conectarNaSala(amb, "sessao", "k7m2-rbq9", aoConectar, WebSocketFalso as unknown as typeof WebSocket);
    await vi.waitFor(() => expect(conexoes).toHaveLength(1));
    conexoes[0]!.abrir();
    conexoes[0]!.cair(1006);
    expect(await conexao.fechou).toBe(motivo);
  }, 20_000);

  it("sem a sala no ar (503 no primeiro token), nem tenta conectar", async () => {
    const { amb, aoConectar } = preparar([{ status: 503, corpo: { error: { code: "sala_indisponivel", message: "x" } } }]);
    await expect(conectarNaSala(amb, "sessao", "k7m2-rbq9", aoConectar, WebSocketFalso as unknown as typeof WebSocket)).rejects.toMatchObject({ status: 503 });
    expect(conexoes).toHaveLength(0);
  });
});
