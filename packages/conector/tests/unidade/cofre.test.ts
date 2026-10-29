import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ambienteReal } from "../../src/ambiente";
import { apagarSessao, caminhoDaSessao, guardarSessao, lerSessao } from "../../src/cofre";
import { ambienteFalso } from "../apoio/ambiente-falso";

// No Windows, a DPAPI de verdade pelo PowerShell (o [verificar] da story); a
// pasta de dados é a temporária do ambiente falso, o resto é o real.
describe.runIf(process.platform === "win32")("cofre com DPAPI (Windows)", () => {
  const amb = { ...ambienteReal(), pastaDados: ambienteFalso().amb.pastaDados };

  it("guarda cifrado e lê de volta", async () => {
    await guardarSessao(amb, "sessao-secreta.ção");
    expect(readFileSync(caminhoDaSessao(amb)).toString("latin1")).not.toContain("sessao-secreta");
    expect(await lerSessao(amb)).toBe("sessao-secreta.ção");
  }, 30_000);

  it("arquivo que não decifra vira sem sessão (o conector refaz o login)", async () => {
    writeFileSync(caminhoDaSessao(amb), Buffer.from("lixo que não é DPAPI"));
    expect(await lerSessao(amb)).toBeNull();
  }, 30_000);
});

describe("cofre fora do Windows", () => {
  it("guarda, lê e apaga", async () => {
    const { amb } = ambienteFalso();
    expect(await lerSessao(amb)).toBeNull();
    await guardarSessao(amb, "s1");
    expect(await lerSessao(amb)).toBe("s1");
    await apagarSessao(amb);
    expect(await lerSessao(amb)).toBeNull();
    await apagarSessao(amb);
  });
});
