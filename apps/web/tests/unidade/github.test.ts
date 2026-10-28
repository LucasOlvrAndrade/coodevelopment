import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn();
let contas: { id: string }[] = [{ id: "conta-1" }];

vi.mock("@/servidor/auth", () => ({ auth: () => ({ api: { getAccessToken } }) }));
vi.mock("@/servidor/db", () => {
  const consulta = { from: () => consulta, where: () => consulta, limit: async () => contas };
  return { db: () => ({ select: () => consulta }) };
});

const { githubColaboracao, githubConvites, githubDoUsuario, githubMutuos, githubRepositorios, tokenDoUsuario, appInstaladoNaConta } = await import("@/servidor/github");

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

describe("githubRepositorios", () => {
  function comRespostas(responder: (url: URL) => Response) {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const urls: string[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = new URL(String(url));
      urls.push(u.pathname + u.search);
      return responder(u);
    });
    return { github: githubRepositorios(githubDoUsuario("u1")), urls, fetchFalso };
  }

  it("lista só os repositórios de que a conta é dona, do push mais recente", async () => {
    const { github, urls, fetchFalso } = comRespostas(() =>
      Response.json([{ owner: { login: "lucas" }, name: "projeto", private: true, description: null, pushed_at: "2026-10-27T10:00:00Z" }]),
    );
    expect(await github.listar(2)).toEqual([
      { owner: "lucas", nome: "projeto", privado: true, descricao: null, atualizadoEm: "2026-10-27T10:00:00Z" },
    ]);
    fetchFalso.mockRestore();
    expect(urls).toEqual(["/user/repos?affiliation=owner&sort=pushed&direction=desc&per_page=100&page=2"]);
  });

  it("buscar devolve o dono com o id numérico e a branch padrão; 404 vira null", async () => {
    const { github, fetchFalso } = comRespostas((u) =>
      u.pathname === "/repos/lucas/projeto"
        ? Response.json({ id: 500, owner: { login: "lucas", id: 1000 }, name: "projeto", default_branch: "main" })
        : Response.json({ message: "Not Found" }, { status: 404 }),
    );
    expect(await github.buscar("lucas", "projeto")).toEqual({ id: 500, owner: "lucas", ownerId: 1000, nome: "projeto", branchPadrao: "main" });
    expect(await github.buscar("lucas", "nada")).toBeNull();
    fetchFalso.mockRestore();
  });

  it("sha da branch; repositório vazio (409) e branch inexistente (404) viram null; 500 sobe", async () => {
    // O Octokit manda o ref com a barra codificada (heads%2Fmain), que a API aceita.
    const { github, urls, fetchFalso } = comRespostas((u) => {
      if (decodeURIComponent(u.pathname) === "/repos/lucas/cheio/git/ref/heads/main") return Response.json({ object: { sha: "abc123" } });
      if (u.pathname.startsWith("/repos/lucas/vazio")) return Response.json({ message: "Git Repository is empty." }, { status: 409 });
      if (u.pathname.startsWith("/repos/lucas/quebrado")) return Response.json({ message: "erro" }, { status: 500 });
      return Response.json({ message: "Not Found" }, { status: 404 });
    });
    expect(await github.shaDaBranch("lucas", "cheio", "main")).toBe("abc123");
    expect(await github.shaDaBranch("lucas", "vazio", "main")).toBeNull();
    expect(await github.shaDaBranch("lucas", "cheio", "outra")).toBeNull();
    await expect(github.shaDaBranch("lucas", "quebrado", "main")).rejects.toMatchObject({ status: 500 });
    fetchFalso.mockRestore();
    expect(urls[0]).toBe("/repos/lucas/cheio/git/ref/heads%2Fmain");
  });
});

describe("githubRepositorios: criar e instalação (Story 2.2)", () => {
  function comResposta(responder: (url: URL, init?: RequestInit) => Response) {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const corpos: unknown[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (init?.body) corpos.push(JSON.parse(String(init.body)));
      return responder(new URL(String(url)), init);
    });
    return { github: githubRepositorios(githubDoUsuario("u1")), corpos, fetchFalso };
  }

  it("cria com auto_init e a visibilidade escolhida", async () => {
    const { github, corpos, fetchFalso } = comResposta(() =>
      Response.json({ id: 9001, owner: { login: "lucas", id: 1000 }, name: "novo", default_branch: "main" }, { status: 201 }),
    );
    expect(await github.criar("novo", true)).toEqual({ id: 9001, owner: "lucas", ownerId: 1000, nome: "novo", branchPadrao: "main" });
    fetchFalso.mockRestore();
    expect(corpos).toEqual([{ name: "novo", private: true, auto_init: true }]);
  });

  it("nome que já existe vira repositorio_ja_existe; outro 422 vira nome inválido", async () => {
    const existe = comResposta(() =>
      Response.json({ message: "Repository creation failed.", errors: [{ message: "name already exists on this account" }] }, { status: 422 }),
    );
    await expect(existe.github.criar("projeto", false)).rejects.toMatchObject({ codigo: "repositorio_ja_existe" });
    existe.fetchFalso.mockRestore();
    const outro = comResposta(() => Response.json({ message: "Validation Failed", errors: [{ message: "name is invalid" }] }, { status: 422 }));
    await expect(outro.github.criar("x", false)).rejects.toMatchObject({ codigo: "nome_repositorio_invalido" });
    outro.fetchFalso.mockRestore();
  });

  it("acha a instalação da conta e a seleção de repositórios", async () => {
    const { github, fetchFalso } = comResposta(() =>
      Response.json({
        total_count: 2,
        installations: [
          { id: 5, account: { id: 999 }, repository_selection: "all" },
          { id: 7, account: { id: 1000 }, repository_selection: "selected" },
        ],
      }),
    );
    expect(await github.instalacao(1000)).toEqual({ id: 7, selecao: "selected" });
    expect(await github.instalacao(123)).toEqual({ id: null, selecao: null });
    fetchFalso.mockRestore();
  });
});

describe("githubColaboracao e githubConvites (Story 2.3)", () => {
  function comResposta(responder: (url: URL, init?: RequestInit) => Response) {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const pedidos: string[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = new URL(String(url));
      pedidos.push(`${init?.method ?? "GET"} ${u.pathname} ${init?.body ?? ""}`.trim());
      return responder(u, init);
    });
    return { octokit: githubDoUsuario("u1"), pedidos, fetchFalso };
  }

  it("adiciona com permissão push; 201 traz o id do convite e quem foi convidado; 204 não", async () => {
    const convite = comResposta(() => Response.json({ id: 42, invitee: { id: 1001 } }, { status: 201 }));
    expect(await githubColaboracao(convite.octokit).adicionarColaborador("lucas", "projeto", "pai-dev")).toEqual({
      conviteId: 42,
      convidadoId: 1001,
    });
    expect(convite.pedidos).toEqual(['PUT /repos/lucas/projeto/collaborators/pai-dev {"permission":"push"}']);
    convite.fetchFalso.mockRestore();
    const jaEra = comResposta(() => new Response(null, { status: 204 }));
    expect(await githubColaboracao(jaEra.octokit).adicionarColaborador("lucas", "projeto", "pai-dev")).toEqual({
      conviteId: null,
      convidadoId: null,
    });
    jaEra.fetchFalso.mockRestore();
  });

  it("aceitar: 204 é sim; 403 ou 404 é não (fica o link); 500 sobe", async () => {
    const { octokit, pedidos, fetchFalso } = comResposta((u) => {
      if (u.pathname.endsWith("/42")) return new Response(null, { status: 204 });
      if (u.pathname.endsWith("/43")) return Response.json({ message: "Resource not accessible by integration" }, { status: 403 });
      if (u.pathname.endsWith("/44")) return Response.json({ message: "Not Found" }, { status: 404 });
      return Response.json({ message: "erro" }, { status: 500 });
    });
    const convites = githubConvites(octokit);
    expect(await convites.aceitarConvite(42)).toBe(true);
    expect(await convites.aceitarConvite(43)).toBe(false);
    expect(await convites.aceitarConvite(44)).toBe(false);
    await expect(convites.aceitarConvite(45)).rejects.toMatchObject({ status: 500 });
    fetchFalso.mockRestore();
    expect(pedidos[0]).toBe("PATCH /user/repository_invitations/42");
  });
});

describe("githubColaboracao: login pelo id, cancelar e conferir (gate da 2.3)", () => {
  function comResposta(responder: (url: URL) => Response) {
    getAccessToken.mockResolvedValue({ accessToken: "ghu_x" });
    const pedidos: string[] = [];
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = new URL(String(url));
      pedidos.push(`${init?.method ?? "GET"} ${u.pathname}`);
      return responder(u);
    });
    return { github: githubColaboracao(githubDoUsuario("u1")), pedidos, fetchFalso };
  }

  it("acha o login atual pelo id; conta que não existe vira null", async () => {
    const { github, pedidos, fetchFalso } = comResposta((u) =>
      u.pathname === "/user/1001" ? Response.json({ id: 1001, login: "pai-novo" }) : Response.json({ message: "Not Found" }, { status: 404 }),
    );
    expect(await github.loginAtual(1001)).toBe("pai-novo");
    expect(await github.loginAtual(5)).toBeNull();
    fetchFalso.mockRestore();
    expect(pedidos).toEqual(["GET /user/1001", "GET /user/5"]);
  });

  it("cancela o convite e confere colaborador (204 sim, 404 não)", async () => {
    const { github, pedidos, fetchFalso } = comResposta((u) => {
      if (u.pathname.endsWith("/collaborators/pai-dev")) return new Response(null, { status: 204 });
      if (u.pathname.includes("/invitations/")) return new Response(null, { status: 204 });
      return Response.json({ message: "Not Found" }, { status: 404 });
    });
    await github.cancelarConvite("lucas", "projeto", 42);
    expect(await github.ehColaborador("lucas", "projeto", "pai-dev")).toBe(true);
    expect(await github.ehColaborador("lucas", "projeto", "estranho")).toBe(false);
    fetchFalso.mockRestore();
    expect(pedidos).toEqual([
      "DELETE /repos/lucas/projeto/invitations/42",
      "GET /repos/lucas/projeto/collaborators/pai-dev",
      "GET /repos/lucas/projeto/collaborators/estranho",
    ]);
  });
});
