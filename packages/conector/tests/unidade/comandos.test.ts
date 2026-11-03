import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executar, lerPasta } from "../../src/comandos";
import { ambienteFalso } from "../apoio/ambiente-falso";

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

describe("cli do conector", () => {
  it("--version imprime a versão do pacote", async () => {
    expect(await executar(["--version"], ambienteFalso().amb)).toEqual({ saida: version, codigo: 0 });
  });

  it("sem argumentos mostra a ajuda, com os três comandos", async () => {
    const { saida, codigo } = await executar([], ambienteFalso().amb);
    expect(codigo).toBe(0);
    expect(saida).toContain("npx coodevelopment entrar <jam>");
    expect(saida).toContain("npx coodevelopment diagnostico");
    expect(saida).toContain("encerra a sessão do conector neste computador");
  });

  it("comando desconhecido sai com erro e mostra a ajuda", async () => {
    const { saida, codigo } = await executar(["voar"], ambienteFalso().amb);
    expect(codigo).toBe(1);
    expect(saida).toContain("Comando desconhecido: voar");
  });

  it("entrar sem a jam pede o identificador", async () => {
    expect(await executar(["entrar"], ambienteFalso().amb)).toEqual({
      saida: "Falta o identificador da jam: npx coodevelopment entrar <jam>",
      codigo: 1,
    });
  });

  it("entrar com um identificador fora do formato nem chama o app", async () => {
    const { amb, fetch } = ambienteFalso();
    const { saida, codigo } = await executar(["entrar", "../../x"], amb);
    expect(codigo).toBe(1);
    expect(saida).toMatch(/não parece o identificador de uma jam/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sem internet, uma frase em vez de um erro cru", async () => {
    const { amb } = ambienteFalso();
    const { saida, codigo } = await executar(["entrar", "k7m2-rbq9"], amb);
    expect(codigo).toBe(1);
    expect(saida).toMatch(/^Não consegui falar com https:\/\/app\.teste/);
  });

  it("não usa travessão no texto", async () => {
    const { saida } = await executar([], ambienteFalso().amb);
    expect(saida).not.toContain("—");
  });
});

describe("sair", () => {
  it("sem sessão, avisa e sai sem erro", async () => {
    expect(await executar(["sair"], ambienteFalso().amb)).toEqual({ saida: "Este computador não tem sessão do conector.", codigo: 0 });
  });

  it("encerra a sessão no app e apaga a daqui", async () => {
    const { amb, pedidos } = ambienteFalso({ respostas: { "POST /api/auth/sign-out": { corpo: { success: true } } } });
    const { guardarSessao, lerSessao } = await import("../../src/cofre");
    await guardarSessao(amb, "sessao-123");
    expect(await executar(["sair"], amb)).toEqual({ saida: "Sessão do conector encerrada neste computador.", codigo: 0 });
    expect(pedidos[0]).toMatchObject({ metodo: "POST", caminho: "/api/auth/sign-out", cabecalhos: { authorization: "Bearer sessao-123", origin: "https://app.teste" } });
    expect(await lerSessao(amb)).toBeNull();
  });

  it("sem resposta do app, apaga daqui mesmo assim e avisa", async () => {
    const { amb } = ambienteFalso();
    const { guardarSessao, lerSessao } = await import("../../src/cofre");
    await guardarSessao(amb, "sessao-123");
    const { saida, codigo } = await executar(["sair"], amb);
    expect(codigo).toBe(0);
    expect(saida).toMatch(/o app não respondeu/);
    expect(await lerSessao(amb)).toBeNull();
  });
});

describe("--pasta (escolher onde clonar)", () => {
  it("lê o caminho nas duas formas e tira do resto dos argumentos", () => {
    expect(lerPasta(["entrar", "k7m2-rbq9", "--pasta", "C:\Projetos\jam"])).toEqual({ resto: ["entrar", "k7m2-rbq9"], pasta: "C:\Projetos\jam" });
    expect(lerPasta(["entrar", "--pasta=D:\\Meus projetos", "k7m2-rbq9"])).toEqual({ resto: ["entrar", "k7m2-rbq9"], pasta: "D:\\Meus projetos" });
    expect(lerPasta(["entrar", "k7m2-rbq9"])).toEqual({ resto: ["entrar", "k7m2-rbq9"], pasta: null });
  });

  it("sem o caminho, explica", async () => {
    expect(await executar(["entrar", "k7m2-rbq9", "--pasta"], ambienteFalso().amb)).toEqual({ saida: "Falta o caminho depois de --pasta.", codigo: 1 });
  });
});
