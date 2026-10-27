// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");

const exigirSessao = vi.fn(async () => ({ id: "eu", githubId: 1000 }));
const banco = { banco: "de teste" };
const github = { github: "do usuário" };
const criarJam = vi.fn(async () => ({ id: "k7m2-rbq9" }));
const criarJamComRepositorioNovo = vi.fn(async () => ({ id: "abcd-efgh" }));

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => banco }));
vi.mock("@/servidor/dominio/jam", async (original) => ({
  ...(await original<typeof import("@/servidor/dominio/jam")>()),
  criarJam,
  criarJamComRepositorioNovo,
}));
const refresh = vi.fn();
const chamarAmigo = vi.fn(async () => ({ vaga: 2 }));
const colocarNoRepositorio = vi.fn(async () => "ok" as const);
const dadosParaColocar = vi.fn(async (_b: unknown, _eu: string, jamId: string, amigoId: string) => ({
  daJam: { id: jamId, repoOwner: "lucas", repoNome: "projeto" },
  amigo: { id: amigoId, login: `${amigoId}-dev` },
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

const { chamarAmigos, criarJamComRepositorio, criarJamImportando, tentarDeNovo } = await import("@/servidor/acoes/jam");

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
      { id: "pai", login: "pai-dev" },
      { colaboracaoDe: "eu" },
      { convitesDe: "pai" },
    );
    expect(refresh).toHaveBeenCalledTimes(1);
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
    colocarNoRepositorio.mockResolvedValueOnce("pendente" as never);
    expect(await tentarDeNovo("k7m2-rbq9", "pai")).toEqual({ ok: true, dados: "pendente" });
    expect(dadosParaColocar).toHaveBeenCalledWith(banco, "eu", "k7m2-rbq9", "pai");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
