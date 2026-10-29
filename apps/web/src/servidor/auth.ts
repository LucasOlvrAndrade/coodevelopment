import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, deviceAuthorization } from "better-auth/plugins";
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

// Renovação do token do GitHub App. Substitui a do Better Auth, que só olha o
// status HTTP: o GitHub responde 200 com `{ error: "bad_refresh_token" }`, e
// aí o Better Auth devolvia o token vencido sem erro (gate da 1.2, REL-001).
export async function renovarTokenGithub(
  refreshToken: string,
  credenciais: { clientId: string; clientSecret: string },
) {
  const resposta = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
    }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok || dados.error || typeof dados.access_token !== "string") {
    // Só o código do erro; a resposta nunca vai para o log.
    throw new Error(`renovação do token do GitHub recusada: ${String(dados.error ?? resposta.status)}`);
  }
  const agora = Date.now();
  const emSegundos = (v: unknown) => (typeof v === "number" ? new Date(agora + v * 1000) : undefined);
  return {
    accessToken: dados.access_token,
    refreshToken: typeof dados.refresh_token === "string" ? dados.refresh_token : undefined,
    tokenType: typeof dados.token_type === "string" ? dados.token_type : undefined,
    accessTokenExpiresAt: emSegundos(dados.expires_in),
    refreshTokenExpiresAt: emSegundos(dados.refresh_token_expires_in),
  };
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

// Id de cliente que o conector manda no login por dispositivo.
export const ID_DO_CONECTOR = "coodevelopment-conector";

// Do plugin bearer, só a metade que lê o `Authorization: Bearer` do conector.
// A outra metade põe o token da sessão no cabeçalho `set-auth-token` de toda
// resposta com cookie de sessão, o que deixaria o token do navegador legível
// por JavaScript e anularia o httpOnly do cookie.
function bearerSoNaEntrada() {
  const plugin = bearer();
  return { ...plugin, hooks: { before: plugin.hooks.before } };
}

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
    // Falhas antes do login (state inválido, voltar no navegador, segunda aba)
    // caem no aviso da página inicial, não na página em inglês do Better Auth.
    onAPIError: { errorURL: `${e.BETTER_AUTH_URL}/?erro=github` },
    user: {
      additionalFields: {
        githubId: { type: "number", required: true },
        login: { type: "string", required: true },
      },
    },
    // Limite de taxa (security-and-performance.md), guardado no banco para
    // valer entre as instâncias da Vercel. Pelo IP que a própria Vercel põe
    // no cabeçalho (não dá para forjar de fora). O Better Auth só liga o
    // limite em produção. O login do conector ganha regras próprias: pedir
    // código é raro; a consulta vem a cada 5 s de cada terminal esperando.
    rateLimit: {
      storage: "database",
      customRules: {
        "/device/code": { window: 60, max: 10 },
        "/device/token": { window: 60, max: 30 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] } },
    plugins: [
      // Login do conector por código (FR10, Story 3.1): o terminal mostra o
      // código, a pessoa confirma em /dispositivo já logada, e o conector
      // recebe uma sessão própria, usada como Bearer.
      deviceAuthorization({
        verificationUri: "/dispositivo",
        expiresIn: "10m",
        interval: "5s",
        validateClient: (clientId) => clientId === ID_DO_CONECTOR,
      }),
      bearerSoNaEntrada(),
    ],
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
        refreshAccessToken: (refreshToken) =>
          renovarTokenGithub(refreshToken, {
            clientId: e.GITHUB_APP_CLIENT_ID,
            clientSecret: e.GITHUB_APP_CLIENT_SECRET,
          }),
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

// De onde vem a sessão: o conector manda Bearer; o navegador, só o cookie.
export async function viaDaSessao(): Promise<"conector" | "pagina"> {
  const autorizacao = (await headers()).get("authorization") ?? "";
  return /^bearer\s+\S/i.test(autorizacao) ? "conector" : "pagina";
}
