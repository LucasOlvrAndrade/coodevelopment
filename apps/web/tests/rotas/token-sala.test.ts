// @vitest-environment node
import { validarTokenSala } from "@coodevelopment/protocolo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ErroApp } = await import("@/servidor/erros");
const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const obterJam = vi.fn(async (): Promise<object | null> => ({ id: "k7m2-rbq9" }));

const viaDaSessao = vi.fn(async (): Promise<"pagina" | "conector"> => "pagina");
vi.mock("@/servidor/auth", () => ({ exigirSessao, viaDaSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({ banco: "de teste" }) }));
vi.mock("@/servidor/dominio/jam", async (original) => ({
  idDeJamValido: (await original<typeof import("@/servidor/dominio/jam")>()).idDeJamValido,
  obterJam,
}));

const { POST } = await import("@/app/api/jams/[id]/token-sala/route");

const SEGREDO = "segredo-de-teste-da-rota-0123456789abcdef";

function pedir(id = "k7m2-rbq9") {
  return POST(new Request(`http://teste/api/jams/${id}/token-sala`, { method: "POST" }), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SEGREDO_SALA", SEGREDO);
  vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "coodevelopment-sala.conta.workers.dev");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/jams/[id]/token-sala (Story 2.5)", () => {
  it("participante recebe o token da jam, o endereço da sala e quando vence (AC 3)", async () => {
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    const { token, salaUrl, expiraEm } = await resposta.json();
    expect(salaUrl).toBe("wss://coodevelopment-sala.conta.workers.dev/parties/jam/k7m2-rbq9");
    expect(new Date(expiraEm).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    expect(await validarTokenSala(token, "k7m2-rbq9", SEGREDO)).toEqual({ usuarioId: "lucas", jamId: "k7m2-rbq9", via: "pagina" });
    expect(obterJam).toHaveBeenCalledWith({ banco: "de teste" }, "lucas", "k7m2-rbq9");
  });

  it("quem não participa e jam que não existe recebem o mesmo 403", async () => {
    obterJam.mockResolvedValueOnce(null);
    const resposta = await pedir("zzzz-zzzz");
    expect(resposta.status).toBe(403);
    expect((await resposta.json()).error.code).toBe("nao_participa");
  });

  it("id fora do formato nem vai ao banco", async () => {
    for (const id of ["a/b", "x".repeat(21), "..", "a?b", "K7M2-RBQ9"]) {
      expect((await pedir(id)).status).toBe(403);
    }
    expect(obterJam).not.toHaveBeenCalled();
  });

  it("sem a sala configurada, 503, e a página segue sem a presença (AC 4)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "");
    expect((await pedir()).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "coodevelopment-sala.conta.workers.dev");
    vi.stubEnv("SEGREDO_SALA", "");
    const resposta = await pedir();
    expect(resposta.status).toBe(503);
    expect((await resposta.json()).error.code).toBe("sala_indisponivel");
  });

  it("sem sessão, 401", async () => {
    exigirSessao.mockRejectedValueOnce(new ErroApp("sem_sessao", 401));
    expect((await pedir()).status).toBe(401);
    expect(obterJam).not.toHaveBeenCalled();
  });

  it("com a sessão do conector (Bearer), o token diz à sala que é o conector (Story 3.1, AC 3)", async () => {
    viaDaSessao.mockResolvedValueOnce("conector");
    const { token } = await (await pedir()).json();
    expect(await validarTokenSala(token, "k7m2-rbq9", SEGREDO)).toEqual({ usuarioId: "lucas", jamId: "k7m2-rbq9", via: "conector" });
  });

  it("a sala local do wrangler dev é sem TLS", async () => {
    vi.stubEnv("NEXT_PUBLIC_SALA_HOST", "localhost:1999");
    expect((await (await pedir()).json()).salaUrl).toBe("ws://localhost:1999/parties/jam/k7m2-rbq9");
  });
});
