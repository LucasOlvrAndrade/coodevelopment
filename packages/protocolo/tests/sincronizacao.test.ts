import { describe, expect, it } from "vitest";
import {
  TAMANHO_MAXIMO,
  caminhoSincronizavel,
  hashDoConteudo,
  mensagemDaSala,
  mensagemDoConector,
  tamanhoDoConteudo,
} from "../src/index";

describe("caminhoSincronizavel (Story 3.3, AC 2 e 3)", () => {
  it("normaliza barra invertida e pontos, sem sair da raiz", () => {
    expect(caminhoSincronizavel("src\\app\\./page.tsx")).toEqual({ ok: true, caminho: "src/app/page.tsx" });
    expect(caminhoSincronizavel("src/../README.md")).toEqual({ ok: true, caminho: "README.md" });
  });

  it("recusa o que sai da raiz ou é absoluto", () => {
    for (const c of ["../fora.txt", "/etc/passwd", "C:\\Windows\\win.ini", "a/../../b", ""]) {
      expect(caminhoSincronizavel(c)).toEqual({ ok: false, motivo: "caminho_invalido" });
    }
  });

  it("recusa .git em qualquer nível e em qualquer caixa, pastas de dependência e .env (exceto .env.example)", () => {
    for (const c of [".git/config", "sub/.git/HEAD", ".GIT/hooks/pre-commit", "node_modules/x/index.js", "app/.next/cache.json", ".venv/bin/python", "venv/lib/a.py", "pkg/__pycache__/m.pyc", ".env", ".env.local", "apps/web/.env.production", ".ENV"]) {
      expect(caminhoSincronizavel(c)).toEqual({ ok: false, motivo: "proibido" });
    }
    expect(caminhoSincronizavel(".env.example")).toEqual({ ok: true, caminho: ".env.example" });
    expect(caminhoSincronizavel("docs/.gitignore")).toEqual({ ok: true, caminho: "docs/.gitignore" });
    expect(caminhoSincronizavel("src/environment.ts")).toEqual({ ok: true, caminho: "src/environment.ts" });
  });
});

describe("nomes que o Windows lê de outro jeito (gate da 3.3, SEC-001)", () => {
  it("recusa o nome curto 8.3, fluxo do NTFS, ponto ou espaço no fim, nome reservado, caractere proibido e temporário do conector", () => {
    for (const c of [
      "GIT~1/hooks/pre-commit",
      "NODE_M~1/x.js",
      ".git::$INDEX_ALLOCATION/hooks/x",
      "a.txt:segredo",
      ".git./config",
      ".git /config",
      "pasta./a.txt",
      "con",
      "CON.ts",
      "src/aux.js",
      "nul",
      "com1.txt",
      "LPT9",
      "a<b>.txt",
      "a|b",
      "pergunta?.md",
      "tab\there.txt",
      ".coodevelopment-abc123.tmp",
      "src/.coodevelopment-x.tmp",
    ]) {
      expect(caminhoSincronizavel(c), c).toEqual({ ok: false, motivo: "caminho_invalido" });
    }
  });

  it("nomes parecidos e legítimos continuam passando", () => {
    for (const c of ["config.ts", "consumer.ts", "console.log.md", "auxiliar.js", "comunicacao/com.ts", "nula.txt", "a~b.txt", "versao~final.md", "src/.gitkeep", ".github/workflows/ci.yaml", "pasta com espaco/a b.txt", "coodevelopment.md"]) {
      expect(caminhoSincronizavel(c), c).toMatchObject({ ok: true });
    }
  });
});

describe("hashDoConteudo (AC 4)", () => {
  it("CRLF, LF e CR solto dão o mesmo hash", async () => {
    const lf = await hashDoConteudo("a\nb\n", false);
    expect(await hashDoConteudo("a\r\nb\r\n", false)).toBe(lf);
    expect(await hashDoConteudo("a\rb\r", false)).toBe(lf);
    expect(lf).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashDoConteudo("a\nb", false)).not.toBe(lf);
  });

  it("binário é hash dos bytes, sem mexer em final de linha", async () => {
    const comCrlf = btoa("\x00\r\n");
    const comLf = btoa("\x00\n");
    expect(await hashDoConteudo(comCrlf, true)).not.toBe(await hashDoConteudo(comLf, true));
  });

  it("tamanho no disco: texto em UTF-8, binário pelos bytes do base64", () => {
    expect(tamanhoDoConteudo("ção", false)).toBe(5);
    expect(tamanhoDoConteudo(btoa("abcd"), true)).toBe(4);
    expect(tamanhoDoConteudo(btoa("abcde"), true)).toBe(5);
    expect(TAMANHO_MAXIMO).toBe(1024 * 1024);
  });
});

describe("mensagens da sincronização", () => {
  const hash = "a".repeat(64);

  it("escrever, com e sem conteúdo de base", () => {
    const base = { v: 1, tipo: "escrever", caminho: "a.txt", versaoBase: 0, hash, conteudo: "x", binario: false, apagado: false };
    expect(mensagemDoConector.safeParse(base).success).toBe(true);
    expect(mensagemDoConector.safeParse({ ...base, conteudoBase: null }).success).toBe(true);
    expect(mensagemDoConector.safeParse({ ...base, conteudoBase: "antes" }).success).toBe(true);
    expect(mensagemDoConector.safeParse({ ...base, versaoBase: -1 }).success).toBe(false);
    expect(mensagemDoConector.safeParse({ ...base, hash: "curto" }).success).toBe(false);
  });

  it("arquivo, aceito, recusado e manifesto vêm da sala", () => {
    const arquivo = { v: 1, tipo: "arquivo", caminho: "a.txt", versao: 3, hash, conteudo: "x", binario: false, apagado: false, autorId: "pai", origem: "merge" };
    expect(mensagemDaSala.safeParse(arquivo).success).toBe(true);
    expect(mensagemDaSala.safeParse({ ...arquivo, origem: "outra" }).success).toBe(false);
    expect(mensagemDaSala.safeParse({ v: 1, tipo: "aceito", caminho: "a.txt", versao: 4, hash }).success).toBe(true);
    expect(mensagemDaSala.safeParse({ v: 1, tipo: "recusado", caminho: "a.txt", motivo: "conflito_guardado" }).success).toBe(true);
    expect(mensagemDaSala.safeParse({ v: 1, tipo: "manifesto", arquivos: [{ caminho: "a.txt", versao: 2, hash, apagado: true }] }).success).toBe(true);
  });
});
