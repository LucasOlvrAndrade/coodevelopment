import { TAMANHO_MAXIMO, caminhoSincronizavel } from "@coodevelopment/protocolo";
import type { Ambiente } from "./ambiente";

// O que pode sair deste PC (Story 3.3, FR17, D11): fora do que o .gitignore
// ignora, fora da lista fixa do protocolo e até 1 MB (A14).

export { TAMANHO_MAXIMO };

// Os ignorados pelo .gitignore, numa chamada só do git para o lote todo.
// Arquivo rastreado pelo git nunca conta como ignorado, mesmo que um padrão
// do .gitignore case com ele: ele é do projeto.
export async function ignoradosPeloGit(amb: Ambiente, raiz: string, caminhos: string[]): Promise<Set<string>> {
  if (caminhos.length === 0) return new Set();
  const r = await amb.rodar("git", ["check-ignore", "--stdin"], { cwd: raiz, entrada: caminhos.join("\n") + "\n" });
  // 0: algum ignorado; 1: nenhum; outro: o git falhou. Aí quem chamou tenta
  // de novo: sumir em silêncio perderia a mudança.
  if (r.codigo === 1) return new Set();
  if (r.codigo !== 0) throw new Error(`git check-ignore falhou (${r.codigo}): ${r.erro.trim().split("\n")[0] ?? ""}`);
  return new Set(r.saida.split(/\r?\n/).filter(Boolean).map((c) => c.replace(/\\/g, "/")));
}

export function podeCircular(caminho: string): boolean {
  return caminhoSincronizavel(caminho).ok;
}

// O arquivo no baseSha: base do merge na primeira escrita e referência para
// saber se a pasta mudou o arquivo. conteudo é null quando é binário; existe
// é false quando o arquivo não existia (ou o commit não está na pasta).
export async function arquivoNaBase(amb: Ambiente, raiz: string, baseSha: string, caminho: string): Promise<{ existe: boolean; conteudo: string | null }> {
  const r = await amb.rodar("git", ["show", `${baseSha}:${caminho}`], { cwd: raiz });
  // "does not exist in" (ou "exists on disk, but not in"): o arquivo não
  // existia no baseSha. Outra falha do git não pode virar "não existia".
  if (r.codigo !== 0 && /does not exist in|exists on disk, but not in|invalid object name/i.test(r.erro)) return { existe: false, conteudo: null };
  if (r.codigo !== 0) throw new Error(`git show falhou (${r.codigo}): ${r.erro.trim().split("\n")[0] ?? ""}`);
  return { existe: true, conteudo: r.saida.includes("\u0000") ? null : r.saida };
}

// Final de linha de arquivo novo, como o git da pasta faria (NFR7).
export async function crlfPorPadrao(amb: Ambiente, raiz: string): Promise<boolean> {
  const r = await amb.rodar("git", ["config", "--get", "core.autocrlf"], { cwd: raiz });
  return r.codigo === 0 && r.saida.trim().toLowerCase() === "true";
}
