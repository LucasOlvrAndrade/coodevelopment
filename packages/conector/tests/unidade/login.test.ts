import { describe, expect, it } from "vitest";
import { entrarPorDispositivo, ID_DO_CONECTOR, LoginRecusado } from "../../src/login";
import { ambienteFalso } from "../apoio/ambiente-falso";

const CODIGO = {
  corpo: {
    device_code: "dispositivo-1",
    user_code: "WDJBMJHT",
    verification_uri: "https://app.teste/dispositivo",
    verification_uri_complete: "https://app.teste/dispositivo?user_code=WDJBMJHT",
    expires_in: 600,
    interval: 5,
  },
};

const erro = (codigo: string) => ({ status: 400, corpo: { error: codigo } });

describe("login por dispositivo (Story 3.1, AC 1)", () => {
  it("mostra o código, abre o navegador e consulta a cada 5 s até receber a sessão", async () => {
    const { amb, linhas, pedidos } = ambienteFalso({
      respostas: {
        "POST /api/auth/device/code": CODIGO,
        "POST /api/auth/device/token": [erro("authorization_pending"), erro("authorization_pending"), { corpo: { access_token: "sessao-nova" } }],
      },
    });
    expect(await entrarPorDispositivo(amb)).toBe("sessao-nova");
    expect(pedidos[0]).toMatchObject({ caminho: "/api/auth/device/code", corpo: { client_id: ID_DO_CONECTOR } });
    expect(pedidos.at(-1)).toMatchObject({
      caminho: "/api/auth/device/token",
      corpo: { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: "dispositivo-1", client_id: ID_DO_CONECTOR },
    });
    expect(linhas).toContain("    WDJB-MJHT");
    expect(amb.abrirNavegador).toHaveBeenCalledWith("https://app.teste/dispositivo?user_code=WDJBMJHT");
    expect(amb.esperar).toHaveBeenCalledTimes(3);
    expect(amb.esperar).toHaveBeenCalledWith(5000);
    // A sessão nunca vai para o terminal.
    expect(linhas.join("\n")).not.toContain("sessao-nova");
  });

  it("slow_down soma 5 s ao intervalo, como manda a RFC 8628", async () => {
    const { amb } = ambienteFalso({
      respostas: {
        "POST /api/auth/device/code": CODIGO,
        "POST /api/auth/device/token": [erro("slow_down"), { corpo: { access_token: "s" } }],
      },
    });
    await entrarPorDispositivo(amb);
    expect(amb.esperar).toHaveBeenNthCalledWith(1, 5000);
    expect(amb.esperar).toHaveBeenNthCalledWith(2, 10000);
  });

  it("recusado no navegador", async () => {
    const { amb } = ambienteFalso({
      respostas: { "POST /api/auth/device/code": CODIGO, "POST /api/auth/device/token": erro("access_denied") },
    });
    await expect(entrarPorDispositivo(amb)).rejects.toThrow(new LoginRecusado("O login foi recusado no navegador."));
  });

  it("código vencido", async () => {
    const { amb } = ambienteFalso({
      respostas: { "POST /api/auth/device/code": CODIGO, "POST /api/auth/device/token": erro("expired_token") },
    });
    await expect(entrarPorDispositivo(amb)).rejects.toBeInstanceOf(LoginRecusado);
  });

  it("erro desconhecido para a consulta", async () => {
    const { amb } = ambienteFalso({
      respostas: { "POST /api/auth/device/code": CODIGO, "POST /api/auth/device/token": erro("invalid_grant") },
    });
    await expect(entrarPorDispositivo(amb)).rejects.toThrow(/invalid_grant/);
  });

  it("429 do limite de taxa vale como esperar mais, respeitando o Retry-After (gate da 3.1, REL-002)", async () => {
    const { amb } = ambienteFalso({
      respostas: {
        "POST /api/auth/device/code": CODIGO,
        "POST /api/auth/device/token": [{ status: 429, corpo: {} }, { corpo: { access_token: "s" } }],
      },
    });
    expect(await entrarPorDispositivo(amb)).toBe("s");
    expect(amb.esperar).toHaveBeenNthCalledWith(2, 10000);
  });

  it("queda de rede no meio da espera tenta de novo, sem derrubar o login (gate da 3.1, REL-005)", async () => {
    const { amb, fetch, linhas } = ambienteFalso({
      respostas: { "POST /api/auth/device/code": CODIGO, "POST /api/auth/device/token": { corpo: { access_token: "s" } } },
    });
    const real = fetch.getMockImplementation()!;
    let caiu = 0;
    fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/device/token") && caiu++ < 2) throw new TypeError("fetch failed");
      return real(url, init);
    });
    expect(await entrarPorDispositivo(amb)).toBe("s");
    expect(linhas.filter((l) => l === "Sem conexão com o app. Tentando de novo...")).toHaveLength(1);
    expect(amb.esperar).toHaveBeenNthCalledWith(2, 10000);
    expect(amb.esperar).toHaveBeenNthCalledWith(3, 20000);
  });

  it("link de login que não é do app não abre no navegador (gate da 3.1, SEC-003)", async () => {
    for (const url of ["file:///C:/Windows/System32/calc.exe", "https://outro.site/dispositivo", "http://app.teste/dispositivo"]) {
      const { amb } = ambienteFalso({
        respostas: { "POST /api/auth/device/code": { corpo: { ...CODIGO.corpo, verification_uri_complete: url } } },
      });
      await expect(entrarPorDispositivo(amb)).rejects.toThrow("O app mandou um endereço de login que não é dele.");
      expect(amb.abrirNavegador).not.toHaveBeenCalled();
    }
  });
});
