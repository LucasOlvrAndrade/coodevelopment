import "server-only";
import { Octokit } from "@octokit/rest";
import { and, eq } from "drizzle-orm";
import { auth } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { account } from "@/servidor/db/schema";
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
  // O Better Auth renova o token quando falta menos de 5 s para vencer (8 h no GitHub App).
  const { accessToken } = await auth().api.getAccessToken({
    body: { accountId: conta.id, userId: usuarioId },
  });
  if (!accessToken) throw new ErroApp("sem_conta_github", 401);
  return accessToken;
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
