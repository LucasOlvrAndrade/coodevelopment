import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pessoa } from "@/servidor/dominio/amizade";

const { ErroApp } = await import("@/servidor/erros");

const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const mutuosComConta = vi.fn(async (): Promise<Pessoa[]> => []);
const filtrarSugestoes = vi.fn(async (_banco: unknown, _eu: string, mutuos: Pessoa[]) => mutuos);

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("@/servidor/dominio/sugestoes", () => ({ mutuosComConta, filtrarSugestoes }));
vi.mock("@/servidor/github", () => ({ githubDoUsuario: () => ({}), githubMutuos: () => ({}) }));
vi.mock("@/servidor/acoes/amizade", () => ({ pedirAmizade: vi.fn(), aceitarPedido: vi.fn() }));

const { SugestoesMutuos } = await import("@/componentes/amigos/SugestoesMutuos");

const PAI: Pessoa = { id: "pai", login: "pai-dev", nome: "Pai", foto: null };
let pessoa = 0;

beforeEach(() => {
  vi.clearAllMocks();
  // O cache é por pessoa: cada teste entra como uma pessoa diferente.
  exigirSessao.mockResolvedValue({ id: `pessoa-${++pessoa}` });
});

describe("sugestões de mútuos no servidor (gate da 1.4)", () => {
  it("mostra os mútuos filtrados", async () => {
    mutuosComConta.mockResolvedValueOnce([PAI]);
    render(await SugestoesMutuos());
    expect(screen.getByRole("button", { name: "Pedir amizade a Pai" })).toBeInTheDocument();
  });

  it("o GitHub fica guardado por pessoa; o filtro do banco roda de novo (PERF-001)", async () => {
    mutuosComConta.mockResolvedValue([PAI]);
    await SugestoesMutuos();
    filtrarSugestoes.mockResolvedValueOnce([]);
    render(await SugestoesMutuos());
    expect(mutuosComConta).toHaveBeenCalledTimes(1);
    expect(filtrarSugestoes).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Nenhum dos seus mútuos do GitHub usa o Coodevelopment/)).toBeInTheDocument();
  });

  it("conexão com o GitHub vencida pede para entrar de novo", async () => {
    mutuosComConta.mockRejectedValueOnce(new ErroApp("reautenticar", 401));
    render(await SugestoesMutuos());
    expect(screen.getByText("Sua conexão com o GitHub venceu. Saia e entre de novo para ver as sugestões.")).toBeInTheDocument();
  });

  it("outro erro avisa sem derrubar a tela e vai para o log; e não fica guardado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mutuosComConta.mockRejectedValueOnce(new Error("GitHub fora"));
    render(await SugestoesMutuos());
    expect(screen.getByText(/Não deu para carregar as sugestões do GitHub agora/)).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("sugestoes_mutuos"));
    log.mockRestore();
    exigirSessao.mockResolvedValue({ id: `pessoa-${pessoa}` });
    mutuosComConta.mockResolvedValueOnce([PAI]);
    render(await SugestoesMutuos());
    expect(mutuosComConta).toHaveBeenCalledTimes(2);
  });

  it("interrupção interna do Next (redirect) não vira aviso", async () => {
    mutuosComConta.mockRejectedValueOnce(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" }));
    await expect(SugestoesMutuos()).rejects.toThrow("NEXT_REDIRECT");
  });
});
