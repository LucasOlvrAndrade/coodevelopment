import { z } from "zod";

// Token da sala (Story 2.5): JWT HS256 de 10 minutos que o app emite para um
// participante de uma jam e a sala confere ao conectar. Feito com a WebCrypto,
// que existe no Node, no navegador e no Worker. O cabeçalho é fixo: token com
// outro algoritmo (inclusive "none") é recusado antes de qualquer conta.

export const DURACAO_TOKEN_SALA_S = 10 * 60;

const conteudo = z.object({
  sub: z.string().min(1),
  jam: z.string().min(1),
  via: z.enum(["pagina", "conector"]),
  exp: z.number().int(),
});

export type QuemNaSala = { usuarioId: string; jamId: string; via: z.infer<typeof conteudo>["via"] };

const codificador = new TextEncoder();
const CABECALHO = paraBase64url(codificador.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));

function paraBase64url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(trecho: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[\w-]*$/.test(trecho)) return null;
  try {
    const binario = atob(trecho.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (trecho.length % 4)) % 4));
    return Uint8Array.from(binario, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function chave(segredo: string, uso: "sign" | "verify") {
  if (!segredo) throw new Error("SEGREDO_SALA vazio");
  return crypto.subtle.importKey("raw", codificador.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, [uso]);
}

export async function assinarTokenSala(quem: QuemNaSala, segredo: string, agora = Date.now()) {
  const exp = Math.floor(agora / 1000) + DURACAO_TOKEN_SALA_S;
  const corpo = paraBase64url(codificador.encode(JSON.stringify({ sub: quem.usuarioId, jam: quem.jamId, via: quem.via, exp })));
  const assinatura = await crypto.subtle.sign("HMAC", await chave(segredo, "sign"), codificador.encode(`${CABECALHO}.${corpo}`));
  return { token: `${CABECALHO}.${corpo}.${paraBase64url(new Uint8Array(assinatura))}`, expiraEm: new Date(exp * 1000) };
}

// Quem é o dono do token, ou null se ele não vale para esta jam agora
// (assinatura de outro segredo, conteúdo mexido, vencido ou de outra jam).
export async function validarTokenSala(token: string, jamId: string, segredo: string, agora = Date.now()): Promise<QuemNaSala | null> {
  const [cabecalho, corpo, assinatura, ...sobra] = token.split(".");
  if (cabecalho !== CABECALHO || corpo === undefined || assinatura === undefined || sobra.length > 0) return null;
  const bytesAssinatura = deBase64url(assinatura);
  if (!bytesAssinatura) return null;
  const confere = await crypto.subtle.verify("HMAC", await chave(segredo, "verify"), bytesAssinatura, codificador.encode(`${cabecalho}.${corpo}`));
  const bytesCorpo = confere ? deBase64url(corpo) : null;
  if (!bytesCorpo) return null;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytesCorpo));
  } catch {
    return null;
  }
  const lido = conteudo.safeParse(json);
  if (!lido.success || lido.data.jam !== jamId || lido.data.exp * 1000 <= agora) return null;
  return { usuarioId: lido.data.sub, jamId: lido.data.jam, via: lido.data.via };
}
