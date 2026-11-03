import "server-only";
import { criarCache } from "@/servidor/cache-memoria";
import { githubDoUsuario } from "@/servidor/github";

// Site do projeto na página da jam (pedido do Lucas, 03/11): o endereço do
// campo "Website" do repositório no GitHub, aberto numa prévia ao lado quando
// o site deixa aparecer dentro de outra página.

export type SiteDoProjeto = { url: string; embutir: boolean };

const ORIGEM_DO_APP = "https://coodevelopment.lucas-andrade.dev";
const PRAZO_MS = 3000;

// O "Website" do GitHub é texto livre: sem esquema vira https; só http e
// https, e só com um nome de domínio de verdade.
export function urlDoSite(homepage: string | null | undefined): string | null {
  const texto = homepage?.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.toString();
}

// O site aceita aparecer dentro desta página? X-Frame-Options e o
// frame-ancestors da CSP dizem que não quando não incluem o app.
export function permiteEmbutir(cabecalhos: Headers): boolean {
  const xfo = cabecalhos.get("x-frame-options")?.trim().toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin") return false;
  const csp = cabecalhos.get("content-security-policy") ?? "";
  const diretiva = csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([nome]) => nome?.toLowerCase() === "frame-ancestors");
  if (!diretiva) return true;
  const fontes = diretiva.slice(1).map((f) => f.toLowerCase());
  return fontes.some((f) => f === "*" || f === "https:" || f === ORIGEM_DO_APP || (f.startsWith("https://*.") && ORIGEM_DO_APP.endsWith(f.slice("https://*".length))));
}

// Pergunta ao próprio site, com prazo curto; sem resposta, não embute (a
// prévia ficaria em branco) e fica só o link.
async function conferirEmbutir(url: string): Promise<boolean> {
  try {
    const resposta = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(PRAZO_MS), headers: { "user-agent": "coodevelopment" } });
    await resposta.body?.cancel();
    return resposta.ok && permiteEmbutir(resposta.headers);
  } catch {
    return false;
  }
}

// O site muda pouco: 5 min por repositório, nesta instância.
const cache = criarCache<SiteDoProjeto | null>(5 * 60 * 1000);

export function siteDoProjeto(usuarioId: string, dono: string, nome: string): Promise<SiteDoProjeto | null> {
  return cache.obter(`${dono}/${nome}`.toLowerCase(), async () => {
    const { data } = await githubDoUsuario(usuarioId).rest.repos.get({ owner: dono, repo: nome });
    const url = urlDoSite(data.homepage);
    return url ? { url, embutir: await conferirEmbutir(url) } : null;
  });
}
