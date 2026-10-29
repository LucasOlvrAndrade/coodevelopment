import { describe, expect, it } from "vitest";
import { chaveDaPasta, esquecerPasta, lerPasta, processoVivo, registrarPasta } from "../../src/descoberta";
import { ambienteFalso } from "../apoio/ambiente-falso";

describe("arquivo de descoberta da pasta", () => {
  it("no Windows, o mesmo caminho com outra caixa ou barra no fim dá o mesmo arquivo", () => {
    const base = process.platform === "win32" ? "C:\\Projetos\\App" : "/projetos/app";
    expect(chaveDaPasta(base, "win32")).toBe(chaveDaPasta(`${base.toUpperCase()}\\`, "win32"));
    expect(chaveDaPasta(base, "linux")).not.toBe(chaveDaPasta(base.toUpperCase(), "linux"));
  });

  it("registra, lê e esquece", async () => {
    const { amb } = ambienteFalso();
    const pasta = amb.cwd;
    expect(await lerPasta(amb, pasta)).toBeNull();
    await registrarPasta(amb, { jamId: "k7m2-rbq9", pid: 4242, pasta });
    expect(await lerPasta(amb, pasta)).toEqual({ jamId: "k7m2-rbq9", pid: 4242, pasta });
    await esquecerPasta(amb, pasta);
    expect(await lerPasta(amb, pasta)).toBeNull();
  });

  it("sabe se o processo do arquivo ainda roda", () => {
    expect(processoVivo(process.pid)).toBe(true);
    expect(processoVivo(2 ** 22 + 12345)).toBe(false);
  });
});
