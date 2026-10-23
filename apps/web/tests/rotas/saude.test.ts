import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/servidor/db", () => ({ db: () => ({ execute }) }));

const { GET } = await import("@/app/api/saude/route");

describe("GET /api/saude", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("responde app e banco ok quando o banco responde", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const resposta = await GET(new Request("http://teste/api/saude"), undefined);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ app: "ok", banco: "ok" });
  });

  it("responde 503 com banco em erro quando o banco falha", async () => {
    execute.mockRejectedValue(new Error("sem conexão"));
    const resposta = await GET(new Request("http://teste/api/saude"), undefined);
    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ app: "ok", banco: "erro" });
  });
});
