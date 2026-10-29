// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { githubApp } = await import("@/servidor/github-app");

const REPO = { owner: "lucas", nome: "projeto", id: 1296269 };
const respostas = vi.fn<(url: string, init?: RequestInit) => Response>();

beforeEach(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv("GITHUB_APP_ID", "5481248");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey.export({ type: "pkcs1", format: "pem" }).toString());
  respostas.mockReset();
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => respostas(String(url instanceof Request ? url.url : url), init));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("token de clone pelo GitHub App (Story 3.1)", () => {
  it("pede o token só de leitura e só do repositório da jam", async () => {
    respostas.mockImplementation((url) =>
      url.endsWith("/repos/lucas/projeto/installation")
        ? Response.json({ id: 175500112 })
        : Response.json({ token: "ghs_x", expires_at: "2026-10-29T13:59:50Z" }, { status: 201 }),
    );
    expect(await githubApp().tokenDeLeitura(REPO)).toEqual({ token: "ghs_x", expiraEm: "2026-10-29T13:59:50Z" });
    const [url, init] = respostas.mock.calls[1]!;
    expect(url).toBe("https://api.github.com/app/installations/175500112/access_tokens");
    expect(JSON.parse(String(init?.body))).toEqual({ repository_ids: [1296269], permissions: { contents: "read" } });
  });

  it("app sem instalação no dono (404) ou sem o repositório da jam (422): erro que manda o dono liberar (gate da 3.1, REL-006)", async () => {
    respostas.mockImplementation(() => Response.json({ message: "Not Found" }, { status: 404 }));
    await expect(githubApp().tokenDeLeitura(REPO)).rejects.toMatchObject({ codigo: "repositorio_fora_do_app", status: 409 });

    respostas.mockImplementation((url) =>
      url.endsWith("/installation") ? Response.json({ id: 1 }) : Response.json({ message: "There is at least one repository that does not exist or is not accessible" }, { status: 422 }),
    );
    await expect(githubApp().tokenDeLeitura(REPO)).rejects.toMatchObject({ codigo: "repositorio_fora_do_app", message: expect.stringMatching(/Quem criou a jam/) });
  });

  it("outros erros do GitHub seguem como inesperados", async () => {
    respostas.mockImplementation(() => Response.json({ message: "Server Error" }, { status: 500 }));
    await expect(githubApp().tokenDeLeitura(REPO)).rejects.not.toMatchObject({ codigo: "repositorio_fora_do_app" });
  });
});
