import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { camposDoPerfil } = await import("@/servidor/auth");

describe("camposDoPerfil", () => {
  it("guarda o id numérico e o usuário do GitHub", () => {
    expect(camposDoPerfil({ id: 583231, login: "octocat" })).toEqual({ githubId: 583231, login: "octocat" });
  });

  it("aceita o id como texto, como o tipo do Better Auth declara", () => {
    expect(camposDoPerfil({ id: "583231", login: "octocat" })).toEqual({ githubId: 583231, login: "octocat" });
  });

  it("recusa id que não é inteiro", () => {
    expect(() => camposDoPerfil({ id: "abc", login: "x" })).toThrow(/id do GitHub inválido/);
  });
});
