import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { jam, participante, user } from "@/servidor/db/schema";
import { ErroApp } from "@/servidor/erros";
import type { Banco, Pessoa } from "./amizade";

// Regras de jam (Story 2.1). O GitHub entra por uma interface pequena, para
// testar sem rede; o adaptador do Octokit fica em servidor/github.ts.

export type Repositorio = {
  owner: string;
  nome: string;
  privado: boolean;
  descricao: string | null;
  atualizadoEm: string | null;
};

export interface GithubRepositorios {
  // Só os repositórios cujo dono é a conta (D4), do push mais recente ao mais antigo.
  listar(pagina: number): Promise<Repositorio[]>;
  // null quando o repositório não existe ou o app não alcança.
  buscar(owner: string, nome: string): Promise<{ owner: string; ownerId: number; nome: string; branchPadrao: string } | null>;
  // null quando o repositório está vazio (sem commit na branch).
  shaDaBranch(owner: string, nome: string, branch: string): Promise<string | null>;
}

export type JamDoInicio = {
  id: string;
  nome: string;
  repoOwner: string;
  repoNome: string;
  estado: "aberta" | "fechando" | "fechada";
  participantes: (Pessoa & { papel: "criador" | "convidado" })[];
};

const POR_PAGINA = 100;
const MAX_PAGINAS = 10;

export async function listarRepositorios(github: GithubRepositorios): Promise<Repositorio[]> {
  const todos: Repositorio[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const repositorios = await github.listar(pagina);
    todos.push(...repositorios);
    if (repositorios.length < POR_PAGINA) break;
  }
  return todos;
}

// Id curto e legível, usado no comando do conector (Story 3.1): "k7m2-rbq9",
// sem caracteres que se confundem (0 e o, 1, l e i).
const ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz";

export function gerarIdJam(): string {
  const letras = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${letras.slice(0, 4)}-${letras.slice(4)}`;
}

// Violação de unique do Postgres, venha do neon-http, do PGlite ou embrulhada pelo Drizzle.
function violacaoUnica(e: unknown): string | null {
  for (let atual = e as { code?: string; constraint?: string; cause?: unknown } | undefined; atual; atual = atual.cause as typeof atual) {
    if (atual.code === "23505") return atual.constraint ?? "";
  }
  return null;
}

export async function criarJam(
  banco: Banco,
  eu: { id: string; githubId: number },
  github: GithubRepositorios,
  escolha: { owner: string; repo: string },
): Promise<{ id: string }> {
  // O nome vindo do navegador nunca basta: o GitHub confirma que o repositório
  // existe, que o app o alcança e que o dono é a conta de quem cria (D4).
  const repositorio = await github.buscar(escolha.owner, escolha.repo);
  if (!repositorio) throw new ErroApp("repositorio_nao_encontrado", 404);
  if (repositorio.ownerId !== eu.githubId) throw new ErroApp("repositorio_de_outra_conta", 403);

  const [aberta] = await banco
    .select({ id: jam.id })
    .from(jam)
    .where(
      and(
        sql`lower(${jam.repoOwner}) = lower(${repositorio.owner})`,
        sql`lower(${jam.repoNome}) = lower(${repositorio.nome})`,
        sql`${jam.estado} <> 'fechada'`,
      ),
    )
    .limit(1);
  if (aberta) throw new ErroApp("jam_ja_existe", 409);

  const baseSha = await github.shaDaBranch(repositorio.owner, repositorio.nome, repositorio.branchPadrao);
  if (!baseSha) throw new ErroApp("repositorio_vazio");

  // Jam e participante criador numa instrução só (A9). Id repetido tenta outro;
  // jam aberta criada ao mesmo tempo no mesmo repositório cai no índice (A11).
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const id = gerarIdJam();
    try {
      await banco.execute(sql`
        with nova as (
          insert into ${jam} (id, nome, repo_owner, repo_nome, branch, criador_id, base_sha)
          values (${id}, ${repositorio.nome}, ${repositorio.owner}, ${repositorio.nome}, ${repositorio.branchPadrao}, ${eu.id}, ${baseSha})
          returning id
        )
        insert into ${participante} (jam_id, usuario_id, papel, colaborador)
        select id, ${eu.id}, 'criador', 'ok' from nova
      `);
      return { id };
    } catch (e) {
      const restricao = violacaoUnica(e);
      if (restricao === "jam_repo_aberta") throw new ErroApp("jam_ja_existe", 409);
      if (restricao !== "jam_pkey") throw e;
    }
  }
  throw new ErroApp("inesperado", 500);
}

// Jams de que a pessoa participa (FR7): abertas primeiro, depois as fechadas.
export async function listarJams(banco: Banco, eu: string): Promise<JamDoInicio[]> {
  const minhas = await banco
    .select({ id: jam.id, nome: jam.nome, repoOwner: jam.repoOwner, repoNome: jam.repoNome, estado: jam.estado })
    .from(jam)
    .innerJoin(participante, and(eq(participante.jamId, jam.id), eq(participante.usuarioId, eu)))
    .orderBy(sql`case when ${jam.estado} = 'fechada' then 1 else 0 end`, desc(jam.criadaEm));
  if (minhas.length === 0) return [];

  const pessoas = await banco
    .select({ jamId: participante.jamId, papel: participante.papel, id: user.id, login: user.login, nome: user.name, foto: user.image })
    .from(participante)
    .innerJoin(user, eq(user.id, participante.usuarioId))
    .where(inArray(participante.jamId, minhas.map((j) => j.id)))
    .orderBy(asc(participante.entrouEm));
  return minhas.map((j) => ({
    ...j,
    participantes: pessoas
      .filter((p) => p.jamId === j.id)
      .map(({ papel, id, login, nome, foto }) => ({ papel, id, login, nome, foto })),
  }));
}
