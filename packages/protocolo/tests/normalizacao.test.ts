import { describe, expect, it } from "vitest";
import { normalizarCaminho, normalizarFinalDeLinha } from "../src/normalizacao";

describe("normalizarCaminho", () => {
  it("troca barra invertida por barra", () => {
    expect(normalizarCaminho("src\\app\\page.tsx")).toBe("src/app/page.tsx");
  });

  it("remove ./ e barras repetidas", () => {
    expect(normalizarCaminho("./src//lib/./a.ts")).toBe("src/lib/a.ts");
  });

  it("resolve .. dentro da raiz", () => {
    expect(normalizarCaminho("src/lib/../app/a.ts")).toBe("src/app/a.ts");
  });

  it("recusa caminho que sai da raiz", () => {
    expect(normalizarCaminho("../fora.txt")).toBeNull();
    expect(normalizarCaminho("src/../../fora.txt")).toBeNull();
  });

  it("recusa caminho absoluto", () => {
    expect(normalizarCaminho("/etc/passwd")).toBeNull();
    expect(normalizarCaminho("C:\\Windows\\win.ini")).toBeNull();
    expect(normalizarCaminho("c:/x.txt")).toBeNull();
  });

  it("recusa caminho vazio", () => {
    expect(normalizarCaminho("")).toBeNull();
    expect(normalizarCaminho("./")).toBeNull();
  });
});

describe("normalizarFinalDeLinha", () => {
  it("converte CRLF e CR em LF", () => {
    expect(normalizarFinalDeLinha("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });

  it("não mexe em texto já com LF", () => {
    expect(normalizarFinalDeLinha("a\nb\n")).toBe("a\nb\n");
  });
});
