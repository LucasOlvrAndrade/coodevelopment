import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { amizade, pedidoAmizade, user } from "@/servidor/db/schema";
import type { Banco, Pessoa } from "./amizade";

// Sugestões de amigos (Story 1.4, D12): mútuos do GitHub (sigo e me seguem)
// que têm conta no app e ainda não são amigos nem têm pedido entre os dois
// (pendente, ou recusado: sugestão não insiste em quem já disse não).
//
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
const PAGINAS_DE_UMA_VEZ = 5;

async function contasDaLista(github: GithubMutuos, lista: "seguidores" | "seguindo", total: number) {
  const paginas = Math.min(Math.ceil(total / POR_PAGINA), MAX_PAGINAS);
  if (Math.ceil(total / POR_PAGINA) > MAX_PAGINAS) {
    console.warn(JSON.stringify({ nivel: "aviso", evento: "mutuos_lista_cortada", lista, total }));
  }
  const contas = new Map<number, string>();
  for (let inicio = 1; inicio <= paginas; inicio += PAGINAS_DE_UMA_VEZ) {
    const lote = Array.from({ length: Math.min(PAGINAS_DE_UMA_VEZ, paginas - inicio + 1) }, (_, i) => inicio + i);
    for (const itens of await Promise.all(lote.map((pagina) => github.listar(lista, pagina)))) {
      for (const conta of itens) contas.set(conta.id, conta.login);
    }
  }
  return contas;
}

export async function sugerirMutuos(banco: Banco, eu: string, github: GithubMutuos): Promise<Pessoa[]> {
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
  if (comConta.length === 0) return [];

  const ids = comConta.map((p) => p.id);
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
      // Pendente ou recusado: quem recusou (ou foi recusado) não volta como
      // sugestão; a busca continua achando a pessoa (A10).
      .where(
        or(
          and(eq(pedidoAmizade.de, eu), inArray(pedidoAmizade.para, ids)),
          and(eq(pedidoAmizade.para, eu), inArray(pedidoAmizade.de, ids)),
        ),
      ),
  ]);
  const fora = new Set([...amigos.flatMap((a) => [a.a, a.b]), ...pedidos.flatMap((p) => [p.de, p.para])]);
  const candidatos = comConta.filter((p) => !fora.has(p.id));

  // A outra direção, só para os poucos que têm conta (login atual, vindo do GitHub).
  const mutuos = await Promise.all(
    candidatos.map(async ({ githubId, ...pessoa }) => {
      const login = contas.get(githubId) ?? pessoa.login;
      const tambem = lista === "seguindo" ? await github.meSegue(login, meuLogin) : await github.sigo(login);
      return tambem ? pessoa : null;
    }),
  );
  return mutuos.filter((p) => p !== null);
}
