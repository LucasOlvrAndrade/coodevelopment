import { createHmac } from "node:crypto";

// Cookie de sessão do Better Auth assinado como o better-call assina
// ("token.HMAC-SHA256 em base64", codificado para a URL), para os testes
// entrarem como uma pessoa no navegador. Em http o nome não tem __Secure-.
export function cookieDeSessao(token: string, segredo: string): string {
  const assinatura = createHmac("sha256", segredo).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${assinatura}`)}`;
}
