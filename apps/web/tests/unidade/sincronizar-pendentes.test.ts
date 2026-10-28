// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const after = vi.fn<(tarefa: () => Promise<unknown>) => void>();
const sincronizarPendentes = vi.fn<(banco: unknown, eu: string, githubDoCriador: (criadorId: string) => unknown) => Promise<number>>();
const githubDoUsuario = vi.fn((id: string) => ({ token: id }));
const githubColaboracao = vi.fn((octokit: { token: string }) => ({ colaboracaoDe: octokit.token }));

vi.mock("next/server", () => ({ after }));
vi.mock("@/servidor/db", () => ({ db: () => ({ banco: "de teste" }) }));
vi.mock("@/servidor/dominio/participantes", () => ({ sincronizarPendentes }));
vi.mock("@/servidor/github", () => ({ githubColaboracao, githubDoUsuario }));

const { sincronizarComPrazo } = await import("@/servidor/sincronizar-pendentes");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("conferência dos convites pendentes com prazo (gate da 2.3, PERF-001)", () => {
  it("espera a conferência que termina dentro do prazo, com o GitHub de quem criou cada jam", async () => {
    sincronizarPendentes.mockResolvedValueOnce(1);
    await sincronizarComPrazo("lucas", 1000);
    expect(sincronizarPendentes).toHaveBeenCalledWith({ banco: "de teste" }, "lucas", expect.any(Function));
    const githubDoCriador = sincronizarPendentes.mock.calls[0]![2];
    expect(githubDoCriador("criador-da-jam")).toEqual({ colaboracaoDe: "criador-da-jam" });
    expect(githubDoUsuario).toHaveBeenCalledWith("criador-da-jam");
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("GitHub lento: a página segue no prazo e a conferência termina depois da resposta", async () => {
    let terminar!: (conferidos: number) => void;
    sincronizarPendentes.mockReturnValueOnce(new Promise((resolver) => (terminar = resolver)));
    const inicio = Date.now();
    await sincronizarComPrazo("lucas", 30);
    expect(Date.now() - inicio).toBeLessThan(1000);
    const depoisDaResposta = after.mock.calls[0]![0];
    terminar(2);
    await expect(depoisDaResposta()).resolves.toBe(2);
  });

  it("falha do GitHub não segura a página e fica no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    sincronizarPendentes.mockRejectedValueOnce(new Error("GitHub fora"));
    await expect(sincronizarComPrazo("lucas", 1000)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("sincronizar_pendentes"));
    log.mockRestore();
  });
});
