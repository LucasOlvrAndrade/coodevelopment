import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { executar } from "../../src/comandos";

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

describe("cli do conector", () => {
  it("--version imprime a versão do pacote", () => {
    expect(executar(["--version"])).toEqual({ saida: version, codigo: 0 });
  });

  it("sem argumentos mostra a ajuda", () => {
    const { saida, codigo } = executar([]);
    expect(codigo).toBe(0);
    expect(saida).toContain("npx coodevelopment entrar <jam>");
  });

  it("comandos ainda não implementados avisam e saem com erro", () => {
    expect(executar(["entrar", "k7m2-rbq9"])).toEqual({
      saida: 'O comando "entrar" ainda não está disponível nesta versão.',
      codigo: 1,
    });
  });

  it("comando desconhecido sai com erro e mostra a ajuda", () => {
    const { saida, codigo } = executar(["voar"]);
    expect(codigo).toBe(1);
    expect(saida).toContain("Comando desconhecido: voar");
  });

  it("textos sem travessão", () => {
    expect(executar(["--help"]).saida).not.toContain("—");
  });
});
