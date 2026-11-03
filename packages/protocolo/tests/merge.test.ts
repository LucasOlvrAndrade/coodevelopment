import { diff3Merge, diffPatch } from "node-diff3";
import { describe, expect, it } from "vitest";
import { juntar } from "../src";
import { juntarLinhas, trechosDiferentes } from "../src/diferenca";

// Merge de três vias com custo limitado (Story 3.5). O node-diff3 fica só
// aqui, como referência do comportamento de antes.

function juntarComNodeDiff3(base: string[], nosso: string[], deles: string[]): string[] | null {
  const saida: string[] = [];
  for (const bloco of diff3Merge(nosso, base, deles, { excludeFalseConflicts: true })) {
    if ("conflict" in bloco && bloco.conflict) return null;
    if ("ok" in bloco && bloco.ok) saida.push(...bloco.ok);
  }
  return saida;
}

// Gerador determinístico, para o teste falhar sempre do mesmo jeito.
// (mulberry32: os bits baixos de um gerador linear simples se repetem logo.)
function sorteio(semente: number) {
  let s = semente >>> 0;
  return (n: number) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % n);
  };
}

function mexer(base: string[], aleatorio: (n: number) => number, alfabeto: number): string[] {
  const saida = [...base];
  const vezes = aleatorio(4);
  for (let i = 0; i < vezes; i++) {
    const p = aleatorio(saida.length + 1);
    const tipo = aleatorio(3);
    if (tipo === 0) saida.splice(p, 0, `n${aleatorio(alfabeto)}`);
    else if (tipo === 1 && saida.length) saida.splice(Math.min(p, saida.length - 1), 1);
    else if (saida.length) saida[Math.min(p, saida.length - 1)] = `m${aleatorio(alfabeto)}`;
  }
  return saida;
}

describe("trechosDiferentes", () => {
  it("o número de linhas acrescentadas e tiradas é o mínimo, igual ao do node-diff3", () => {
    const aleatorio = sorteio(7);
    for (let caso = 0; caso < 2000; caso++) {
      const a = Array.from({ length: aleatorio(12) }, () => `l${aleatorio(4)}`);
      const b = mexer(a, aleatorio, 4);
      const nosso = trechosDiferentes(a, b, 1000)!;
      const custo = (ts: { aInicio: number; aFim: number; bInicio: number; bFim: number }[]) => ts.reduce((s, t) => s + (t.aFim - t.aInicio) + (t.bFim - t.bInicio), 0);
      const referencia = diffPatch(a, b).reduce((s, t) => s + t.buffer1.length + t.buffer2.length, 0);
      expect(custo(nosso)).toBe(referencia);
      // Aplicar os trechos em a dá b.
      const aplicado: string[] = [];
      let p = 0;
      for (const t of nosso) {
        aplicado.push(...a.slice(p, t.aInicio), ...b.slice(t.bInicio, t.bFim));
        p = t.aFim;
      }
      aplicado.push(...a.slice(p));
      expect(aplicado).toEqual(b);
    }
  });
});

describe("juntar (Story 3.5)", () => {
  it("junta e recusa os mesmos casos que o node-diff3, com o mesmo resultado (AC 3)", () => {
    const aleatorio = sorteio(42);
    let juntados = 0;
    let recusados = 0;
    const diferentes: string[] = [];
    for (let caso = 0; caso < 5000; caso++) {
      // Linhas quase todas distintas, como em código; o node-diff3 escolhe
      // outro alinhamento quando há linhas repetidas, e aí os dois podem
      // divergir sem que nenhum esteja errado.
      const base = Array.from({ length: 3 + aleatorio(15) }, (_, i) => `b${i}`);
      const nosso = mexer(base, aleatorio, 1000);
      const deles = mexer(base, aleatorio, 1000);
      const meu = juntarLinhas(base, nosso, deles, 1000);
      const referencia = juntarComNodeDiff3(base, nosso, deles);
      if (JSON.stringify(meu) !== JSON.stringify(referencia)) diferentes.push(JSON.stringify({ base, nosso, deles, meu, referencia }));
      if (meu) juntados++;
      else recusados++;
    }
    expect(diferentes.slice(0, 3)).toEqual([]);
    // Os dois caminhos foram exercitados.
    expect(juntados).toBeGreaterThan(500);
    expect(recusados).toBeGreaterThan(500);
  });

  it("um lado só mudou: fica a mudança dele; os dois iguais: fica a mudança", () => {
    expect(juntar("a\nb\nc\n", "a\nb\nc\n", "a\nB\nc\n")).toBe("a\nB\nc\n");
    expect(juntar("a\nb\nc\n", "a\nB\nc\n", "a\nB\nc\n")).toBe("a\nB\nc\n");
  });

  it("inserção no mesmo ponto e linhas vizinhas são conflito, como no diff3", () => {
    expect(juntar("a\nb\n", "a\nX\nb\n", "a\nY\nb\n")).toBeNull();
    expect(juntar("a\nb\nc\nd\n", "a\nB\nc\nd\n", "a\nb\nC\nd\n")).toBeNull();
  });

  it("arquivo de 1 MB de linhas repetidas: responde em menos de 1 s; acima do teto vira conflito (AC 1 e 2)", () => {
    const base = Array(100_000).fill("x").join("\n");
    const nosso = Array.from({ length: 100_000 }, (_, i) => (i % 2 ? "y" : "x")).join("\n");
    const inicio = performance.now();
    expect(juntar(base, nosso, `${base}\nfim`)).toBeNull();
    expect(performance.now() - inicio).toBeLessThan(1000);
  });

  it("1 MB de linhas curtas (~520 mil) junta sem estourar a pilha (gate da 3.5, REL-001)", () => {
    const linhas = Array.from({ length: 520_000 }, (_, i) => String(i % 10));
    const nosso = ["começo", ...linhas.slice(1)];
    const deles = [...linhas.slice(0, -1), "fim"];
    const inicio = performance.now();
    expect(juntar(linhas.join("\n"), nosso.join("\n"), deles.join("\n"))).toBe(["começo", ...linhas.slice(1, -1), "fim"].join("\n"));
    expect(performance.now() - inicio).toBeLessThan(1000);
  });

  it("a mesma mudança dos dois lados, com } e linhas vazias, entra uma vez só (gate da 3.5, DATA-001)", () => {
    // As duas pastas puxaram o mesmo commit (função c); uma mexe no topo, a
    // outra no fim, e uma delas escreve com a base antiga.
    const base = ["import x", "", "function a() {", "}", "", "function b() {", "}"];
    const comC = [...base.slice(0, 4), "", "function c() {", "}", ...base.slice(4)];
    const nosso = ["import y", ...comC.slice(1)];
    const deles = [...comC, "", "// fim"];
    const r = juntarLinhas(base, nosso, deles, 1000);
    expect(r).toEqual(juntarComNodeDiff3(base, nosso, deles));
    expect(r?.filter((l) => l === "function c() {")).toHaveLength(1);
  });

  it("com linhas repetidas e alfabeto pequeno, junta e recusa como o node-diff3, sem duplicar a mudança comum (AC 3)", () => {
    const aleatorio = sorteio(99);
    const alfabeto = ["}", "", "}", "", "a", "b"];
    const diferentes: string[] = [];
    for (let caso = 0; caso < 20_000; caso++) {
      const base = Array.from({ length: aleatorio(10) }, () => alfabeto[aleatorio(alfabeto.length)]!);
      const comum = mexer(base, aleatorio, 3);
      const nosso = aleatorio(2) ? mexer(comum, aleatorio, 3) : comum;
      const deles = mexer(comum, aleatorio, 3);
      const meu = juntarLinhas(base, nosso, deles, 1000);
      if (JSON.stringify(meu) !== JSON.stringify(juntarComNodeDiff3(base, nosso, deles))) diferentes.push(JSON.stringify({ base, nosso, deles }));
    }
    expect(diferentes.slice(0, 3)).toEqual([]);
  });

  it("o pior caso do node-diff3 (2.500 linhas repetidas) não trava (gate da 3.4, PERF-003)", () => {
    const base = Array(2500).fill("x").join("\n");
    const nosso = Array.from({ length: 2500 }, (_, i) => (i % 2 ? "y" : "x")).join("\n");
    const inicio = performance.now();
    juntar(base, nosso, `${base}\nz`);
    expect(performance.now() - inicio).toBeLessThan(300);
  });
});
