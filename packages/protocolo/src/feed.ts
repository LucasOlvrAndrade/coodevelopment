import { z } from "zod";
import { normalizarFinalDeLinha } from "./normalizacao";

// Feed da jam (Story 3.4, FR20): o que mudou, quem mudou e o resumo da
// diferença. A sala registra e agrupa; a página mostra.

// Arquivos de dependências pelo nome, de cada ecossistema comum: mudou um
// deles, quem está na jam provavelmente precisa reinstalar (D11).
const DEPENDENCIAS = new Set([
  // JavaScript e TypeScript
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "deno.json",
  "deno.jsonc",
  "deno.lock",
  // Python
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "pipfile",
  "pipfile.lock",
  "setup.py",
  "setup.cfg",
  "environment.yml",
  "environment.yaml",
  // Ruby, PHP, Go, Rust
  "gemfile",
  "gemfile.lock",
  "composer.json",
  "composer.lock",
  "go.mod",
  "go.sum",
  "cargo.toml",
  "cargo.lock",
  // Java, Kotlin, .NET
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "gradle.properties",
  "packages.config",
  "directory.packages.props",
  "global.json",
  // Elixir, Dart, Swift, iOS
  "mix.exs",
  "mix.lock",
  "pubspec.yaml",
  "pubspec.lock",
  "package.swift",
  "package.resolved",
  "podfile",
  "podfile.lock",
]);
const DEPENDENCIAS_POR_PADRAO = [/^requirements.*\.txt$/, /^constraints.*\.txt$/, /\.(cs|fs|vb)proj$/];

export function arquivoDeDependencias(caminho: string): boolean {
  const nome = caminho.split("/").at(-1)!.toLowerCase();
  return DEPENDENCIAS.has(nome) || DEPENDENCIAS_POR_PADRAO.some((p) => p.test(nome));
}

// Acima disso o resumo fica só "alterado": a diferença por linha custa CPU da
// sala, e um arquivo desse tamanho mudando inteiro não ganha com a contagem.
const LINHAS_PARA_COMPARAR = 5000;
const CARACTERES_PARA_COMPARAR = 200_000;
// Teto de linhas acrescentadas mais tiradas: a comparação custa no máximo
// (linhas) x (teto), qualquer que seja o conteúdo. O diff do node-diff3 levava
// 9 s com 2.500 linhas repetidas, travando o Durable Object (gate da 3.4,
// PERF-001).
const EDICOES_PARA_CONTAR = 1000;

// Menor número de linhas acrescentadas mais tiradas entre a e b (algoritmo de
// Myers, O((N+M)·D)), ou null acima do teto.
function edicoes(a: string[], b: string[], teto: number): number | null {
  const n = a.length;
  const m = b.length;
  const deslocamento = teto + 1;
  const v = new Int32Array(2 * teto + 3);
  for (let d = 0; d <= teto; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[deslocamento + k - 1]! < v[deslocamento + k + 1]!) ? v[deslocamento + k + 1]! : v[deslocamento + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[deslocamento + k] = x;
      if (x >= n && y >= m) return d;
    }
  }
  return null;
}

// O texto em linhas, sem a linha vazia depois do último "\n".
function linhas(texto: string): string[] {
  const normal = normalizarFinalDeLinha(texto);
  if (normal === "") return [];
  return (normal.endsWith("\n") ? normal.slice(0, -1) : normal).split("\n");
}

// Linhas acrescentadas e tiradas de um texto para outro, com o final de linha
// normalizado (NFR7). O começo e o fim iguais saem antes da comparação, que
// assim só olha o trecho que mudou. null quando o trecho é grande demais.
export function resumoDaDiferenca(antes: string, depois: string): { adicionadas: number; removidas: number } | null {
  const a = linhas(antes);
  const b = linhas(depois);
  let inicio = 0;
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > inicio && fimB > inicio && a[fimA - 1] === b[fimB - 1]) {
    fimA--;
    fimB--;
  }
  const meioA = a.slice(inicio, fimA);
  const meioB = b.slice(inicio, fimB);
  if (meioA.length === 0 || meioB.length === 0) return { adicionadas: meioB.length, removidas: meioA.length };
  const caracteres = meioA.reduce((s, l) => s + l.length, 0) + meioB.reduce((s, l) => s + l.length, 0);
  if (meioA.length + meioB.length > LINHAS_PARA_COMPARAR || caracteres > CARACTERES_PARA_COMPARAR) return null;
  const d = edicoes(meioA, meioB, EDICOES_PARA_CONTAR);
  if (d === null) return null;
  // As linhas que ficam são as mesmas dos dois lados: a - tiradas = b - acrescentadas.
  const sobra = meioB.length - meioA.length;
  return { adicionadas: (d + sobra) / 2, removidas: (d - sobra) / 2 };
}

const caminho = z.string().min(1).max(1024);
const contagem = z.number().int().min(0).nullable();

// Um arquivo dentro de um item do feed. As contagens somam as mudanças do
// grupo; null quando não há contagem (binário, apagado ou grande demais para
// comparar). "juntado": entrou por merge com a escrita de outra pessoa.
export const arquivoNoFeed = z.object({
  caminho,
  mudanca: z.enum(["criado", "alterado", "apagado"]),
  binario: z.boolean(),
  adicionadas: contagem,
  removidas: contagem,
  juntado: z.boolean(),
  // Chegou sem aviso ativo do autor (Story 4.2, FR19): comando de terminal,
  // edição à mão. Itens antigos não têm o campo.
  semAviso: z.boolean().optional(),
});

const comum = {
  id: z.number().int().min(1),
  autorId: z.string(),
  em: z.string(),
  atualizadoEm: z.string(),
};

// Arquivos listados por item; passou disso, as mudanças seguintes contam em
// "outros" (aproximado: um arquivo que já saiu da lista e volta conta de
// novo; gate da 3.4, DATA-001).
export const ARQUIVOS_POR_ITEM = 50;
const outros = z.number().int().min(0);

// Arquivo que ficou fora da jam por ser grande demais (A14).
export const arquivoGrande = z.object({ caminho, tamanho: z.number().int().min(0) });

export const eventoFeed = z.discriminatedUnion("tipo", [
  // O Claude do autor anunciou o que vai fazer (Story 4.2, FR13).
  z.object({ ...comum, tipo: z.literal("aviso"), resumo: z.string().max(300), arquivos: z.array(caminho).max(ARQUIVOS_POR_ITEM) }),
  // Mudanças seguidas de uma pessoa, agrupadas (AC 3).
  z.object({ ...comum, tipo: z.literal("arquivos"), arquivos: z.array(arquivoNoFeed).max(ARQUIVOS_POR_ITEM), outros }),
  // Arquivos de dependências, com o mesmo resumo: quem está na jam reinstala (AC 2).
  z.object({ ...comum, tipo: z.literal("dependencias"), arquivos: z.array(arquivoNoFeed).max(ARQUIVOS_POR_ITEM), outros }),
  // Escrita que perdeu e foi para o histórico da sala (A2, gate da 3.3
  // REL-005): "guardado" é a escrita do autor que cruzou trechos com a do
  // outroId e ficou de fora; "sobrescrito" é a versão do outroId substituída
  // pela do autor (quando um dos dois é binário, a última vence). O outroId
  // pode ser o próprio autor, com duas pastas na mesma jam.
  z.object({ ...comum, tipo: z.literal("conflito"), caminho, resolvido: z.enum(["guardado", "sobrescrito"]), outroId: z.string() }),
  // Arquivos acima do limite, que não foram para a jam (A14), agrupados como
  // os outros (gate da 3.4, SEC-001).
  z.object({ ...comum, tipo: z.literal("grande"), arquivos: z.array(arquivoGrande).max(ARQUIVOS_POR_ITEM), outros }),
  // O Claude do autor pediu para mexer num arquivo do aviso ativo de outro
  // (donoId), e a edição espera a confirmação de quem pediu (Story 4.4, FR16).
  z.object({ ...comum, tipo: z.literal("reserva"), caminho, donoId: z.string(), resumo: z.string().max(300), avisoId: z.string().optional() }),
]);

// Sala → página: itens novos ou atualizados (o mesmo id substitui o
// anterior). Ao conectar, a página recebe os últimos, do mais antigo ao mais
// novo, com "inicial".
export const mensagemFeed = z.object({
  v: z.literal(1),
  tipo: z.literal("feed"),
  eventos: z.array(eventoFeed),
  inicial: z.boolean(),
});

// Conector → sala: arquivo que ficou de fora por ser grande demais (A14).
export const mensagemIgnorado = z.object({
  v: z.literal(1),
  tipo: z.literal("ignorado"),
  caminho,
  motivo: z.literal("grande_demais"),
  tamanho: z.number().int().min(0),
});

export type ArquivoNoFeed = z.infer<typeof arquivoNoFeed>;
export type ArquivoGrande = z.infer<typeof arquivoGrande>;
export type EventoFeed = z.infer<typeof eventoFeed>;
export type MensagemFeed = z.infer<typeof mensagemFeed>;
export type MensagemIgnorado = z.infer<typeof mensagemIgnorado>;
