import type { Ambiente } from "./ambiente";
import { SemConexao } from "./api";

// Login por dispositivo (RFC 8628, plugin do Better Auth; FR10): o terminal
// mostra o código e abre /dispositivo; a pessoa confirma no navegador já
// logada; o conector consulta até receber a sessão.

export const ID_DO_CONECTOR = "coodevelopment-conector";
const GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export class LoginRecusado extends Error {}

type Codigo = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

async function postar(amb: Ambiente, caminho: string, corpo: object) {
  const resposta = await amb
    .fetch(`${amb.urlApp}/api/auth${caminho}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    })
    .catch((e: unknown) => {
      throw new SemConexao(`Não consegui falar com ${amb.urlApp} (${String(e)}).`);
    });
  return {
    status: resposta.status,
    esperarS: Number(resposta.headers.get("retry-after") ?? resposta.headers.get("x-retry-after")) || 0,
    dados: (await resposta.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

// Só abre no navegador o endereço do próprio app: o link vem do servidor e
// vai para o "abrir com" do Windows, que também abre arquivos e programas
// (gate da 3.1, SEC-003).
function doApp(amb: Ambiente, url: string): boolean {
  try {
    const alvo = new URL(url);
    const app = new URL(amb.urlApp);
    const seguro = alvo.protocol === "https:" || (alvo.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(alvo.hostname));
    return seguro && alvo.origin === app.origin;
  } catch {
    return false;
  }
}

// "WDJBMJHT" vira "WDJB-MJHT" para ler e comparar com a tela.
const legivel = (codigo: string) => (codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo);

export async function entrarPorDispositivo(amb: Ambiente): Promise<string> {
  const pedido = await postar(amb, "/device/code", { client_id: ID_DO_CONECTOR });
  if (pedido.status !== 200) throw new Error(`O app recusou o pedido de login (${pedido.status}).`);
  const codigo = pedido.dados as unknown as Codigo;

  amb.escrever("");
  amb.escrever("Para ligar este computador à sua conta, confirme o código no navegador:");
  amb.escrever("");
  amb.escrever(`    ${legivel(codigo.user_code)}`);
  amb.escrever("");
  if (!doApp(amb, codigo.verification_uri_complete)) throw new Error("O app mandou um endereço de login que não é dele.");
  amb.escrever(`Abrindo ${codigo.verification_uri_complete}`);
  amb.escrever("Se o navegador não abrir, entre nesse endereço e digite o código.");
  amb.abrirNavegador(codigo.verification_uri_complete);

  let intervalo = Math.max(codigo.interval, 1) * 1000;
  const prazo = Date.now() + codigo.expires_in * 1000;
  let quedas = 0;
  while (Date.now() < prazo) {
    await amb.esperar(intervalo);
    // Uma queda de rede no meio da espera não derruba o login: tenta de novo
    // até o código vencer, com a espera dobrando (gate da 3.1, REL-005).
    const resposta = await postar(amb, "/device/token", {
      grant_type: GRANT,
      device_code: codigo.device_code,
      client_id: ID_DO_CONECTOR,
    }).catch((e: unknown) => {
      if (!(e instanceof SemConexao)) throw e;
      quedas++;
      return null;
    });
    if (!resposta) {
      if (quedas === 1) amb.escrever("Sem conexão com o app. Tentando de novo...");
      intervalo = Math.min(intervalo * 2, 60_000);
      continue;
    }
    quedas = 0;
    const { status, esperarS, dados } = resposta;
    if (status === 200 && typeof dados.access_token === "string") return dados.access_token;
    // Muitas consultas do mesmo IP (várias pessoas no mesmo escritório): espera
    // o que o app pedir e segue, como um slow_down (gate da 3.1, REL-002).
    if (status === 429) {
      intervalo = Math.max(intervalo, esperarS * 1000) + 5000;
      continue;
    }
    switch (dados.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        // A RFC manda somar 5 s ao intervalo a cada slow_down.
        intervalo += 5000;
        continue;
      case "access_denied":
        throw new LoginRecusado("O login foi recusado no navegador.");
      case "expired_token":
        throw new LoginRecusado("O código venceu antes da confirmação. Rode o comando de novo.");
      default:
        throw new Error(`O app recusou o login (${String(dados.error ?? status)}).`);
    }
  }
  throw new LoginRecusado("O código venceu antes da confirmação. Rode o comando de novo.");
}
