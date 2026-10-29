// @vitest-environment node
import { generateKeyPairSync, createVerify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");
const exigirSessaoDoConector = vi.fn(async () => ({ usuario: { id: "pai" }, via: "conector" as const }));
const obterJam = vi.fn(async (): Promise<object | null> => ({
  id: "k7m2-rbq9",
  nome: "projeto",
  estado: "aberta",
  repoId: 1296269,
  baseSha: "abc123",
  repoOwner: "lucas",
  repoNome: "projeto",
  branch: "main",
}));
const tokenDeLeitura = vi.fn(async () => ({ token: "ghs_leitura", expiraEm: "2026-10-29T13:00:00Z" }));

vi.mock("@/servidor/auth", () => ({ exigirSessaoDoConector }));
vi.mock("@/servidor/db", () => ({ db: () => ({ banco: "de teste" }) }));
vi.mock("@/servidor/dominio/jam", async (original) => ({
  idDeJamValido: (await original<typeof import("@/servidor/dominio/jam")>()).idDeJamValido,
  obterJam,
}));
vi.mock("@/servidor/github-app", async (original) => ({
  ...(await original<typeof import("@/servidor/github-app")>()),
  githubApp: () => ({ tokenDeLeitura }),
}));

const { GET } = await import("@/app/api/jams/[id]/conector/route");
const { POST } = await import("@/app/api/conector/clone-token/route");
const { jwtDoApp } = await import("@/servidor/github-app");

function dadosDaJam(id = "k7m2-rbq9") {
  return GET(new Request(`http://teste/api/jams/${id}/conector`), { params: Promise.resolve({ id }) });
}

function pedirClone(corpo: unknown) {
  return POST(new Request("http://teste/api/conector/clone-token", { method: "POST", body: JSON.stringify(corpo) }), undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/jams/[id]/conector (Story 3.1, AC 2)", () => {
  it("participante recebe o repositório e a branch da jam", async () => {
    const resposta = await dadosDaJam();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(await resposta.json()).toEqual({
      jamId: "k7m2-rbq9",
      nome: "projeto",
      estado: "aberta",
      repo: { owner: "lucas", nome: "projeto", id: 1296269 },
      branch: "main",
      baseSha: "abc123",
      eu: "pai",
    });
    expect(obterJam).toHaveBeenCalledWith({ banco: "de teste" }, "pai", "k7m2-rbq9");
  });

  it("quem não participa e jam que não existe recebem o mesmo 403", async () => {
    obterJam.mockResolvedValueOnce(null);
    expect((await dadosDaJam()).status).toBe(403);
    const resposta = await dadosDaJam("../../x");
    expect(resposta.status).toBe(403);
    expect(obterJam).toHaveBeenCalledTimes(1);
  });

  it("sem sessão, 401 em JSON (o conector refaz o login)", async () => {
    exigirSessaoDoConector.mockRejectedValueOnce(new ErroApp("sem_sessao", 401));
    const resposta = await dadosDaJam();
    expect(resposta.status).toBe(401);
    expect((await resposta.json()).error.code).toBe("sem_sessao");
  });
});

describe("POST /api/conector/clone-token (Story 3.1, AC 2, NFR8)", () => {
  it("participante de jam aberta recebe um token só de leitura do repositório da jam", async () => {
    const resposta = await pedirClone({ jamId: "k7m2-rbq9" });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(await resposta.json()).toEqual({ token: "ghs_leitura", expiraEm: "2026-10-29T13:00:00Z" });
    expect(tokenDeLeitura).toHaveBeenCalledWith({ owner: "lucas", nome: "projeto", id: 1296269 });
  });

  it("quem não participa não recebe token", async () => {
    obterJam.mockResolvedValueOnce(null);
    expect((await pedirClone({ jamId: "k7m2-rbq9" })).status).toBe(403);
    expect(tokenDeLeitura).not.toHaveBeenCalled();
  });

  it("jam fechada não recebe token", async () => {
    obterJam.mockResolvedValueOnce({ id: "k7m2-rbq9", estado: "fechada", repoId: 1, repoOwner: "lucas", repoNome: "projeto" });
    expect((await pedirClone({ jamId: "k7m2-rbq9" })).status).toBe(409);
    expect(tokenDeLeitura).not.toHaveBeenCalled();
  });

  it("corpo fora do formato é entrada inválida", async () => {
    for (const corpo of [null, {}, { jamId: "../x" }, { jamId: 1 }]) {
      expect((await pedirClone(corpo)).status).toBe(400);
    }
    expect(obterJam).not.toHaveBeenCalled();
  });
});

describe("jwtDoApp", () => {
  it("assina com RS256, emitido pelo app, de 9 minutos com 60 s de folga no relógio", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const agora = Date.UTC(2026, 9, 29, 12, 0, 0);
    const jwt = jwtDoApp("5481248", privateKey.export({ type: "pkcs1", format: "pem" }).toString(), agora);
    const [cabecalho, corpo, assinatura] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(cabecalho, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const segundos = agora / 1000;
    expect(JSON.parse(Buffer.from(corpo, "base64url").toString())).toEqual({ iat: segundos - 60, exp: segundos + 540, iss: "5481248" });
    expect(createVerify("RSA-SHA256").update(`${cabecalho}.${corpo}`).verify(publicKey, Buffer.from(assinatura, "base64url"))).toBe(true);
  });
});
