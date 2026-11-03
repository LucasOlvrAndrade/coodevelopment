import { diffPatch } from "node-diff3";
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
  let adicionadas = 0;
  let removidas = 0;
  for (const trecho of diffPatch(meioA, meioB)) {
    removidas += trecho.buffer1.length;
    adicionadas += trecho.buffer2.length;
  }
  return { adicionadas, removidas };
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
});

const comum = {
  id: z.number().int().min(1),
  autorId: z.string(),
  em: z.string(),
  atualizadoEm: z.string(),
};

// Arquivos guardados por item; o resto conta em "outros".
export const ARQUIVOS_POR_ITEM = 50;

export const eventoFeed = z.discriminatedUnion("tipo", [
  // Mudanças seguidas de uma pessoa, agrupadas (AC 3).
  z.object({ ...comum, tipo: z.literal("arquivos"), arquivos: z.array(arquivoNoFeed).max(ARQUIVOS_POR_ITEM), outros: z.number().int().min(0) }),
  // Arquivos de dependências: quem está na jam reinstala (AC 2).
  z.object({ ...comum, tipo: z.literal("dependencias"), caminhos: z.array(caminho).max(ARQUIVOS_POR_ITEM) }),
  // Escrita que perdeu e foi para o histórico da sala (A2, gate da 3.3
  // REL-005): "guardado" é a escrita do autor que cruzou trechos com a do
  // outroId e ficou de fora; "sobrescrito" é o binário do outroId
  // substituído pelo do autor.
  z.object({ ...comum, tipo: z.literal("conflito"), caminho, resolvido: z.enum(["guardado", "sobrescrito"]), outroId: z.string() }),
  // Arquivo acima do limite, que não foi para a jam (A14).
  z.object({ ...comum, tipo: z.literal("grande"), caminho, tamanho: z.number().int().min(0) }),
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
export type EventoFeed = z.infer<typeof eventoFeed>;
export type MensagemFeed = z.infer<typeof mensagemFeed>;
export type MensagemIgnorado = z.infer<typeof mensagemIgnorado>;
