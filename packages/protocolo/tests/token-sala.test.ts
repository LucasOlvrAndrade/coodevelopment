import { describe, expect, it } from "vitest";
import { mensagemDaSala } from "../src/mensagens";
import { DURACAO_TOKEN_SALA_S, assinarTokenSala, validarTokenSala } from "../src/token-sala";

const SEGREDO = "segredo-de-teste-com-tamanho-bom-0123456789";
const AGORA = Date.UTC(2026, 9, 28, 12, 0, 0);
const QUEM = { usuarioId: "lucas", jamId: "k7m2-rbq9", via: "pagina" as const };

function base64url(texto: string) {
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("token da sala (Story 2.5)", () => {
  it("assina e confere: devolve quem é, e vence em 10 minutos", async () => {
    const { token, expiraEm } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    expect(expiraEm.getTime()).toBe(AGORA + DURACAO_TOKEN_SALA_S * 1000);
    expect(await validarTokenSala(token, "k7m2-rbq9", SEGREDO, AGORA + 60_000)).toEqual(QUEM);
  });

  it("vencido não vale", async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    expect(await validarTokenSala(token, "k7m2-rbq9", SEGREDO, AGORA + DURACAO_TOKEN_SALA_S * 1000)).toBeNull();
  });

  it("token de outra jam não abre esta sala", async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    expect(await validarTokenSala(token, "outra-jam", SEGREDO, AGORA)).toBeNull();
  });

  it("assinado com outro segredo não vale", async () => {
    const { token } = await assinarTokenSala(QUEM, "outro-segredo-qualquer-0123456789", AGORA);
    expect(await validarTokenSala(token, "k7m2-rbq9", SEGREDO, AGORA)).toBeNull();
  });

  it("conteúdo mexido (outra pessoa) com a assinatura antiga não vale", async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    const [cabecalho, , assinatura] = token.split(".");
    const corpo = base64url(JSON.stringify({ sub: "intruso", jam: "k7m2-rbq9", via: "pagina", exp: AGORA / 1000 + 600 }));
    expect(await validarTokenSala(`${cabecalho}.${corpo}.${assinatura}`, "k7m2-rbq9", SEGREDO, AGORA)).toBeNull();
  });

  it('cabeçalho com alg "none" ou outro algoritmo é recusado', async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    const [, corpo, assinatura] = token.split(".");
    for (const alg of ["none", "HS512", "RS256"]) {
      const cabecalho = base64url(JSON.stringify({ alg, typ: "JWT" }));
      expect(await validarTokenSala(`${cabecalho}.${corpo}.${assinatura}`, "k7m2-rbq9", SEGREDO, AGORA)).toBeNull();
      expect(await validarTokenSala(`${cabecalho}.${corpo}.`, "k7m2-rbq9", SEGREDO, AGORA)).toBeNull();
    }
  });

  it("formato quebrado não vale e não lança", async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    for (const quebrado of ["", "a.b", `${token}.extra`, token.slice(0, -2) + "**", token.replace(/\.[^.]+\./, ".@@@.")]) {
      expect(await validarTokenSala(quebrado, "k7m2-rbq9", SEGREDO, AGORA)).toBeNull();
    }
  });

  it("sem segredo, nem assina nem confere", async () => {
    const { token } = await assinarTokenSala(QUEM, SEGREDO, AGORA);
    await expect(assinarTokenSala(QUEM, "", AGORA)).rejects.toThrow("SEGREDO_SALA vazio");
    await expect(validarTokenSala(token, "k7m2-rbq9", "", AGORA)).rejects.toThrow("SEGREDO_SALA vazio");
  });
});

describe("mensagens da sala", () => {
  it("presença: aceita a lista de quem está online e recusa o resto", () => {
    expect(mensagemDaSala.safeParse({ v: 1, tipo: "presenca", online: ["lucas"] }).success).toBe(true);
    expect(mensagemDaSala.safeParse({ v: 2, tipo: "presenca", online: [] }).success).toBe(false);
    expect(mensagemDaSala.safeParse({ v: 1, tipo: "outra", online: [] }).success).toBe(false);
  });
});
