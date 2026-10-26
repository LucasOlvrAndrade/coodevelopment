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

describe("rotas do Better Auth que gravam dados do usuário", () => {
  it("ficam desligadas: githubId e login só vêm do GitHub", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:s@localhost/db");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "segredo");
    vi.stubEnv("GITHUB_APP_SLUG", "coodevelopment");
    const { auth } = await import("@/servidor/auth");
    for (const caminho of ["/update-user", "/sign-up/email"]) {
      const resposta = await auth().handler(
        new Request(`http://localhost:3000/api/auth${caminho}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000" },
          body: JSON.stringify({ githubId: 1, login: "outro" }),
        }),
      );
      expect(resposta.status).toBe(404);
    }
  });
});
