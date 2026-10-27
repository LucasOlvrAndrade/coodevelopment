// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");

const exigirSessao = vi.fn(async () => ({ id: "eu" }));
const refresh = vi.fn();
const banco = { banco: "de teste" };
const regras = {
  buscarPorLogin: vi.fn(async () => []),
  pedirAmizade: vi.fn(async () => "pedido_enviado" as const),
  aceitarPedido: vi.fn(async () => undefined),
  recusarPedido: vi.fn(async () => undefined),
  desfazerAmizade: vi.fn(async () => undefined),
};

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => banco }));
vi.mock("@/servidor/dominio/amizade", () => regras);
vi.mock("next/cache", () => ({ refresh }));

const acoes = await import("@/servidor/acoes/amizade");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Server Actions de amizade", () => {
  it("sem sessão, nada acontece e volta o erro com a mensagem", async () => {
    exigirSessao.mockRejectedValueOnce(new ErroApp("sem_sessao", 401));
    expect(await acoes.pedirAmizade("pai")).toEqual({
      ok: false,
      erro: { codigo: "sem_sessao", mensagem: "Sua sessão terminou. Entre de novo." },
    });
    expect(regras.pedirAmizade).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("quem age vem da sessão, e a página é atualizada", async () => {
    expect(await acoes.pedirAmizade("pai")).toEqual({ ok: true, dados: "pedido_enviado" });
    expect(regras.pedirAmizade).toHaveBeenCalledWith(banco, "eu", "pai");
    expect(refresh).toHaveBeenCalledTimes(1);

    await acoes.aceitarPedido("p1");
    await acoes.recusarPedido("p2");
    await acoes.desfazerAmizade("pai");
    expect(regras.aceitarPedido).toHaveBeenCalledWith(banco, "eu", "p1");
    expect(regras.recusarPedido).toHaveBeenCalledWith(banco, "eu", "p2");
    expect(regras.desfazerAmizade).toHaveBeenCalledWith(banco, "eu", "pai");
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("a busca não muda dados e não atualiza a página", async () => {
    expect(await acoes.buscarAmigo("pai-dev")).toEqual({ ok: true, dados: [] });
    expect(regras.buscarPorLogin).toHaveBeenCalledWith(banco, "eu", "pai-dev");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("entrada fora do esperado vira entrada_invalida", async () => {
    for (const ruim of ["", "x".repeat(101), 42 as unknown as string, undefined as unknown as string]) {
      const resultado = await acoes.aceitarPedido(ruim);
      expect(resultado).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    }
    expect(regras.aceitarPedido).not.toHaveBeenCalled();
  });

  it("erro de regra chega com a mensagem em português", async () => {
    regras.pedirAmizade.mockRejectedValueOnce(new ErroApp("amizade_consigo"));
    expect(await acoes.pedirAmizade("eu")).toEqual({
      ok: false,
      erro: { codigo: "amizade_consigo", mensagem: "Você não pode pedir amizade a si mesmo." },
    });
  });

  it("erro inesperado é logado sem detalhe para a página", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    regras.desfazerAmizade.mockRejectedValueOnce(new Error("conexão caiu"));
    expect(await acoes.desfazerAmizade("pai")).toEqual({
      ok: false,
      erro: { codigo: "inesperado", mensagem: "Algo deu errado. Tente de novo." },
    });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
