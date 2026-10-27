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
  buscar(owner: string, nome: string): Promise<RepositorioDoGithub | null>;
  // null quando o repositório está vazio (sem commit na branch).
  shaDaBranch(owner: string, nome: string, branch: string): Promise<string | null>;
  // Repositório novo na conta, com commit inicial (Story 2.2). Nome repetido
  // lança ErroApp("repositorio_ja_existe").
  criar(nome: string, privado: boolean): Promise<RepositorioDoGithub>;
  // A instalação do app na conta da pessoa: "all" cobre repositório criado depois.
  instalacao(githubId: number): Promise<{ id: number | null; selecao: "all" | "selected" | null }>;
}

// id é o número do repositório no GitHub: não muda quando dono ou nome mudam.
type RepositorioDoGithub = { id: number; owner: string; ownerId: number; nome: string; branchPadrao: string };

export type JamDoInicio = {
  id: string;
  nome: string;
  repoOwner: string;
  repoNome: string;
  estado: "aberta" | "fechando" | "fechada";
  criadorId: string;
  participantes: (Pessoa & { papel: "criador" | "convidado"; colaborador: "ok" | "pendente" | "falhou" })[];
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

// O app precisa da instalação com "All repositories": com "Only select
// repositories", um repositório fora da seleção ou criado depois ficaria fora
// do alcance (o convite e o commit falhariam). Gates da 1.2 e da 2.1 (SEC-001).
async function exigirInstalacaoCompleta(github: GithubRepositorios, githubId: number) {
  const instalacao = await github.instalacao(githubId);
  if (instalacao.selecao === null) throw new ErroApp("instalacao_ausente", 409);
  if (instalacao.selecao !== "all") {
    throw new ErroApp(
      "instalacao_parcial",
      409,
      `No GitHub, o Coodevelopment está liberado só para alguns repositórios, e a jam precisa dele em todos. Mude para "All repositories" em https://github.com/settings/installations/${instalacao.id} e tente de novo.`,
    );
  }
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
  await exigirInstalacaoCompleta(github, eu.githubId);

  const [aberta] = await banco
    .select({ id: jam.id })
    .from(jam)
    .where(and(eq(jam.repoId, repositorio.id), sql`${jam.estado} <> 'fechada'`))
    .limit(1);
  if (aberta) throw new ErroApp("jam_ja_existe", 409);

  const baseSha = await github.shaDaBranch(repositorio.owner, repositorio.nome, repositorio.branchPadrao);
  if (!baseSha) throw new ErroApp("repositorio_vazio");

  return gravarJam(banco, eu, repositorio, baseSha);
}

// Jam e participante criador numa instrução só (A9). Id repetido tenta outro;
// jam aberta criada ao mesmo tempo no mesmo repositório cai no índice (A11).
async function gravarJam(banco: Banco, eu: { id: string }, repositorio: RepositorioDoGithub, baseSha: string): Promise<{ id: string }> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const id = gerarIdJam();
    try {
      await banco.execute(sql`
        with nova as (
          insert into ${jam} (id, nome, repo_id, repo_owner, repo_nome, branch, criador_id, base_sha)
          values (${id}, ${repositorio.nome}, ${repositorio.id}, ${repositorio.owner}, ${repositorio.nome}, ${repositorio.branchPadrao}, ${eu.id}, ${baseSha})
          returning id
        )
        insert into ${participante} (jam_id, usuario_id, papel, colaborador, vaga)
        select id, ${eu.id}, 'criador', 'ok', 1 from nova
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
    .select({ id: jam.id, nome: jam.nome, repoOwner: jam.repoOwner, repoNome: jam.repoNome, estado: jam.estado, criadorId: jam.criadorId })
    .from(jam)
    .innerJoin(participante, and(eq(participante.jamId, jam.id), eq(participante.usuarioId, eu)))
    .orderBy(sql`case when ${jam.estado} = 'fechada' then 1 else 0 end`, desc(jam.criadaEm));
  if (minhas.length === 0) return [];

  const pessoas = await banco
    .select({
      jamId: participante.jamId,
      papel: participante.papel,
      colaborador: participante.colaborador,
      id: user.id,
      login: user.login,
      nome: user.name,
      foto: user.image,
    })
    .from(participante)
    .innerJoin(user, eq(user.id, participante.usuarioId))
    .where(inArray(participante.jamId, minhas.map((j) => j.id)))
    .orderBy(asc(participante.entrouEm));
  return minhas.map((j) => ({
    ...j,
    participantes: pessoas
      .filter((p) => p.jamId === j.id)
      .map(({ papel, colaborador, id, login, nome, foto }) => ({ papel, colaborador, id, login, nome, foto })),
  }));
}

// Nome de repositório como o GitHub aceita: até 100 caracteres de letras,
// números, ponto, hífen e sublinhado, e não pode ser "." nem "..".
export function nomeDeRepositorioValido(nome: string): boolean {
  return /^[\w.-]{1,100}$/.test(nome) && nome !== "." && nome !== "..";
}

const pausa = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

// Story 2.2: cria o repositório na conta de quem cria (D4) e a jam ligada a ele.
export async function criarJamComRepositorioNovo(
  banco: Banco,
  eu: { id: string; githubId: number },
  github: GithubRepositorios,
  novo: { nome: string; privado: boolean },
  esperar: (ms: number) => Promise<void> = pausa,
): Promise<{ id: string }> {
  if (!nomeDeRepositorioValido(novo.nome)) throw new ErroApp("nome_repositorio_invalido");

  // Com "Only select repositories", o repositório novo ficaria fora do alcance
  // do app (pendência 2 da Story 1.2): confere antes de criar qualquer coisa.
  await exigirInstalacaoCompleta(github, eu.githubId);

  const repositorio = await github.criar(novo.nome, novo.privado);

  // O commit inicial do auto_init pode levar uns instantes para aparecer.
  let baseSha: string | null = null;
  for (let tentativa = 0; tentativa < 5 && !baseSha; tentativa++) {
    if (tentativa > 0) await esperar(400 * tentativa);
    baseSha = await github.shaDaBranch(repositorio.owner, repositorio.nome, repositorio.branchPadrao).catch(() => null);
  }

  // Daqui em diante o repositório já existe no GitHub: nada é apagado lá, e a
  // pessoa é mandada importar (nada fica pela metade sem explicação).
  try {
    if (!baseSha) throw new Error("o commit inicial do repositório novo não apareceu");
    return await gravarJam(banco, eu, repositorio, baseSha);
  } catch (e) {
    if (e instanceof ErroApp) throw e;
    console.error(JSON.stringify({ nivel: "erro", evento: "repositorio_criado_sem_jam", erro: String(e) }));
    throw new ErroApp(
      "repositorio_criado_sem_jam",
      500,
      `O repositório ${repositorio.owner}/${repositorio.nome} foi criado no GitHub, mas a jam não. Importe-o em "Importar repositório" para criar a jam.`,
    );
  }
}
