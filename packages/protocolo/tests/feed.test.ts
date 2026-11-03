import { describe, expect, it } from "vitest";
import { arquivoDeDependencias, caminhoSincronizavel, mensagemDaSala, mensagemDoConector, resumoDaDiferenca } from "../src";

describe("arquivoDeDependencias", () => {
  it.each([
    "package.json",
    "apps/web/package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements.txt",
    "requirements-dev.txt",
    "pyproject.toml",
    "Pipfile",
    "Gemfile.lock",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "pom.xml",
    "src/App/App.csproj",
    "pubspec.yaml",
  ])("%s é de dependências", (c) => expect(arquivoDeDependencias(c)).toBe(true));

  it.each(["src/package.ts", "README.md", "docs/requirements.md", "package.json.bak", "go.mod.txt"])("%s não é", (c) =>
    expect(arquivoDeDependencias(c)).toBe(false),
  );
});

describe("resumoDaDiferenca", () => {
  it("conta linhas acrescentadas e tiradas", () => {
    expect(resumoDaDiferenca("a\nb\nc\n", "a\nB\nc\nd\n")).toEqual({ adicionadas: 2, removidas: 1 });
  });

  it("arquivo novo conta todas como acrescentadas", () => {
    expect(resumoDaDiferenca("", "um\ndois")).toEqual({ adicionadas: 2, removidas: 0 });
  });

  it("final de linha diferente não conta como mudança (NFR7)", () => {
    expect(resumoDaDiferenca("a\r\nb\r\n", "a\nb\n")).toEqual({ adicionadas: 0, removidas: 0 });
  });

  it("trecho grande demais para comparar devolve null", () => {
    const antes = Array.from({ length: 4000 }, (_, i) => `a${i}`).join("\n");
    const depois = Array.from({ length: 4000 }, (_, i) => `b${i}`).join("\n");
    expect(resumoDaDiferenca(antes, depois)).toBeNull();
  });

  it("arquivo grande com mudança pequena ainda conta, porque o começo e o fim iguais saem antes", () => {
    const linhas = Array.from({ length: 20000 }, (_, i) => `linha ${i}`);
    const depois = [...linhas];
    depois[10000] = "mudou";
    expect(resumoDaDiferenca(linhas.join("\n"), depois.join("\n"))).toEqual({ adicionadas: 1, removidas: 1 });
  });
});

describe("nome disfarçado (gate da 3.4, SEC-002)", () => {
  it("caracteres invisíveis de formatação no caminho são recusados", () => {
    expect(caminhoSincronizavel("fatura‮txt.exe")).toEqual({ ok: false, motivo: "caminho_invalido" });
    expect(caminhoSincronizavel("src/a​b.ts")).toEqual({ ok: false, motivo: "caminho_invalido" });
    expect(caminhoSincronizavel("docs/configuração.md")).toMatchObject({ ok: true });
  });
});

describe("mensagens do feed", () => {
  it("a página entende o feed", () => {
    const msg = {
      v: 1,
      tipo: "feed",
      inicial: false,
      eventos: [
        {
          id: 1,
          tipo: "arquivos",
          autorId: "u1",
          em: "2026-11-03T10:00:00.000Z",
          atualizadoEm: "2026-11-03T10:00:00.000Z",
          arquivos: [{ caminho: "a.ts", mudanca: "alterado", binario: false, adicionadas: 1, removidas: 0, juntado: false }],
          outros: 0,
        },
      ],
    };
    expect(mensagemDaSala.safeParse(msg).success).toBe(true);
  });

  it("o conector avisa o arquivo grande demais", () => {
    expect(mensagemDoConector.safeParse({ v: 1, tipo: "ignorado", caminho: "video.mp4", motivo: "grande_demais", tamanho: 5_000_000 }).success).toBe(true);
  });
});

describe("resumoDaDiferenca com custo limitado (gate da 3.4, PERF-001)", () => {
  it("muitas linhas repetidas: responde rápido, e null acima do teto de mudanças", () => {
    const antes = Array(2500).fill("x").join("\n");
    const depois = Array.from({ length: 2500 }, (_, i) => (i % 2 ? "y" : "x")).join("\n");
    const inicio = performance.now();
    expect(resumoDaDiferenca(antes, depois)).toBeNull();
    expect(performance.now() - inicio).toBeLessThan(200);
  });

  it("dentro do teto, a contagem é exata", () => {
    const antes = Array.from({ length: 900 }, (_, i) => `l${i % 7}`).join("\n");
    const depois = Array.from({ length: 900 }, (_, i) => (i % 3 ? `l${i % 7}` : "novo")).join("\n");
    expect(resumoDaDiferenca(antes, depois)).toEqual({ adicionadas: 300, removidas: 300 });
  });
});
