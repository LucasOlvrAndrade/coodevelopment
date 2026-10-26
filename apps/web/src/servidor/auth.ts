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

function criarAuth() {
  const e = env();
  return betterAuth({
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    user: {
      additionalFields: {
        githubId: { type: "number", required: true, input: false },
        login: { type: "string", required: true, input: false },
      },
    },
    account: {
      // XChaCha20-Poly1305 com chave derivada do BETTER_AUTH_SECRET (NFR8, Story 1.2 Task 3).
      encryptOAuthTokens: true,
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
