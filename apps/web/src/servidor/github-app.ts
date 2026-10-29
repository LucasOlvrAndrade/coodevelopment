import "server-only";
import { createSign } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { ErroApp } from "@/servidor/erros";

// O GitHub App falando por si (não em nome de um usuário), para o token de
// clone do conector (Story 3.1). A chave privada só existe no servidor.

const base64url = (texto: string | Buffer) => Buffer.from(texto).toString("base64url");

// JWT RS256 do app, de 9 minutos (o GitHub aceita até 10), com o relógio
// recuado 60 s contra diferença de horário, como a documentação pede.
export function jwtDoApp(appId: string, chavePrivada: string, agora = Date.now()): string {
  const emSegundos = Math.floor(agora / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(JSON.stringify({ iat: emSegundos - 60, exp: emSegundos + 540, iss: appId }));
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(chavePrivada);
  return `${cabecalho}.${corpo}.${base64url(assinatura)}`;
}

function credenciais() {
  const appId = process.env.GITHUB_APP_ID;
  // A Vercel guarda a chave com as quebras de linha; um .env de uma linha só, com "\n".
  const chave = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !chave) throw new ErroApp("inesperado", 500, "GitHub App sem GITHUB_APP_ID ou GITHUB_APP_PRIVATE_KEY");
  return { appId, chave };
}

export type GithubApp = {
  // Token de instalação só de leitura e só deste repositório, de 1 hora (NFR8).
  tokenDeLeitura(repo: { owner: string; nome: string; id: number }): Promise<{ token: string; expiraEm: string }>;
};

export function githubApp(): GithubApp {
  return {
    async tokenDeLeitura(repo) {
      const { appId, chave } = credenciais();
      const octokit = new Octokit({ userAgent: "coodevelopment", auth: jwtDoApp(appId, chave) });
      // App sem instalação no dono (404) ou instalado só em alguns
      // repositórios, sem o da jam (422): quem resolve é o dono da jam, não
      // quem está entrando (gate da 3.1, REL-006).
      const foraDoApp = (e: unknown): never => {
        const status = (e as { status?: number }).status;
        if (status === 404 || status === 422) throw new ErroApp("repositorio_fora_do_app", 409);
        throw e;
      };
      const instalacao = await octokit.rest.apps.getRepoInstallation({ owner: repo.owner, repo: repo.nome }).catch(foraDoApp);
      const { data } = await octokit.rest.apps
        .createInstallationAccessToken({
          installation_id: instalacao.data.id,
          repository_ids: [repo.id],
          permissions: { contents: "read" },
        })
        .catch(foraDoApp);
      return { token: data.token, expiraEm: data.expires_at };
    },
  };
}
