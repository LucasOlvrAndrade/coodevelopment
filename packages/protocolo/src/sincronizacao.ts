import { diff3Merge } from "node-diff3";
import { z } from "zod";
import { normalizarCaminho, normalizarFinalDeLinha } from "./normalizacao";

// Sincronização de arquivos entre os conectores e a sala (Story 3.3). O
// conteúdo vai como texto (com o final de linha do autor) ou, para binário,
// em base64. O hash é do texto com LF (NFR7) ou dos bytes do binário.

// Linha do SQLite do Durable Object: até 2 MB; com 1 MB por arquivo, mesmo em
// base64 (1,33 MB) cabe numa linha só (decisão A14).
export const TAMANHO_MAXIMO = 1024 * 1024;

// O que nunca vai, mesmo que o .gitignore do projeto esqueça (FR17, FR18, D11).
const PASTAS_PROIBIDAS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", ".next"]);

export type MotivoProibido = "caminho_invalido" | "proibido";

// Prefixo dos temporários que o conector grava antes do rename; nunca circulam.
export const PREFIXO_TEMPORARIO = ".coodevelopment-";

// Partes de caminho que o Windows lê de outro jeito, e que por isso podiam
// chegar a uma pasta proibida por outro nome (gate da 3.3, SEC-001):
// - "~" e dígito: nome curto 8.3 do NTFS ("GIT~1" é a pasta .git);
// - ":": fluxo alternativo do NTFS (".git::$INDEX_ALLOCATION") ou unidade;
// - ponto ou espaço no fim: o Windows ignora (".git." é ".git");
// - nomes reservados (CON, NUL, AUX, COM1...), com ou sem extensão;
// - caracteres que o Windows não aceita em nome.
const NOME_CURTO = /~\d/;
const CARACTERE_PROIBIDO = /[<>:"|?*\u0000-\u001f]/;
const RESERVADO = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

function parteValida(parte: string): boolean {
  return !NOME_CURTO.test(parte) && !CARACTERE_PROIBIDO.test(parte) && !/[. ]$/.test(parte) && !RESERVADO.test(parte) && !parte.startsWith(PREFIXO_TEMPORARIO);
}

// Caminho que pode circular: normalizado (relativo, com "/", sem sair da
// raiz) e fora da lista fixa. Devolve o caminho normalizado ou o motivo.
export function caminhoSincronizavel(caminho: string): { ok: true; caminho: string } | { ok: false; motivo: MotivoProibido } {
  const normal = normalizarCaminho(caminho);
  if (!normal) return { ok: false, motivo: "caminho_invalido" };
  const partes = normal.split("/");
  if (!partes.every(parteValida)) return { ok: false, motivo: "caminho_invalido" };
  // No Windows, ".GIT" e ".git" são a mesma pasta.
  if (partes.some((p) => PASTAS_PROIBIDAS.has(p.toLowerCase()))) return { ok: false, motivo: "proibido" };
  const nome = partes.at(-1)!.toLowerCase();
  if (nome.startsWith(".env") && nome !== ".env.example") return { ok: false, motivo: "proibido" };
  return { ok: true, caminho: normal };
}

// Merge de três vias por linha (decisão A2), com o texto em LF (NFR7), usado
// pela sala e pelo conector. Devolve null quando os trechos se cruzam
// (inclusive linhas vizinhas, como no diff3).
export function juntar(base: string, nosso: string, deles: string): string | null {
  const linhas = (t: string) => normalizarFinalDeLinha(t).split("\n");
  const blocos = diff3Merge(linhas(nosso), linhas(base), linhas(deles), { excludeFalseConflicts: true });
  const saida: string[] = [];
  for (const bloco of blocos) {
    if ("conflict" in bloco && bloco.conflict) return null;
    if ("ok" in bloco && bloco.ok) saida.push(...bloco.ok);
  }
  return saida.join("\n");
}

function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// sha256 em hex, pela WebCrypto (roda no Node, no Worker e no navegador).
export async function hashDoConteudo(conteudo: string, binario: boolean): Promise<string> {
  const bytes: Uint8Array<ArrayBuffer> = binario ? base64ParaBytes(conteudo) : new Uint8Array(new TextEncoder().encode(normalizarFinalDeLinha(conteudo)));
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Tamanho do arquivo como ele é no disco (o base64 do binário volta a bytes).
export function tamanhoDoConteudo(conteudo: string, binario: boolean): number {
  return binario ? Math.floor((conteudo.length * 3) / 4) - (conteudo.endsWith("==") ? 2 : conteudo.endsWith("=") ? 1 : 0) : new TextEncoder().encode(conteudo).length;
}

const caminho = z.string().min(1).max(1024);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const versao = z.number().int().min(0);

// Conector → sala: o arquivo como está agora, a partir da versão que ele
// conhecia. Na primeira escrita de um arquivo, o conteúdo dele no baseSha
// (conteudoBase; null quando o arquivo não existia no baseSha) permite o merge.
export const mensagemEscrever = z.object({
  v: z.literal(1),
  tipo: z.literal("escrever"),
  caminho,
  versaoBase: versao,
  hash,
  conteudo: z.string(),
  binario: z.boolean(),
  apagado: z.boolean(),
  conteudoBase: z.string().nullable().optional(),
});

// Sala → conector: um arquivo para gravar. "escrita" veio de outra pessoa;
// "merge" é o resultado de juntar duas escritas; "estado" é o que já estava
// na sala quando o conector conectou.
export const mensagemArquivo = z.object({
  v: z.literal(1),
  tipo: z.literal("arquivo"),
  caminho,
  versao,
  hash,
  conteudo: z.string(),
  binario: z.boolean(),
  apagado: z.boolean(),
  autorId: z.string(),
  origem: z.enum(["escrita", "merge", "estado"]),
});

// Sala → autor: a escrita entrou como está, nesta versão.
export const mensagemAceito = z.object({
  v: z.literal(1),
  tipo: z.literal("aceito"),
  caminho,
  versao,
  hash,
});

// Sala → autor: a escrita não entrou. No conflito, a versão do autor foi
// guardada no histórico e o arquivo atual chega logo depois numa mensagem
// "arquivo".
export const mensagemRecusado = z.object({
  v: z.literal(1),
  tipo: z.literal("recusado"),
  caminho,
  motivo: z.enum(["conflito_guardado", "caminho_invalido", "proibido", "grande_demais", "erro"]),
});

// Sala → conector, ao conectar: o que mudou desde o baseSha. Os arquivos
// chegam em seguida, um por mensagem.
export const mensagemManifesto = z.object({
  v: z.literal(1),
  tipo: z.literal("manifesto"),
  arquivos: z.array(z.object({ caminho, versao, hash, apagado: z.boolean() })),
});

export type MensagemEscrever = z.infer<typeof mensagemEscrever>;
export type MensagemArquivo = z.infer<typeof mensagemArquivo>;
export type MensagemAceito = z.infer<typeof mensagemAceito>;
export type MensagemRecusado = z.infer<typeof mensagemRecusado>;
export type MensagemManifesto = z.infer<typeof mensagemManifesto>;
