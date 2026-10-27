import { describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");
const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const contarPedidosRecebidos = vi.fn(async () => 2);

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("@/servidor/dominio/amizade", () => ({ contarPedidosRecebidos }));

const { GET } = await import("@/app/api/amigos/pedidos-recebidos/route");

describe("GET /api/amigos/pedidos-recebidos", () => {
  it("conta os pedidos de quem está logado, sem cache", async () => {
    const resposta = await GET(new Request("http://teste/api/amigos/pedidos-recebidos"), undefined);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(await resposta.json()).toEqual({ total: 2 });
    expect(contarPedidosRecebidos).toHaveBeenCalledWith({}, "lucas");
  });

  it("sem sessão, 401 no formato de erro da API", async () => {
    exigirSessao.mockRejectedValueOnce(new ErroApp("sem_sessao", 401));
    const resposta = await GET(new Request("http://teste/api/amigos/pedidos-recebidos"), undefined);
    expect(resposta.status).toBe(401);
    expect((await resposta.json()).error.code).toBe("sem_sessao");
  });
});
