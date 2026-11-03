// Diferença por linha com custo limitado (Stories 3.4 e 3.5), base do resumo
// do feed e do merge de três vias. O LCS do node-diff3 levava 9 s com linhas
// repetidas e travava o Durable Object (gates da 3.4, PERF-001 e PERF-003);
// aqui o custo é no máximo (linhas) x (teto de edições), qualquer que seja o
// conteúdo.

// Um trecho diferente: as linhas [aInicio, aFim) de a viraram [bInicio, bFim) de b.
export type Trecho = { aInicio: number; aFim: number; bInicio: number; bFim: number };

// Os trechos diferentes de a para b, em ordem, pelo algoritmo de Myers
// (O((N+M)·D)), depois de tirar o começo e o fim iguais. null quando são
// necessárias mais que `teto` linhas acrescentadas mais tiradas.
export function trechosDiferentes(a: readonly string[], b: readonly string[], teto: number): Trecho[] | null {
  let inicio = 0;
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > inicio && fimB > inicio && a[fimA - 1] === b[fimB - 1]) {
    fimA--;
    fimB--;
  }
  const n = fimA - inicio;
  const m = fimB - inicio;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0) return [{ aInicio: inicio, aFim: fimA, bInicio: inicio, bFim: fimB }];

  // Caminho mais curto pelo grafo de edição, guardando o v de cada passo
  // para refazer o caminho de trás para frente.
  const limite = Math.min(teto, n + m);
  const deslocamento = limite + 1;
  const v = new Int32Array(2 * limite + 3);
  const passos: Int32Array[] = [];
  let fim = -1;
  for (let d = 0; d <= limite && fim < 0; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[deslocamento + k - 1]! < v[deslocamento + k + 1]!) ? v[deslocamento + k + 1]! : v[deslocamento + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[inicio + x] === b[inicio + y]) {
        x++;
        y++;
      }
      v[deslocamento + k] = x;
      if (x >= n && y >= m) {
        fim = d;
        break;
      }
    }
    passos.push(v.slice(deslocamento - d - 1, deslocamento + d + 2));
  }
  if (fim < 0) return null;

  // De trás para frente: cada passo é uma linha tirada de a ou acrescentada de b.
  const edicoes: { tirada: boolean; x: number; y: number }[] = [];
  let x = n;
  let y = m;
  for (let d = fim; d > 0; d--) {
    const anterior = passos[d - 1]!;
    // anterior guarda os k de -(d-1)-1 a (d-1)+1, a partir do índice 0.
    const em = (k: number) => anterior[k + d]!;
    const k = x - y;
    const desceu = k === -d || (k !== d && em(k - 1) < em(k + 1));
    const kAnterior = desceu ? k + 1 : k - 1;
    const xAnterior = em(kAnterior);
    const yAnterior = xAnterior - kAnterior;
    edicoes.push(desceu ? { tirada: false, x: xAnterior, y: yAnterior } : { tirada: true, x: xAnterior, y: yAnterior });
    x = xAnterior;
    y = yAnterior;
  }
  edicoes.reverse();

  // Edições encostadas viram um trecho só.
  const trechos: Trecho[] = [];
  for (const e of edicoes) {
    const atual = trechos.at(-1);
    const ax = inicio + e.x;
    const by = inicio + e.y;
    if (atual && atual.aFim === ax && atual.bFim === by) {
      if (e.tirada) atual.aFim++;
      else atual.bFim++;
    } else {
      trechos.push(e.tirada ? { aInicio: ax, aFim: ax + 1, bInicio: by, bFim: by } : { aInicio: ax, aFim: ax, bInicio: by, bFim: by + 1 });
    }
  }
  return trechos;
}

type Mudanca = Trecho & { lado: 0 | 1 };

// O conteúdo de um lado numa região [de, ate) da base: as linhas da base com
// as mudanças daquele lado aplicadas.
function ladoNaRegiao(base: readonly string[], lado: readonly string[], mudancas: Mudanca[], de: number, ate: number): string[] {
  const saida: string[] = [];
  let p = de;
  for (const t of mudancas) {
    saida.push(...base.slice(p, t.aInicio), ...lado.slice(t.bInicio, t.bFim));
    p = t.aFim;
  }
  saida.push(...base.slice(p, ate));
  return saida;
}

// Merge de três vias por linha, com a regra de regiões do diff3: mudanças dos
// dois lados que se cruzam ou encostam (inclusive inserção no mesmo ponto)
// são conflito, a não ser que deem o mesmo resultado. null no conflito e
// acima do teto, que o chamador trata igual: fica o que estava e a escrita
// vai para o histórico (A2).
export function juntarLinhas(base: readonly string[], nosso: readonly string[], deles: readonly string[], teto: number): string[] | null {
  const doNosso = trechosDiferentes(base, nosso, teto);
  if (!doNosso) return null;
  const doDeles = trechosDiferentes(base, deles, teto);
  if (!doDeles) return null;
  const mudancas: Mudanca[] = [...doNosso.map((t) => ({ ...t, lado: 0 as const })), ...doDeles.map((t) => ({ ...t, lado: 1 as const }))].sort(
    (p, q) => p.aInicio - q.aInicio || p.aFim - q.aFim,
  );
  const lados = [nosso, deles] as const;
  const saida: string[] = [];
  let p = 0;
  for (let i = 0; i < mudancas.length; ) {
    const de = mudancas[i]!.aInicio;
    let ate = mudancas[i]!.aFim;
    let j = i + 1;
    while (j < mudancas.length && mudancas[j]!.aInicio <= ate) ate = Math.max(ate, mudancas[j++]!.aFim);
    const regiao = mudancas.slice(i, j);
    saida.push(...base.slice(p, de));
    const porLado = [regiao.filter((t) => t.lado === 0), regiao.filter((t) => t.lado === 1)];
    const conteudos = porLado.map((ts, l) => (ts.length ? ladoNaRegiao(base, lados[l as 0 | 1], ts, de, ate) : null));
    const [a, b] = conteudos;
    if (a && b) {
      if (a.length !== b.length || a.some((linha, n) => linha !== b[n])) return null;
      saida.push(...a);
    } else {
      saida.push(...(a ?? b)!);
    }
    p = ate;
    i = j;
  }
  saida.push(...base.slice(p));
  return saida;
}
