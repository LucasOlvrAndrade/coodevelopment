import "server-only";
import { Octokit } from "@octokit/rest";
import { and, eq } from "drizzle-orm";
import { auth } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { account } from "@/servidor/db/schema";
import type { GithubRepositorios } from "@/servidor/dominio/jam";
import { POR_PAGINA, type GithubMutuos } from "@/servidor/dominio/sugestoes";
import { ErroApp } from "@/servidor/erros";

// Uma busca de token por usuário de cada vez nesta instância: duas chamadas
// simultâneas com o token vencido não podem gastar o refresh token duas vezes
// (o GitHub invalida o refresh usado).
const buscasEmAndamento = new Map<string, Promise<string>>();

async function buscarToken(usuarioId: string): Promise<string> {
  const [conta] = await db()
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, usuarioId), eq(account.providerId, "github")))
    .limit(1);
  if (!conta) throw new ErroApp("sem_conta_github", 401);
  const pedir = () => auth().api.getAccessToken({ body: { accountId: conta.id, userId: usuarioId } });
  // O Better Auth renova o token quando falta menos de 5 s para vencer (8 h no
  // GitHub App). Se a renovação falhar, tenta uma segunda vez: outra instância
  // pode ter acabado de renovar e gastado o refresh, e aí a segunda leitura já
  // acha o token novo no banco. Falhou de novo, o refresh morreu (revogado ou
  // 6 meses): a pessoa precisa entrar outra vez.
  const resultado = await pedir().catch(() => pedir().catch(() => null));
  if (!resultado?.accessToken) throw new ErroApp("reautenticar", 401);
  const venceEm = resultado.accessTokenExpiresAt?.getTime();
  if (venceEm !== undefined && venceEm <= Date.now()) throw new ErroApp("reautenticar", 401);
  return resultado.accessToken;
}

export function tokenDoUsuario(usuarioId: string): Promise<string> {
  let busca = buscasEmAndamento.get(usuarioId);
  if (!busca) {
    busca = buscarToken(usuarioId).finally(() => buscasEmAndamento.delete(usuarioId));
    buscasEmAndamento.set(usuarioId, busca);
  }
  return busca;
}

// Cliente do GitHub em nome do usuário; o token é obtido (e renovado se
// preciso) antes de cada chamada. O token nunca sai deste módulo (NFR8).
export function githubDoUsuario(usuarioId: string): Octokit {
  const octokit = new Octokit({ userAgent: "coodevelopment" });
  octokit.hook.before("request", async (opcoes) => {
    opcoes.headers.authorization = `token ${await tokenDoUsuario(usuarioId)}`;
  });
  return octokit;
}

// O app está instalado na conta pessoal do usuário? (decisão A7)
export async function appInstaladoNaConta(usuarioId: string, githubId: number): Promise<boolean> {
  const { data } = await githubDoUsuario(usuarioId).rest.apps.listInstallationsForAuthenticatedUser({ per_page: 100 });
  return data.installations.some((i) => i.account?.id === githubId);
}

// Seguidores e seguidos de quem está logado, para as sugestões de mútuos
// (Story 1.4). A conferência um a um responde 204 (sim) ou 404 (não).
export function githubMutuos(octokit: Octokit): GithubMutuos {
  async function sim(chamada: Promise<unknown>) {
    try {
      await chamada;
      return true;
    } catch (e) {
      if ((e as { status?: number }).status === 404) return false;
      throw e;
    }
  }
  return {
    async contagens() {
      const { data } = await octokit.rest.users.getAuthenticated();
      return { login: data.login, seguidores: data.followers, seguindo: data.following };
    },
    async listar(lista, pagina) {
      const opcoes = { per_page: POR_PAGINA, page: pagina };
      const { data } =
        lista === "seguindo"
          ? await octokit.rest.users.listFollowedByAuthenticatedUser(opcoes)
          : await octokit.rest.users.listFollowersForAuthenticatedUser(opcoes);
      return data.map((u) => ({ id: u.id, login: u.login }));
    },
    sigo: (login) => sim(octokit.rest.users.checkPersonIsFollowedByAuthenticated({ username: login })),
    meSegue: (login, meuLogin) => sim(octokit.rest.users.checkFollowingForUser({ username: login, target_user: meuLogin })),
  };
}

// Repositórios da conta para a nova jam (Story 2.1). Com o token do GitHub
// App, o GitHub só devolve o que a instalação alcança.
export function githubRepositorios(octokit: Octokit): GithubRepositorios {
  async function ouNulo<T>(chamada: Promise<T>, statusSemResultado: number[]) {
    try {
      return await chamada;
    } catch (e) {
      if (statusSemResultado.includes((e as { status?: number }).status ?? 0)) return null;
      throw e;
    }
  }
  return {
    async listar(pagina) {
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        affiliation: "owner",
        sort: "pushed",
        direction: "desc",
        per_page: 100,
        page: pagina,
      });
      return data.map((r) => ({
        owner: r.owner.login,
        nome: r.name,
        privado: r.private,
        descricao: r.description,
        atualizadoEm: r.pushed_at ?? null,
      }));
    },
    async buscar(owner, nome) {
      const resposta = await ouNulo(octokit.rest.repos.get({ owner, repo: nome }), [404]);
      if (!resposta) return null;
      const { data } = resposta;
      return { id: data.id, owner: data.owner.login, ownerId: data.owner.id, nome: data.name, branchPadrao: data.default_branch };
    },
    async shaDaBranch(owner, nome, branch) {
      // Repositório vazio responde 409; branch que não existe, 404.
      const resposta = await ouNulo(octokit.rest.git.getRef({ owner, repo: nome, ref: `heads/${branch}` }), [404, 409]);
      return resposta?.data.object.sha ?? null;
    },
    async criar(nome, privado) {
      try {
        const { data } = await octokit.rest.repos.createForAuthenticatedUser({ name: nome, private: privado, auto_init: true });
        return { id: data.id, owner: data.owner.login, ownerId: data.owner.id, nome: data.name, branchPadrao: data.default_branch ?? "main" };
      } catch (e) {
        const erro = e as { status?: number; response?: { data?: { errors?: { message?: string }[] } } };
        if (erro.status === 422) {
          const motivos = (erro.response?.data?.errors ?? []).map((x) => x.message ?? "").join(" ");
          throw new ErroApp(/already exists/i.test(motivos) ? "repositorio_ja_existe" : "nome_repositorio_invalido", 422);
        }
        throw e;
      }
    },
    async instalacao(githubId) {
      const { data } = await octokit.rest.apps.listInstallationsForAuthenticatedUser({ per_page: 100 });
      const daConta = data.installations.find((i) => i.account?.id === githubId);
      return daConta ? { id: daConta.id, selecao: daConta.repository_selection } : { id: null, selecao: null };
    },
  };
}
