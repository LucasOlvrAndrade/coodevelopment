import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { criarCache } from "@/servidor/cache-memoria";
import { githubDoUsuario } from "@/servidor/github";

// Site do projeto na página da jam (pedido do Lucas, 03/11): o endereço do
// campo "Website" do repositório no GitHub, aberto numa prévia ao lado quando
// o site deixa aparecer dentro de outra página.

export type SiteDoProjeto = { url: string; embutir: boolean };

const ORIGEM_DO_APP = "https://coodevelopment.lucas-andrade.dev";
const PRAZO_MS = 3000;
const SALTOS = 3;

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

// Valores de um cabeçalho que pode vir repetido (o Headers junta com vírgula).
const partes = (valor: string | null) => (valor ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);

// O site aceita aparecer dentro desta página? X-Frame-Options e o
// frame-ancestors da CSP dizem que não quando não incluem o app (gate da 4.1,
// SEC-002: repetidos também contam).
export function permiteEmbutir(cabecalhos: Headers): boolean {
  if (partes(cabecalhos.get("x-frame-options")).some((x) => x === "deny" || x === "sameorigin")) return false;
  const diretivas = partes(cabecalhos.get("content-security-policy"))
    .flatMap((politica) => politica.split(";"))
    .map((d) => d.trim().split(/\s+/))
    .filter(([nome]) => nome === "frame-ancestors");
  // Mais de uma política: todas precisam deixar.
  return diretivas.every((d) =>
    d.slice(1).some((f) => f === "*" || f === "https:" || f === ORIGEM_DO_APP || (f.startsWith("https://*.") && ORIGEM_DO_APP.endsWith(f.slice("https://*".length)))),
  );
}

// Endereço da internet de verdade: nada de rede interna, loopback ou
// link-local (gate da 4.1, SEC-001).
export function ipPublico(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return ipPublico(v6.slice(7));
  return !(v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb"));
}

type Resolver = (nome: string) => Promise<{ address: string }[]>;
const resolverDns: Resolver = (nome) => lookup(nome, { all: true });

// Só https, na porta padrão, para um nome cujos endereços são todos públicos.
async function podeBuscar(url: URL, resolver: Resolver): Promise<boolean> {
  if (url.protocol !== "https:" || url.port || isIP(url.hostname.replace(/^\[|\]$/g, ""))) return false;
  const enderecos = await resolver(url.hostname).catch(() => []);
  return enderecos.length > 0 && enderecos.every((e) => ipPublico(e.address));
}

// Pergunta ao próprio site, com prazo curto, conferindo cada redirecionamento;
// sem resposta, não embute (a prévia ficaria em branco) e fica só o link. Site
// em http nunca embute: o navegador bloqueia dentro de uma página https
// (gate da 4.1, UX-001).
export async function conferirEmbutir(endereco: string, resolver: Resolver = resolverDns, buscar: typeof fetch = fetch): Promise<boolean> {
  let url = new URL(endereco);
  for (let salto = 0; salto <= SALTOS; salto++) {
    if (!(await podeBuscar(url, resolver))) return false;
    const resposta = await buscar(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(PRAZO_MS), headers: { "user-agent": "coodevelopment" } }).catch(
      () => null,
    );
    if (!resposta) return false;
    await resposta.body?.cancel().catch(() => {});
    const destino = resposta.headers.get("location");
    if (resposta.status >= 300 && resposta.status < 400 && destino) {
      url = new URL(destino, url);
      continue;
    }
    return resposta.ok && permiteEmbutir(resposta.headers);
  }
  return false;
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
