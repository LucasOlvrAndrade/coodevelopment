import { beforeEach, describe, expect, it, vi } from "vitest";

const obterSessao = vi.fn();
const appInstaladoNaConta = vi.fn();

vi.mock("@/servidor/auth", () => ({ obterSessao }));
vi.mock("@/servidor/github", () => ({ appInstaladoNaConta }));
vi.mock("@/servidor/env", () => ({ env: () => ({ GITHUB_APP_SLUG: "coodevelopment" }) }));

const { GET } = await import("@/app/api/conta/continuar/route");

// redirect() do Next lança um erro com o destino no digest.
async function destino(): Promise<string> {
  try {
    await GET(new Request("http://localhost:3000/api/conta/continuar"), {});
  } catch (e) {
    const digest = String((e as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw e;
  }
  throw new Error("não redirecionou");
}

const sessao = { user: { id: "u1", githubId: 777 } };

beforeEach(() => {
  obterSessao.mockReset();
  appInstaladoNaConta.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/conta/continuar (decisão A7)", () => {
  it("sem sessão, volta para a página inicial", async () => {
    obterSessao.mockResolvedValue(null);
    expect(await destino()).toBe("/");
  });

  it("com o app instalado na conta, vai para o Início", async () => {
    obterSessao.mockResolvedValue(sessao);
    appInstaladoNaConta.mockResolvedValue(true);
    expect(await destino()).toBe("/inicio");
    expect(appInstaladoNaConta).toHaveBeenCalledWith("u1", 777);
  });

  it("sem o app instalado, segue direto para a instalação no GitHub", async () => {
    obterSessao.mockResolvedValue(sessao);
    appInstaladoNaConta.mockResolvedValue(false);
    expect(await destino()).toBe("https://github.com/apps/coodevelopment/installations/new");
  });

  it("erro inesperado (banco fora do ar) vira a resposta de erro padrão", async () => {
    obterSessao.mockRejectedValue(new Error("banco fora do ar"));
    const resposta = await GET(new Request("http://localhost:3000/api/conta/continuar"), {});
    expect(resposta.status).toBe(500);
    expect(await resposta.json()).toMatchObject({ error: { code: "inesperado" } });
  });

  it("se o GitHub não responder, entra mesmo assim", async () => {
    obterSessao.mockResolvedValue(sessao);
    appInstaladoNaConta.mockRejectedValue(new Error("fora do ar"));
    expect(await destino()).toBe("/inicio");
  });
});
