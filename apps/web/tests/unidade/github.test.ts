import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();
let contas: { id: string }[] = [{ id: "conta-1" }];

vi.mock("@/servidor/auth", () => ({ auth: () => ({ api: { getAccessToken } }) }));
vi.mock("@/servidor/db", () => {
  const consulta = { from: () => consulta, where: () => consulta, limit: async () => contas };
  return { db: () => ({ select: () => consulta }) };
});

const { githubDoUsuario, githubMutuos, tokenDoUsuario, appInstaladoNaConta } = await import("@/servidor/github");

beforeEach(() => {
  getAccessToken.mockReset();
  contas = [{ id: "conta-1" }];
});

describe("tokenDoUsuario", () => {
  it("pede ao Better Auth o token da conta GitHub do usuário (ele renova se venceu)", async () => {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_novo" });
    expect(await tokenDoUsuario("u1")).toBe("ghu_novo");
    expect(getAccessToken).toHaveBeenCalledWith({ body: { accountId: "conta-1", userId: "u1" } });
  });

  it("duas chamadas simultâneas fazem uma busca só (o refresh não é gasto duas vezes)", async () => {
    let liberar!: (v: { accessToken: string }) => void;
    getAccessToken.mockReturnValue(new Promise((r) => (liberar = r)));
    const a = tokenDoUsuario("u1");
    const b = tokenDoUsuario("u1");
    liberar({ accessToken: "ghu_unico" });
    expect(await Promise.all([a, b])).toEqual(["ghu_unico", "ghu_unico"]);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });

  it("depois que a busca termina, a próxima chamada busca de novo", async () => {
    getAccessToken.mockResolvedValueOnce({ accessToken: "ghu_1" }).mockResolvedValueOnce({ accessToken: "ghu_2" });
    expect(await tokenDoUsuario("u1")).toBe("ghu_1");
    expect(await tokenDoUsuario("u1")).toBe("ghu_2");
  });

  it("se a renovação falhar, tenta mais uma vez (outra instância pode ter renovado)", async () => {
    getAccessToken.mockRejectedValueOnce(new Error("FAILED_TO_GET_ACCESS_TOKEN")).mockResolvedValueOnce({ accessToken: "ghu_da_outra" });
    expect(await tokenDoUsuario("u1")).toBe("ghu_da_outra");
    expect(getAccessToken).toHaveBeenCalledTimes(2);
  });

  it("se falhar duas vezes, pede para entrar de novo", async () => {
    getAccessToken.mockRejectedValue(new Error("FAILED_TO_GET_ACCESS_TOKEN"));
    await expect(tokenDoUsuario("u1")).rejects.toMatchObject({ codigo: "reautenticar", status: 401 });
  });

  it("token já vencido também pede para entrar de novo", async () => {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_velho", accessTokenExpiresAt: new Date(Date.now() - 1000) });
    await expect(tokenDoUsuario("u1")).rejects.toMatchObject({ codigo: "reautenticar", status: 401 });
  });

  it("sem conta do GitHub, recusa com 401", async () => {
    contas = [];
    await expect(tokenDoUsuario("u1")).rejects.toMatchObject({ codigo: "sem_conta_github", status: 401 });
  });
});

describe("githubDoUsuario", () => {
  it("põe o token renovado em cada chamada ao GitHub", async () => {
    getAccessToken.mockResolvedValueOnce({ accessToken: "ghu_a" }).mockResolvedValueOnce({ accessToken: "ghu_b" });
    const vistos: (string | null)[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      vistos.push(new Headers(init?.headers).get("authorization"));
      return Response.json({ login: "octocat" });
    });
    const octokit = githubDoUsuario("u1");
    await octokit.request("GET /user");
    await octokit.request("GET /user");
    fetchFalso.mockRestore();
    expect(vistos).toEqual(["token ghu_a", "token ghu_b"]);
  });
});

describe("appInstaladoNaConta", () => {
  it("só conta a instalação na conta pessoal do usuário", async () => {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ total_count: 1, installations: [{ id: 9, account: { id: 777 } }] }),
    );
    expect(await appInstaladoNaConta("u1", 777)).toBe(true);
    expect(await appInstaladoNaConta("u1", 123)).toBe(false);
    fetchFalso.mockRestore();
  });
});

describe("githubMutuos", () => {
  function comRespostas(responder: (url: URL) => Response) {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const urls: string[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = new URL(String(url));
      urls.push(u.pathname + u.search);
      return responder(u);
    });
    return { github: githubMutuos(githubDoUsuario("u1")), urls, fetchFalso };
  }

  it("lê as contagens e pagina de 100 em 100", async () => {
    const { github, urls, fetchFalso } = comRespostas((u) =>
      u.pathname === "/user" ? Response.json({ login: "lucas", followers: 3, following: 250 }) : Response.json([{ id: 7, login: "pai", extra: 1 }]),
    );
    expect(await github.contagens()).toEqual({ login: "lucas", seguidores: 3, seguindo: 250 });
    expect(await github.listar("seguindo", 3)).toEqual([{ id: 7, login: "pai" }]);
    await github.listar("seguidores", 1);
    fetchFalso.mockRestore();
    expect(urls).toEqual(["/user", "/user/following?per_page=100&page=3", "/user/followers?per_page=100&page=1"]);
  });

  it("204 é sim, 404 é não, e outro erro sobe", async () => {
    const { github, urls, fetchFalso } = comRespostas((u) => {
      if (u.pathname.endsWith("/pai") || u.pathname.endsWith("/following/lucas")) return new Response(null, { status: 204 });
      if (u.pathname.endsWith("/quebrado")) return Response.json({ message: "Server Error" }, { status: 500 });
      return Response.json({ message: "Not Found" }, { status: 404 });
    });
    expect(await github.sigo("pai")).toBe(true);
    expect(await github.sigo("estranho")).toBe(false);
    expect(await github.meSegue("ana", "lucas")).toBe(true);
    await expect(github.sigo("quebrado")).rejects.toMatchObject({ status: 500 });
    fetchFalso.mockRestore();
    expect(urls.slice(0, 3)).toEqual(["/user/following/pai", "/user/following/estranho", "/users/ana/following/lucas"]);
  });
});
