// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/servidor/db/schema";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

// Login do conector por dispositivo (Story 3.1, AC 1), com o Better Auth de
// verdade contra o PGlite com as migrações reais.

const teste = await criarBancoDeTeste();
let cabecalhos = new Headers();

vi.mock("@/servidor/db", () => ({ db: () => teste.banco }));
vi.mock("next/headers", () => ({ headers: async () => cabecalhos }));

vi.stubEnv("DATABASE_URL", "postgres://u:s@localhost/db");
vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
vi.stubEnv("GITHUB_APP_CLIENT_ID", "id");
vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "segredo");
vi.stubEnv("GITHUB_APP_SLUG", "coodevelopment");

const { auth, exigirSessao, viaDaSessao, ID_DO_CONECTOR } = await import("@/servidor/auth");
const { consultarDispositivo, responderDispositivo } = await import("@/servidor/acoes/dispositivo");

const URL_APP = "http://localhost:3000/api/auth";

async function pedirCodigo(clientId = ID_DO_CONECTOR) {
  return auth().handler(
    new Request(`${URL_APP}/device/code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    }),
  );
}

async function pedirSessao(deviceCode: string) {
  return auth().handler(
    new Request(`${URL_APP}/device/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode, client_id: ID_DO_CONECTOR }),
    }),
  );
}

// Sessão do navegador de cada pessoa, posta direto no banco; o Bearer serve de
// cookie nos testes (o plugin converte um no outro).
async function entrarComo(usuarioId: string) {
  const token = `sessao-${usuarioId}`;
  cabecalhos = new Headers({ authorization: `Bearer ${token}` });
}

beforeAll(async () => {
  await criarUsuario(teste.banco, "lucas", "lucas");
  await criarUsuario(teste.banco, "pai", "pai");
  const vence = new Date(Date.now() + 86_400_000);
  await teste.banco.insert(schema.session).values([
    { id: "s-lucas", token: "sessao-lucas", userId: "lucas", expiresAt: vence },
    { id: "s-pai", token: "sessao-pai", userId: "pai", expiresAt: vence },
  ]);
});

afterAll(() => teste.fechar());

beforeEach(() => {
  cabecalhos = new Headers();
});

describe("pedir o código", () => {
  it("o conector recebe o código, o link para /dispositivo e o intervalo de 5 s", async () => {
    const resposta = await pedirCodigo();
    expect(resposta.status).toBe(200);
    const dados = await resposta.json();
    expect(dados.user_code).toMatch(/^[A-Z0-9]{8}$/);
    expect(dados.verification_uri).toBe("http://localhost:3000/dispositivo");
    expect(dados.verification_uri_complete).toBe(`http://localhost:3000/dispositivo?user_code=${dados.user_code}`);
    expect(dados.interval).toBe(5);
    expect(dados.expires_in).toBe(600);
  });

  it("outro cliente não pede código", async () => {
    expect((await pedirCodigo("outro-app")).status).toBe(400);
  });
});

describe("confirmar no navegador e entrar pelo terminal", () => {
  it("antes da confirmação, o conector espera; depois, recebe uma sessão que vale como Bearer", async () => {
    const { device_code, user_code } = await (await pedirCodigo()).json();
    expect((await (await pedirSessao(device_code)).json()).error).toBe("authorization_pending");

    await entrarComo("lucas");
    expect(await consultarDispositivo(user_code.toLowerCase())).toEqual({ ok: true, dados: { codigo: user_code, situacao: "pendente" } });
    expect(await responderDispositivo(user_code, true)).toEqual({ ok: true, dados: { situacao: "confirmado" } });

    // Consultar de novo antes de 5 s dá slow_down (RFC 8628); aqui o tempo passa.
    expect((await (await pedirSessao(device_code)).json()).error).toBe("slow_down");
    await teste.banco.update(schema.deviceCode).set({ lastPolledAt: null });
    const resposta = await pedirSessao(device_code);
    expect(resposta.status).toBe(200);
    const { access_token } = await resposta.json();
    expect(access_token).toEqual(expect.any(String));

    cabecalhos = new Headers({ authorization: `Bearer ${access_token}` });
    expect((await exigirSessao()).id).toBe("lucas");
    expect(await viaDaSessao()).toBe("conector");
  });

  it("recusado, o conector recebe access_denied", async () => {
    const { device_code, user_code } = await (await pedirCodigo()).json();
    await entrarComo("lucas");
    await consultarDispositivo(user_code);
    expect(await responderDispositivo(user_code, false)).toEqual({ ok: true, dados: { situacao: "recusado" } });
    expect((await (await pedirSessao(device_code)).json()).error).toBe("access_denied");
  });

  it("o código fica com a conta de quem abriu primeiro; outra conta não confirma", async () => {
    const { user_code } = await (await pedirCodigo()).json();
    await entrarComo("lucas");
    await consultarDispositivo(user_code);
    await entrarComo("pai");
    expect(await responderDispositivo(user_code, true)).toMatchObject({ ok: false, erro: { codigo: "codigo_dispositivo_de_outro" } });
  });

  it("código que não existe e código fora do formato", async () => {
    await entrarComo("lucas");
    expect(await consultarDispositivo("ZZZZZZZZ")).toMatchObject({ ok: false, erro: { codigo: "codigo_dispositivo_invalido" } });
    expect(await consultarDispositivo("../x")).toMatchObject({ ok: false, erro: { codigo: "codigo_dispositivo_invalido" } });
  });

  it("código vencido", async () => {
    const { user_code } = await (await pedirCodigo()).json();
    const { eq } = await import("drizzle-orm");
    await teste.banco.update(schema.deviceCode).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.deviceCode.userCode, user_code));
    await entrarComo("lucas");
    expect(await consultarDispositivo(user_code)).toMatchObject({ ok: false, erro: { codigo: "codigo_dispositivo_vencido" } });
  });

  it("sem sessão, não consulta nem confirma", async () => {
    const { user_code } = await (await pedirCodigo()).json();
    expect(await consultarDispositivo(user_code)).toMatchObject({ ok: false, erro: { codigo: "sem_sessao" } });
    expect(await responderDispositivo(user_code, true)).toMatchObject({ ok: false, erro: { codigo: "sem_sessao" } });
  });
});

describe("Bearer", () => {
  it("sem Bearer, a sessão é da página", async () => {
    expect(await viaDaSessao()).toBe("pagina");
  });

  it("Bearer que não é sessão não entra", async () => {
    cabecalhos = new Headers({ authorization: "Bearer inventado" });
    await expect(exigirSessao()).rejects.toMatchObject({ codigo: "sem_sessao" });
  });

  it("o token da sessão nunca vai para o cabeçalho set-auth-token", () => {
    const plugin = auth().options.plugins?.find((p) => p.id === "bearer");
    expect(plugin?.hooks?.before).toHaveLength(1);
    expect((plugin?.hooks as { after?: unknown } | undefined)?.after).toBeUndefined();
  });
});
