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
vi.mock("@/servidor/dominio/jam", () => ({ criarJam, criarJamComRepositorioNovo }));
vi.mock("@/servidor/github", () => ({ githubDoUsuario: (id: string) => ({ id }), githubRepositorios: () => github }));

const { criarJamComRepositorio, criarJamImportando } = await import("@/servidor/acoes/jam");

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
    for (const [owner, repo] of [["lucas", "../x"], ["", "projeto"], ["lucas", "a b"], ["lucas/x", "projeto"]]) {
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
