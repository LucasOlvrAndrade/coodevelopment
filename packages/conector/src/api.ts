import type { Ambiente } from "./ambiente";

// Chamadas do conector ao app. A sessão vai como Bearer, nunca na URL, e
// nunca é escrita no terminal nem em log.

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// Sem resposta do app (rede fora, endereço errado).
export class SemConexao extends Error {}

export async function chamar<T>(amb: Ambiente, caminho: string, opcoes: { sessao: string; metodo?: "GET" | "POST"; corpo?: unknown }): Promise<T> {
  const resposta = await amb
    .fetch(`${amb.urlApp}${caminho}`, {
      method: opcoes.metodo ?? "GET",
      headers: {
        authorization: `Bearer ${opcoes.sessao}`,
        // O Better Auth confere a origem das chamadas com sessão (sign-out).
        origin: amb.urlApp,
        ...(opcoes.corpo === undefined ? {} : { "content-type": "application/json" }),
      },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    })
    .catch((e: unknown) => {
      throw new SemConexao(`Não consegui falar com ${amb.urlApp} (${String(e)}).`);
    });
  const dados = (await resposta.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, dados?.error?.code ?? String(resposta.status), dados?.error?.message ?? `O app respondeu ${resposta.status}.`);
  }
  return dados as T;
}

export type DadosDaJam = {
  jamId: string;
  nome: string;
  estado: "aberta" | "fechando" | "fechada";
  repo: { owner: string; nome: string; id: number };
  branch: string;
  // Base do merge da primeira escrita de cada arquivo (Story 3.3).
  baseSha: string;
  // Quem está usando o conector: separa as próprias escritas das dos outros.
  eu: string;
};

export const dadosDaJam = (amb: Ambiente, sessao: string, jamId: string) =>
  chamar<DadosDaJam>(amb, `/api/jams/${jamId}/conector`, { sessao });

export const tokenDeClone = (amb: Ambiente, sessao: string, jamId: string) =>
  chamar<{ token: string; expiraEm: string }>(amb, "/api/conector/clone-token", { sessao, metodo: "POST", corpo: { jamId } });

export const tokenDaSala = (amb: Ambiente, sessao: string, jamId: string) =>
  chamar<{ token: string; salaUrl: string; expiraEm: string }>(amb, `/api/jams/${jamId}/token-sala`, { sessao, metodo: "POST" });

export const quemSouEu = (amb: Ambiente, sessao: string) =>
  chamar<{ user: { login: string; name: string } } | null>(amb, "/api/auth/get-session", { sessao });

// Encerra a sessão no app (sair). O Better Auth apaga a sessão do cookie, que
// o Bearer vira do lado de lá.
export const encerrarSessao = (amb: Ambiente, sessao: string) =>
  chamar<unknown>(amb, "/api/auth/sign-out", { sessao, metodo: "POST", corpo: {} });
