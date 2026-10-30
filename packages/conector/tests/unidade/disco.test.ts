import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gravarNoDisco, lerLocal, pastaRealSegura } from "../../src/disco";

// Gravação no disco de outra pessoa (Story 3.3, AC 3), com o que o revisor
// do gate usou para gravar um hook do git (SEC-001).

const pastas: string[] = [];

function repositorio() {
  const p = mkdtempSync(join(tmpdir(), "coodev-disco-"));
  pastas.push(p);
  execFileSync("git", ["init", "-q"], { cwd: p });
  return p;
}

afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const texto = (conteudo: string) => ({ conteudo, binario: false, apagado: false });

describe("gravarNoDisco recusa .git por outro nome (gate da 3.3, SEC-001)", () => {
  it("nome curto 8.3, fluxo do NTFS e ponto no fim não gravam nada dentro do .git", async () => {
    const raiz = repositorio();
    for (const caminho of ["GIT~1/hooks/pre-commit", ".git::$INDEX_ALLOCATION/hooks/pre-commit", ".git./hooks/pre-commit", ".git /hooks/x"]) {
      expect(await gravarNoDisco(raiz, caminho, texto("#!/bin/sh\necho invadido\n"), false), caminho).toBe(false);
    }
    expect(existsSync(join(raiz, ".git", "hooks", "pre-commit"))).toBe(false);
    expect(readdirSync(join(raiz, ".git", "hooks")).filter((n) => n.startsWith(".coodevelopment-"))).toEqual([]);
  });

  // A segunda camada, sem o filtro do protocolo: o sistema resolve GIT~1
  // para .git, e a conferência pelo caminho real recusa.
  it.runIf(process.platform === "win32")("o caminho real da pasta (GIT~1 vira .git) é recusado mesmo sem o filtro", async () => {
    const raiz = repositorio();
    const curto = execFileSync("cmd", ["/c", "dir", "/x", "/a:h", raiz], { encoding: "utf8" });
    const nomeCurto = /\s(\S+~\d)\s+\.git\s*$/m.exec(curto)?.[1];
    // Sem nomes curtos no volume (há quem desligue o 8.3), não há o que testar.
    if (!nomeCurto) return;
    expect(await pastaRealSegura(raiz, join(raiz, nomeCurto, "hooks"))).toBe(false);
    expect(await pastaRealSegura(raiz, join(raiz, "src"))).toBe(false);
    mkdirSync(join(raiz, "src"));
    expect(await pastaRealSegura(raiz, join(raiz, "src"))).toBe(true);
  });
});

describe("texto que não é UTF-8 (gate da 3.3, DATA-004)", () => {
  it("Windows-1252 circula como binário e volta igual, byte por byte", async () => {
    const raiz = repositorio();
    const latin = Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]); // "café" em Windows-1252
    writeFileSync(join(raiz, "legado.txt"), latin);
    const lido = await lerLocal(raiz, "legado.txt");
    expect(lido).toMatchObject({ existe: true, binario: true });
    const outra = repositorio();
    if (!lido || !lido.existe) throw new Error("não leu");
    await gravarNoDisco(outra, "legado.txt", lido, true);
    expect(readFileSync(join(outra, "legado.txt")).equals(latin)).toBe(true);
  });

  it("UTF-8 com acento continua texto", async () => {
    const raiz = repositorio();
    writeFileSync(join(raiz, "a.txt"), "ação\n");
    expect(await lerLocal(raiz, "a.txt")).toMatchObject({ binario: false, conteudo: "ação\n" });
  });
});

describe("permissão do arquivo (gate da 3.3, REL-004)", () => {
  it.runIf(process.platform !== "win32")("script executável continua executável depois de regravado", async () => {
    const raiz = repositorio();
    writeFileSync(join(raiz, "rodar.sh"), "#!/bin/sh\n");
    chmodSync(join(raiz, "rodar.sh"), 0o755);
    await gravarNoDisco(raiz, "rodar.sh", texto("#!/bin/sh\necho oi\n"), false);
    expect(statSync(join(raiz, "rodar.sh")).mode & 0o111).not.toBe(0);
  });
});
