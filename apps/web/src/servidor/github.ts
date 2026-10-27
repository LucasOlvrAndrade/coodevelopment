import "server-only";
import { Octokit } from "@octokit/rest";
import { and, eq } from "drizzle-orm";
import { auth } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { account } from "@/servidor/db/schema";
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
