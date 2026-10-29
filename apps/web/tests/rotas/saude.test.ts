import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const fetchDaSala = vi.fn();

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/servidor/db", () => ({ db: () => ({ execute }) }));

const { GET } = await import("@/app/api/saude/route");
const { esquecerSituacaoDaSala } = await import("@/servidor/situacao-da-sala");

const pedir = () => GET(new Request("http://teste/api/saude"), undefined);

describe("GET /api/saude", () => {
  beforeEach(() => {
    esquecerSituacaoDaSala();
    execute.mockReset();
    fetchDaSala.mockReset();
    vi.stubGlobal("fetch", fetchDaSala);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "coodevelopment-sala.conta.workers.dev");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("responde app, banco e sala ok quando os três respondem (o 404 da raiz da sala conta como no ar)", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    fetchDaSala.mockResolvedValue(new Response("", { status: 404 }));
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ app: "ok", banco: "ok", sala: "ok" });
    expect(fetchDaSala).toHaveBeenCalledWith("https://coodevelopment-sala.conta.workers.dev/", expect.objectContaining({ cache: "no-store" }));
  });

  it("responde 503 com banco em erro quando o banco falha", async () => {
    execute.mockRejectedValue(new Error("sem conexão"));
    fetchDaSala.mockResolvedValue(new Response("", { status: 404 }));
    const resposta = await pedir();
    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ app: "ok", banco: "erro", sala: "ok" });
  });

  it("sala sem resposta não derruba o app (Story 2.5, AC 4)", async () => {
    execute.mockResolvedValue({ rows: [] });
    fetchDaSala.mockRejectedValue(new TypeError("fetch failed"));
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ app: "ok", banco: "ok", sala: "erro" });
  });

  it("sem o endereço da sala, ela está desligada e nem é chamada", async () => {
    vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "");
    execute.mockResolvedValue({ rows: [] });
    expect(await (await pedir()).json()).toEqual({ app: "ok", banco: "ok", sala: "desligada" });
    expect(fetchDaSala).not.toHaveBeenCalled();
  });

  it("sala com erro do servidor (5xx) não conta como no ar (gate da 3.1, MNT-003)", async () => {
    execute.mockResolvedValue({ rows: [] });
    fetchDaSala.mockResolvedValue(new Response("", { status: 502 }));
    expect((await (await pedir()).json()).sala).toBe("erro");
  });

  it("a resposta da sala fica guardada 30 s: a rota pública não chama a sala a cada acesso", async () => {
    execute.mockResolvedValue({ rows: [] });
    fetchDaSala.mockResolvedValue(new Response("", { status: 404 }));
    await pedir();
    await pedir();
    expect(fetchDaSala).toHaveBeenCalledTimes(1);
  });
});
