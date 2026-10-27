import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { db } from "@/servidor/db";
import * as schema from "@/servidor/db/schema";
import { env } from "@/servidor/env";
import { ErroApp } from "@/servidor/erros";

// Perfil do GitHub (GET /user) com os campos que o app guarda. A API devolve
// `id` numérico; o tipo do Better Auth o declara como texto.
export type PerfilGithub = { id: number | string; login: string };

// Campos extras do usuário (FR1, D19); nome e foto o Better Auth já preenche
// com `name || login` e `avatar_url`.
export function camposDoPerfil(perfil: PerfilGithub) {
  const githubId = Number(perfil.id);
  if (!Number.isSafeInteger(githubId)) throw new Error(`id do GitHub inválido: ${perfil.id}`);
  return { githubId, login: perfil.login };
}

export const ROTAS_DESLIGADAS = [
  "/update-user",
  "/sign-up/email",
  "/get-access-token",
  "/refresh-token",
  "/account-info",
  "/link-social",
  "/unlink-account",
] as const;

function criarAuth() {
  const e = env();
  return betterAuth({
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    // Rotas HTTP desligadas (as chamadas internas `auth().api` continuam):
    // - gravar dados do usuário: os campos extras precisam aceitar entrada,
    //   porque o Better Auth descarta os `input: false` vindos do perfil do
    //   GitHub; sem estas rotas, ninguém troca a própria identidade pelo
    //   navegador. Nome, foto e login vêm sempre do GitHub.
    // - devolver ou mexer no token do GitHub: ele nunca sai do servidor (NFR8).
    disabledPaths: [...ROTAS_DESLIGADAS],
    user: {
      additionalFields: {
        githubId: { type: "number", required: true },
        login: { type: "string", required: true },
      },
    },
    account: {
      // XChaCha20-Poly1305 com chave derivada do BETTER_AUTH_SECRET (NFR8, Story 1.2 Task 3).
      encryptOAuthTokens: true,
      // Sem vinculação por e-mail: uma conta nova do GitHub com o e-mail
      // verificado de um usuário existente entraria como ele. Com um provedor
      // só, a identidade é o githubId e nada mais (gate da 1.2, SEC-001).
      accountLinking: { enabled: false },
    },
    socialProviders: {
      github: {
        clientId: e.GITHUB_APP_CLIENT_ID,
        clientSecret: e.GITHUB_APP_CLIENT_SECRET,
        // Nome, usuário e foto acompanham o GitHub a cada login.
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (perfil) => camposDoPerfil(perfil),
      },
    },
  });
}

let instancia: ReturnType<typeof criarAuth> | undefined;

export function auth() {
  instancia ??= criarAuth();
  return instancia;
}

export type UsuarioSessao = ReturnType<typeof auth>["$Infer"]["Session"]["user"];

export async function obterSessao() {
  return auth().api.getSession({ headers: await headers() });
}

export async function exigirSessao(): Promise<UsuarioSessao> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroApp("sem_sessao", 401);
  return sessao.user;
}
