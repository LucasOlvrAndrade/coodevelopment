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

function envDeTeste() {
  vi.stubEnv("DATABASE_URL", "postgres://u:s@localhost/db");
  vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "segredo");
  vi.stubEnv("GITHUB_APP_SLUG", "coodevelopment");
}

describe("vinculação de contas", () => {
  it("está desligada: e-mail igual não junta duas contas do GitHub", async () => {
    envDeTeste();
    const { auth } = await import("@/servidor/auth");
    expect(auth().options.account?.accountLinking?.enabled).toBe(false);
  });
});

describe("rotas HTTP do Better Auth desligadas", () => {
  it("as que gravam o usuário ou devolvem o token do GitHub respondem 404", async () => {
    envDeTeste();
    const { auth, ROTAS_DESLIGADAS } = await import("@/servidor/auth");
    expect(ROTAS_DESLIGADAS).toEqual(expect.arrayContaining(["/update-user", "/get-access-token", "/refresh-token"]));
    for (const caminho of ROTAS_DESLIGADAS) {
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

describe("renovação do token do GitHub", () => {
  const credenciais = { clientId: "id", clientSecret: "segredo" };

  it("devolve os tokens novos com as validades", async () => {
    const enviados: URLSearchParams[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      enviados.push(new URLSearchParams(String(init?.body)));
      return Response.json({
        access_token: "ghu_novo",
        refresh_token: "ghr_novo",
        token_type: "bearer",
        expires_in: 28800,
        refresh_token_expires_in: 15811200,
      });
    });
    const { renovarTokenGithub } = await import("@/servidor/auth");
    const antes = Date.now();
    const tokens = await renovarTokenGithub("ghr_velho", credenciais);
    fetchFalso.mockRestore();
    expect(tokens).toMatchObject({ accessToken: "ghu_novo", refreshToken: "ghr_novo" });
    expect(tokens.accessTokenExpiresAt!.getTime()).toBeGreaterThanOrEqual(antes + 28800 * 1000);
    expect(enviados[0]!.get("grant_type")).toBe("refresh_token");
    expect(enviados[0]!.get("refresh_token")).toBe("ghr_velho");
  });

  it("lança quando o GitHub responde 200 com erro (refresh já usado, revogado ou vencido)", async () => {
    const fetchFalso = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json({ error: "bad_refresh_token" }));
    const { renovarTokenGithub } = await import("@/servidor/auth");
    await expect(renovarTokenGithub("ghr_usado", credenciais)).rejects.toThrow(/bad_refresh_token/);
    fetchFalso.mockRestore();
  });

  it("lança quando o GitHub responde com erro HTTP", async () => {
    const fetchFalso = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("indisponível", { status: 503 }));
    const { renovarTokenGithub } = await import("@/servidor/auth");
    await expect(renovarTokenGithub("ghr", credenciais)).rejects.toThrow(/503/);
    fetchFalso.mockRestore();
  });

  it("é a renovação que o provedor github do Better Auth usa", async () => {
    envDeTeste();
    const fetchFalso = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json({ error: "bad_refresh_token" }));
    const { auth } = await import("@/servidor/auth");
    const github = auth().options.socialProviders?.github;
    await expect(github?.refreshAccessToken?.("ghr_usado")).rejects.toThrow(/bad_refresh_token/);
    fetchFalso.mockRestore();
  });
});
