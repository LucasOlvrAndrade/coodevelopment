import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { amizade, pedidoAmizade, user } from "@/servidor/db/schema";
import type { Banco, Pessoa } from "./amizade";

// Sugestões de amigos (Story 1.4, D12): mútuos do GitHub (sigo e me seguem)
// que têm conta no app e ainda não são amigos nem têm pedido entre os dois
// (pendente, ou recusado: sugestão não insiste em quem já disse não).
//
// Em duas partes: mutuosComConta fala com o GitHub (lenta, pode ir para o
// cache) e filtrarSugestoes tira amigos e pedidos (banco, sempre na hora).
// Para não pagar as duas listas inteiras de quem segue muita gente (AC 4), só
// a lista menor vem inteira (paginada); quem dela tem conta no app é conferido
// na outra direção um a um. Casa sempre pelo id numérico do GitHub.

export interface GithubMutuos {
  contagens(): Promise<{ login: string; seguidores: number; seguindo: number }>;
  listar(lista: "seguidores" | "seguindo", pagina: number): Promise<{ id: number; login: string }[]>;
  sigo(login: string): Promise<boolean>;
  meSegue(login: string, meuLogin: string): Promise<boolean>;
}

export const POR_PAGINA = 100;
export const MAX_PAGINAS = 50;
const DE_UMA_VEZ = 5;

function emLotes<T>(itens: T[]): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += DE_UMA_VEZ) lotes.push(itens.slice(i, i + DE_UMA_VEZ));
  return lotes;
}

async function contasDaLista(github: GithubMutuos, lista: "seguidores" | "seguindo", total: number) {
  const paginas = Math.min(Math.ceil(total / POR_PAGINA), MAX_PAGINAS);
  if (Math.ceil(total / POR_PAGINA) > MAX_PAGINAS) {
    console.warn(JSON.stringify({ nivel: "aviso", evento: "mutuos_lista_cortada", lista, total }));
  }
  const contas = new Map<number, string>();
  const todas = Array.from({ length: paginas }, (_, i) => i + 1);
  for (const lote of emLotes(todas)) {
    for (const itens of await Promise.all(lote.map((pagina) => github.listar(lista, pagina)))) {
      for (const conta of itens) contas.set(conta.id, conta.login);
    }
  }
  return contas;
}

export async function mutuosComConta(banco: Banco, eu: string, github: GithubMutuos): Promise<Pessoa[]> {
  const { login: meuLogin, seguidores, seguindo } = await github.contagens();
  if (seguidores === 0 || seguindo === 0) return [];

  const lista = seguindo <= seguidores ? "seguindo" : "seguidores";
  const contas = await contasDaLista(github, lista, lista === "seguindo" ? seguindo : seguidores);
  if (contas.size === 0) return [];

  const comConta = await banco
    .select({ id: user.id, login: user.login, nome: user.name, foto: user.image, githubId: user.githubId })
    .from(user)
    .where(and(inArray(user.githubId, [...contas.keys()]), ne(user.id, eu)))
    .orderBy(asc(sql`lower(${user.name})`));

  // A outra direção, em lotes, com o login atual vindo do GitHub. Uma conferência
  // que falha (limite do GitHub, por exemplo) só tira aquela pessoa da lista.
  const mutuos: Pessoa[] = [];
  for (const lote of emLotes(comConta)) {
    const respostas = await Promise.allSettled(
      lote.map((p) => {
        const login = contas.get(p.githubId) ?? p.login;
        return lista === "seguindo" ? github.meSegue(login, meuLogin) : github.sigo(login);
      }),
    );
    respostas.forEach((resposta, i) => {
      const { id, login, nome, foto } = lote[i]!;
      if (resposta.status === "fulfilled") {
        if (resposta.value) mutuos.push({ id, login, nome, foto });
      } else {
        console.warn(JSON.stringify({ nivel: "aviso", evento: "mutuo_nao_conferido", erro: String(resposta.reason) }));
      }
    });
  }
  return mutuos;
}

export async function filtrarSugestoes(banco: Banco, eu: string, mutuos: Pessoa[]): Promise<Pessoa[]> {
  if (mutuos.length === 0) return [];
  const ids = mutuos.map((p) => p.id);
  const [amigos, pedidos] = await Promise.all([
    banco
      .select({ a: amizade.usuarioA, b: amizade.usuarioB })
      .from(amizade)
      .where(
        or(
          and(eq(amizade.usuarioA, eu), inArray(amizade.usuarioB, ids)),
          and(eq(amizade.usuarioB, eu), inArray(amizade.usuarioA, ids)),
        ),
      ),
    banco
      .select({ de: pedidoAmizade.de, para: pedidoAmizade.para })
      .from(pedidoAmizade)
      // Pendente ou recusado (desfazer amizade também conta como recusa): quem
      // disse não não volta como sugestão; a busca continua achando a pessoa (A10).
      .where(
        or(
          and(eq(pedidoAmizade.de, eu), inArray(pedidoAmizade.para, ids)),
          and(eq(pedidoAmizade.para, eu), inArray(pedidoAmizade.de, ids)),
        ),
      ),
  ]);
  const fora = new Set([...amigos.flatMap((a) => [a.a, a.b]), ...pedidos.flatMap((p) => [p.de, p.para])]);
  return mutuos.filter((p) => !fora.has(p.id));
}

export async function sugerirMutuos(banco: Banco, eu: string, github: GithubMutuos): Promise<Pessoa[]> {
  return filtrarSugestoes(banco, eu, await mutuosComConta(banco, eu, github));
}
