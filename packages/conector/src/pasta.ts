import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Ambiente } from "./ambiente";

// A pasta do projeto (Story 3.1, AC 2): clonar o repositório da jam ou
// conferir que a pasta já é ele.

export type Repo = { owner: string; nome: string };

export class PastaErrada extends Error {}

// Dono e nome a partir do origin, em https ou ssh, com ou sem ".git".
export function repoDoOrigin(url: string): Repo | null {
  const lido = /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return lido ? { owner: lido[1]!, nome: lido[2]! } : null;
}

// O GitHub não diferencia maiúsculas em dono e nome.
export const mesmoRepo = (a: Repo, b: Repo) => a.owner.toLowerCase() === b.owner.toLowerCase() && a.nome.toLowerCase() === b.nome.toLowerCase();

async function git(amb: Ambiente, argumentos: string[], cwd: string, env?: Record<string, string>) {
  return amb.rodar("git", argumentos, { cwd, env });
}

export async function raizDoRepositorio(amb: Ambiente, pasta: string): Promise<string | null> {
  const r = await git(amb, ["rev-parse", "--show-toplevel"], pasta);
  return r.codigo === 0 ? r.saida.trim() : null;
}

export async function originDe(amb: Ambiente, pasta: string): Promise<Repo | null> {
  const r = await git(amb, ["remote", "get-url", "origin"], pasta);
  return r.codigo === 0 ? repoDoOrigin(r.saida) : null;
}

export async function branchAtual(amb: Ambiente, pasta: string): Promise<string | null> {
  const r = await git(amb, ["branch", "--show-current"], pasta);
  return r.codigo === 0 ? r.saida.trim() || null : null;
}

const descrever = (r: Repo) => `${r.owner}/${r.nome}`;

// Confere que a pasta é o repositório da jam. Na branch errada só avisa: a
// pessoa pode estar no meio de outra coisa, e trocar de branch é decisão dela.
export async function conferirPasta(amb: Ambiente, raiz: string, repo: Repo, branch: string): Promise<void> {
  const origin = await originDe(amb, raiz);
  if (!origin) throw new PastaErrada(`A pasta ${raiz} é um repositório git, mas sem origin no GitHub. A jam usa ${descrever(repo)}.`);
  if (!mesmoRepo(origin, repo)) {
    throw new PastaErrada(`A pasta ${raiz} é do repositório ${descrever(origin)}, mas a jam usa ${descrever(repo)}. Rode o comando numa pasta vazia ou na pasta desse repositório.`);
  }
  const atual = await branchAtual(amb, raiz);
  if (atual && atual !== branch) amb.escrever(`Atenção: esta pasta está na branch ${atual}, e a jam usa ${branch}.`);
}

async function vazia(pasta: string): Promise<boolean | null> {
  const itens = await readdir(pasta).catch(() => null);
  return itens === null ? null : itens.length === 0;
}

// Onde clonar: a pasta atual se estiver vazia; senão, uma subpasta com o nome
// do repositório (que pode já ser o clone de uma vez anterior).
export async function destinoDoClone(amb: Ambiente, repo: Repo): Promise<{ pasta: string; existe: boolean }> {
  if (await vazia(amb.cwd)) return { pasta: amb.cwd, existe: false };
  const sub = join(amb.cwd, repo.nome);
  const estado = await vazia(sub);
  return { pasta: sub, existe: estado === false };
}

// O git 2.31 trouxe o GIT_CONFIG_* que leva o token sem linha de comando.
export const GIT_MINIMO = [2, 31] as const;

export function versaoDoGit(saida: string): [number, number] | null {
  const lido = /git version (\d+)\.(\d+)/.exec(saida);
  return lido ? [Number(lido[1]), Number(lido[2])] : null;
}

export const gitNovoOBastante = ([maior, menor]: [number, number]) => maior > GIT_MINIMO[0] || (maior === GIT_MINIMO[0] && menor >= GIT_MINIMO[1]);

// O token de leitura vai para o git só por variáveis de ambiente
// (GIT_CONFIG_*, git 2.31+): não aparece na linha de comando nem fica no
// .git/config. O origin gravado é a URL limpa. Sem gerenciador de
// credenciais e sem janela: se o token for recusado, o clone falha em vez de
// o Windows abrir um login do GitHub (gate da 3.1, REL-007).
export async function clonar(amb: Ambiente, repo: Repo, branch: string, pasta: string, token: string): Promise<void> {
  const versao = versaoDoGit((await git(amb, ["--version"], amb.cwd)).saida);
  if (versao && !gitNovoOBastante(versao)) {
    throw new PastaErrada(`O conector precisa do git ${GIT_MINIMO.join(".")} ou mais novo (este é o ${versao.join(".")}). Atualize pelo git-scm.com.`);
  }
  const basico = Buffer.from(`x-access-token:${token}`).toString("base64");
  const r = await git(amb, ["clone", "--branch", branch, "--", `https://github.com/${repo.owner}/${repo.nome}.git`, pasta], amb.cwd, {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraHeader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${basico}`,
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
  });
  // Clonou ou não, o token não serve para mais nada: revogado na hora, em vez
  // de valer a hora inteira. Se a revogação falhar, ele vence sozinho.
  await amb
    .fetch("https://api.github.com/installation/token", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "coodevelopment" },
    })
    .catch(() => {});
  if (r.codigo !== 0) throw new Error(`O git clone falhou: ${r.erro.trim().split("\n").at(-1) ?? r.codigo}`);
}
