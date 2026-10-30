import { randomBytes } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { caminhoSincronizavel, hashDoConteudo, normalizarFinalDeLinha } from "@coodevelopment/protocolo";

// Leitura e gravação dos arquivos da pasta (Story 3.3). É o ponto mais
// sensível do conector: grava no disco de outra pessoa o que chega da sala.
// Por isso o caminho é conferido contra a raiz, link simbólico nunca é
// seguido, e a gravação é atômica (arquivo temporário e rename).

// Prefixo dos temporários da gravação; o vigia os ignora.
export const PREFIXO_TEMPORARIO = ".coodevelopment-";

export type Local =
  | { existe: false; apagado: true; hash: string }
  | { existe: true; apagado: false; conteudo: string; binario: boolean; hash: string; tamanho: number };

// Binário: byte nulo nos primeiros 8 KB, como o git faz.
export function ehBinario(bytes: Buffer): boolean {
  return bytes.subarray(0, 8192).includes(0);
}

const HASH_DO_APAGADO = hashDoConteudo("", false);

// O caminho absoluto de um caminho do protocolo, se ele pode ser lido ou
// gravado: dentro da raiz, fora da lista fixa, sem link simbólico no caminho.
export async function caminhoSeguro(raiz: string, caminho: string): Promise<string | null> {
  const permitido = caminhoSincronizavel(caminho);
  if (!permitido.ok) return null;
  const raizReal = await realpath(raiz);
  const alvo = resolve(raizReal, ...permitido.caminho.split("/"));
  const rel = relative(raizReal, alvo);
  if (!rel || rel.startsWith("..") || resolve(raizReal, rel) !== alvo) return null;
  // Nenhuma parte do caminho que já existe pode ser link simbólico (FR18).
  let atual = raizReal;
  for (const parte of rel.split(sep)) {
    atual = join(atual, parte);
    const info = await lstat(atual).catch(() => null);
    if (!info) break;
    if (info.isSymbolicLink()) return null;
  }
  return alvo;
}

export async function lerLocal(raiz: string, caminho: string): Promise<Local | null> {
  const alvo = await caminhoSeguro(raiz, caminho);
  if (!alvo) return null;
  const info = await lstat(alvo).catch(() => null);
  if (!info) return { existe: false, apagado: true, hash: await HASH_DO_APAGADO };
  if (!info.isFile()) return null;
  const bytes = await readFile(alvo);
  const binario = ehBinario(bytes);
  const conteudo = binario ? bytes.toString("base64") : bytes.toString("utf8");
  return { existe: true, apagado: false, conteudo, binario, hash: await hashDoConteudo(conteudo, binario), tamanho: bytes.length };
}

// Final de linha ao gravar texto (NFR7): o que o arquivo já tinha; arquivo
// novo, o padrão da pasta (core.autocrlf do git).
export function comFinalDeLinha(texto: string, crlf: boolean): string {
  const lf = normalizarFinalDeLinha(texto);
  return crlf ? lf.replace(/\n/g, "\r\n") : lf;
}

// No Windows, trocar um arquivo que outro processo está lendo naquele
// instante (editor, antivírus, indexador) falha com EPERM, EACCES ou EBUSY.
// Tenta de novo por uns 2 s, como as bibliotecas de arquivo fazem.
async function renomearComPaciencia(de: string, para: string): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      await rename(de, para);
      return;
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code ?? "";
      if (tentativa >= 12 || !["EPERM", "EACCES", "EBUSY"].includes(codigo)) throw e;
      await new Promise((r) => setTimeout(r, Math.min(20 * 2 ** tentativa, 400)));
    }
  }
}

export async function gravarNoDisco(
  raiz: string,
  caminho: string,
  arquivo: { conteudo: string; binario: boolean; apagado: boolean },
  crlfNovo: boolean,
): Promise<boolean> {
  const alvo = await caminhoSeguro(raiz, caminho);
  if (!alvo) return false;
  if (arquivo.apagado) {
    await rm(alvo, { force: true });
    return true;
  }
  let bytes: Buffer;
  if (arquivo.binario) {
    bytes = Buffer.from(arquivo.conteudo, "base64");
  } else {
    const atual = await readFile(alvo).catch(() => null);
    const crlf = atual && !ehBinario(atual) ? atual.includes("\r\n") : crlfNovo;
    bytes = Buffer.from(comFinalDeLinha(arquivo.conteudo, crlf), "utf8");
  }
  await mkdir(dirname(alvo), { recursive: true });
  // Depois de criar as pastas, confere de novo: nenhuma virou link no meio.
  if ((await caminhoSeguro(raiz, caminho)) !== alvo) return false;
  const temporario = join(dirname(alvo), `${PREFIXO_TEMPORARIO}${randomBytes(6).toString("hex")}.tmp`);
  await writeFile(temporario, bytes);
  try {
    await renomearComPaciencia(temporario, alvo);
  } catch (e) {
    await rm(temporario, { force: true });
    throw e;
  }
  return true;
}
