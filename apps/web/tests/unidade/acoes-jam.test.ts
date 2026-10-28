// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");

const exigirSessao = vi.fn(async () => ({ id: "eu", githubId: 1000 }));
const banco = { banco: "de teste" };
const github = { github: "do usuário" };
const criarJam = vi.fn(async () => ({ id: "k7m2-rbq9" }));
const criarJamComRepositorioNovo = vi.fn(async () => ({ id: "abcd-efgh" }));
const excluirJamRegra = vi.fn(async () => undefined);

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => banco }));
vi.mock("@/servidor/dominio/jam", async (original) => ({
  ...(await original<typeof import("@/servidor/dominio/jam")>()),
  criarJam,
  criarJamComRepositorioNovo,
  excluirJam: excluirJamRegra,
}));
const refresh = vi.fn();
const chamarAmigo = vi.fn(async () => ({ vaga: 2 }));
const colocarNoRepositorio = vi.fn(async (): Promise<{ estado: "ok" | "pendente" | "falhou"; motivo?: string }> => ({ estado: "ok" }));
const dadosParaColocar = vi.fn(async (_b: unknown, _eu: string, jamId: string, amigoId: string) => ({
  daJam: { id: jamId, repoOwner: "lucas", repoNome: "projeto" },
  amigo: { id: amigoId, githubId: 1001 },
  colaborador: "pendente" as const,
}));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@/servidor/dominio/participantes", () => ({ chamarAmigo, colocarNoRepositorio, dadosParaColocar }));
vi.mock("@/servidor/github", () => ({
  githubDoUsuario: (id: string) => ({ token: id }),
  githubRepositorios: () => github,
  githubColaboracao: (octokit: { token: string }) => ({ colaboracaoDe: octokit.token }),
  githubConvites: (octokit: { token: string }) => ({ convitesDe: octokit.token }),
}));

const { chamarAmigos, criarJamComRepositorio, criarJamImportando, excluirJam, tentarDeNovo } = await import("@/servidor/acoes/jam");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("criarJamImportando", () => {
  it("cria com quem está na sessão e o GitHub dele", async () => {
    expect(await criarJamImportando("LucasOlvrAndrade", "projeto.web")).toEqual({ ok: true, dados: { id: "k7m2-rbq9" } });
    expect(criarJam).toHaveBeenCalledWith(banco, { id: "eu", githubId: 1000 }, github, { owner: "LucasOlvrAndrade", repo: "projeto.web" });
  });

  it("sem sessão, não cria", async () => {
    exigirSessao.mockRejectedValueOnce(new ErroApp("sem_sessao", 401));
    expect(await criarJamImportando("lucas", "projeto")).toMatchObject({ ok: false, erro: { codigo: "sem_sessao" } });
    expect(criarJam).not.toHaveBeenCalled();
  });

  it("nome que não pode ser do GitHub é entrada inválida", async () => {
    // "." e ".." fariam o fetch trocar o endpoint do GitHub (SEC-002).
    for (const [owner, repo] of [["lucas", "../x"], ["", "projeto"], ["lucas", "a b"], ["lucas/x", "projeto"], ["..", "user"], ["lucas", ".."], ["lucas", "."], ["-x", "projeto"], ["a--b", "projeto"]]) {
      expect(await criarJamImportando(owner!, repo!)).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    }
    expect(criarJam).not.toHaveBeenCalled();
  });
});

describe("criarJamComRepositorio", () => {
  it("cria com quem está na sessão, o nome e a visibilidade", async () => {
    expect(await criarJamComRepositorio("novo-app", true)).toEqual({ ok: true, dados: { id: "abcd-efgh" } });
    expect(criarJamComRepositorioNovo).toHaveBeenCalledWith(banco, { id: "eu", githubId: 1000 }, github, { nome: "novo-app", privado: true });
  });

  it("visibilidade que não é sim ou não é entrada inválida", async () => {
    expect(await criarJamComRepositorio("novo", "true" as unknown as boolean)).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    expect(criarJamComRepositorioNovo).not.toHaveBeenCalled();
  });
});

describe("chamarAmigos e tentarDeNovo (Story 2.3)", () => {
  it("cada amigo ganha a vaga e vai para o repositório: colaborador pelo criador, convite pelo amigo", async () => {
    const resultado = await chamarAmigos("k7m2-rbq9", ["pai", "ana"]);
    expect(resultado).toEqual({ ok: true, dados: [{ amigoId: "pai", estado: "ok" }, { amigoId: "ana", estado: "ok" }] });
    expect(chamarAmigo).toHaveBeenCalledWith(banco, "eu", "k7m2-rbq9", "pai");
    expect(colocarNoRepositorio).toHaveBeenCalledWith(
      banco,
      { id: "k7m2-rbq9", repoOwner: "lucas", repoNome: "projeto" },
      { id: "pai", githubId: 1001 },
      { colaboracaoDe: "eu" },
      { convitesDe: "pai" },
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("erro inesperado num amigo também não impede o outro, e a página atualiza (REL-001)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    chamarAmigo.mockRejectedValueOnce(new Error("Neon fora"));
    expect(await chamarAmigos("k7m2-rbq9", ["pai", "ana"])).toEqual({
      ok: true,
      dados: [
        { amigoId: "pai", erro: "Algo deu errado ao chamar essa pessoa." },
        { amigoId: "ana", estado: "ok" },
      ],
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("erro de regra num amigo não impede o outro, e volta com a mensagem", async () => {
    chamarAmigo.mockRejectedValueOnce(new ErroApp("so_amigos", 403));
    const resultado = await chamarAmigos("k7m2-rbq9", ["estranho", "ana"]);
    expect(resultado).toEqual({
      ok: true,
      dados: [
        { amigoId: "estranho", erro: "Só dá para chamar amigos para a jam." },
        { amigoId: "ana", estado: "ok" },
      ],
    });
  });

  it("mais de 2 de uma vez é entrada inválida", async () => {
    expect(await chamarAmigos("k7m2-rbq9", ["a", "b", "c"])).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    expect(chamarAmigo).not.toHaveBeenCalled();
  });

  it("tentar de novo refaz o GitHub de quem ficou de fora", async () => {
    colocarNoRepositorio.mockResolvedValueOnce({ estado: "falhou", motivo: "O GitHub recusou." });
    expect(await tentarDeNovo("k7m2-rbq9", "pai")).toEqual({ ok: true, dados: { estado: "falhou", motivo: "O GitHub recusou." } });
    expect(dadosParaColocar).toHaveBeenCalledWith(banco, "eu", "k7m2-rbq9", "pai");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("excluirJam (Story 2.4)", () => {
  it("exclui com quem está na sessão", async () => {
    expect(await excluirJam("k7m2-rbq9")).toEqual({ ok: true, dados: undefined });
    expect(excluirJamRegra).toHaveBeenCalledWith(banco, "eu", "k7m2-rbq9");
  });

  it("id fora do formato é entrada inválida", async () => {
    expect(await excluirJam("x".repeat(30))).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    expect(excluirJamRegra).not.toHaveBeenCalled();
  });
});
