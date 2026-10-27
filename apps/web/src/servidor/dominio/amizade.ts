import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/servidor/db/schema";
import { amizade, pedidoAmizade, user } from "@/servidor/db/schema";
import { ErroApp } from "@/servidor/erros";

// Regras de amizade (Story 1.3). Recebem o banco por parâmetro e não sabem de
// sessão: quem age (`eu`) vem da Server Action. Toda escrita de mais de um
// passo é uma instrução SQL só (A9): o neon-http não tem transação, e o
// Postgres executa a instrução inteira ou nada. A ordem do par da amizade sai
// de least/greatest no próprio banco, com a mesma collation do check
// `usuario_a < usuario_b` (a comparação de texto do JavaScript pode discordar).

export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Pessoa = { id: string; login: string; nome: string; foto: string | null };

export type Relacao =
  | { tipo: "eu" }
  | { tipo: "amigo" }
  | { tipo: "pedido_enviado" }
  | { tipo: "pedido_recebido"; pedidoId: string }
  | { tipo: "nenhuma" };

export type PedidoComPessoa = Pessoa & { pedidoId: string; criadoEm: Date };

const colunasPessoa = { id: user.id, login: user.login, nome: user.name, foto: user.image };

// Usuário do GitHub: 1 a 39 caracteres, letras, números e hífen, sem hífen nas
// pontas nem dois seguidos.
const LOGIN_GITHUB = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function normalizarLogin(texto: string): string | null {
  const login = texto.trim().replace(/^@/, "");
  return LOGIN_GITHUB.test(login) ? login : null;
}

async function linhas<T>(banco: Banco, consulta: SQL): Promise<T[]> {
  // neon-http e PGlite devolvem as linhas em `rows`.
  return ((await banco.execute(consulta)) as unknown as { rows: T[] }).rows;
}

const doPar = (eu: string, outro: string) =>
  and(eq(amizade.usuarioA, sql`least(${eu}, ${outro})`), eq(amizade.usuarioB, sql`greatest(${eu}, ${outro})`));

async function relacaoCom(banco: Banco, eu: string, outro: string): Promise<Relacao> {
  if (outro === eu) return { tipo: "eu" };
  const [amigos, pedidos] = await Promise.all([
    banco.select({ desde: amizade.criadaEm }).from(amizade).where(doPar(eu, outro)).limit(1),
    banco
      .select({ id: pedidoAmizade.id, de: pedidoAmizade.de })
      .from(pedidoAmizade)
      .where(
        and(
          eq(pedidoAmizade.status, "pendente"),
          or(
            and(eq(pedidoAmizade.de, eu), eq(pedidoAmizade.para, outro)),
            and(eq(pedidoAmizade.de, outro), eq(pedidoAmizade.para, eu)),
          ),
        ),
      ),
  ]);
  if (amigos.length > 0) return { tipo: "amigo" };
  // Pedidos cruzados ao mesmo tempo: mostra o recebido, porque aceitar resolve os dois.
  const recebido = pedidos.find((p) => p.de === outro);
  if (recebido) return { tipo: "pedido_recebido", pedidoId: recebido.id };
  return pedidos.length > 0 ? { tipo: "pedido_enviado" } : { tipo: "nenhuma" };
}

// Busca exata pelo usuário do GitHub (A10): por prefixo, uma letra listaria
// quem usa o app. O login não é único no banco, então pode vir mais de uma pessoa.
export async function buscarPorLogin(banco: Banco, eu: string, texto: string) {
  const login = normalizarLogin(texto);
  if (!login) throw new ErroApp("login_invalido");
  const pessoas = await banco
    .select(colunasPessoa)
    .from(user)
    .where(sql`lower(${user.login}) = lower(${login})`)
    .orderBy(asc(user.createdAt))
    .limit(5);
  return Promise.all(pessoas.map(async (p) => ({ ...p, relacao: await relacaoCom(banco, eu, p.id) })));
}

export async function pedirAmizade(banco: Banco, eu: string, outro: string): Promise<"pedido_enviado" | "amigos"> {
  if (outro === eu) throw new ErroApp("amizade_consigo");
  const [existe] = await banco.select({ id: user.id }).from(user).where(eq(user.id, outro)).limit(1);
  if (!existe) throw new ErroApp("usuario_nao_encontrado", 404);

  // Já amigos: nada muda. Pedido do outro para mim pendente: vira amizade
  // (pedido cruzado, front-end spec). Senão, o pedido fica pendente: um que já
  // existe não duplica (AC 5) e um recusado volta a pendente (A10).
  const [resultado] = await linhas<{ amigos: boolean }>(
    banco,
    sql`
      with
        ja_amigos as (
          select 1 from ${amizade}
          where usuario_a = least(${eu}, ${outro}) and usuario_b = greatest(${eu}, ${outro})
        ),
        cruzado as (
          delete from ${pedidoAmizade}
          where de = ${outro} and para = ${eu} and status = 'pendente'
            and not exists (select 1 from ja_amigos)
          returning 1
        ),
        nova_amizade as (
          insert into ${amizade} (usuario_a, usuario_b)
          select least(${eu}, ${outro}), greatest(${eu}, ${outro})
          where exists (select 1 from cruzado)
          on conflict do nothing
          returning 1
        ),
        pedido as (
          insert into ${pedidoAmizade} (id, de, para)
          select ${crypto.randomUUID()}, ${eu}, ${outro}
          where not exists (select 1 from ja_amigos) and not exists (select 1 from cruzado)
          on conflict (de, para) do update set status = 'pendente', criado_em = now()
            where ${pedidoAmizade}.status = 'recusado'
          returning 1
        )
      select exists (select 1 from ja_amigos) or exists (select 1 from cruzado) as amigos
    `,
  );
  return resultado?.amigos ? "amigos" : "pedido_enviado";
}

// Só quem recebeu aceita. Apaga também um pedido no sentido contrário (dois
// pedidos cruzados ao mesmo tempo) e cria a amizade, tudo na mesma instrução.
export async function aceitarPedido(banco: Banco, eu: string, pedidoId: string): Promise<void> {
  const [resultado] = await linhas<{ aceitos: number }>(
    banco,
    sql`
      with
        pedido as (
          delete from ${pedidoAmizade}
          where id = ${pedidoId} and para = ${eu} and status = 'pendente'
          returning de, para
        ),
        contrario as (
          delete from ${pedidoAmizade} p
          using pedido
          where p.de = pedido.para and p.para = pedido.de
          returning 1
        ),
        nova_amizade as (
          insert into ${amizade} (usuario_a, usuario_b)
          select least(de, para), greatest(de, para) from pedido
          on conflict do nothing
          returning 1
        )
      select count(*)::int as aceitos from pedido
    `,
  );
  if (!resultado?.aceitos) throw new ErroApp("pedido_nao_encontrado", 404);
}

// Recusado some das duas listas; quem pediu pode pedir de novo (A10).
export async function recusarPedido(banco: Banco, eu: string, pedidoId: string): Promise<void> {
  const recusados = await banco
    .update(pedidoAmizade)
    .set({ status: "recusado" })
    .where(and(eq(pedidoAmizade.id, pedidoId), eq(pedidoAmizade.para, eu), eq(pedidoAmizade.status, "pendente")))
    .returning({ id: pedidoAmizade.id });
  if (recusados.length === 0) throw new ErroApp("pedido_nao_encontrado", 404);
}

// Qualquer um dos dois desfaz (AC 4). Desfazer conta como recusa de quem desfez
// (A10): fica um pedido do outro para mim como recusado, então o outro não
// volta como sugestão (gate da 1.4, PROD-001) mas pode pedir de novo. Um
// pedido meu que sobrou de uma corrida sai junto, para não reabrir a amizade
// sozinho (gate da 1.3, REL-004). Tudo numa instrução (A9).
export async function desfazerAmizade(banco: Banco, eu: string, outro: string): Promise<void> {
  const [resultado] = await linhas<{ desfeitas: number }>(
    banco,
    sql`
      with
        desfeita as (
          delete from ${amizade}
          where usuario_a = least(${eu}, ${outro}) and usuario_b = greatest(${eu}, ${outro})
          returning 1
        ),
        sobra as (
          delete from ${pedidoAmizade}
          where de = ${eu} and para = ${outro} and exists (select 1 from desfeita)
          returning 1
        ),
        recusa as (
          insert into ${pedidoAmizade} (id, de, para, status)
          select ${crypto.randomUUID()}, ${outro}, ${eu}, 'recusado'
          where exists (select 1 from desfeita)
          on conflict (de, para) do update set status = 'recusado'
          returning 1
        )
      select count(*)::int as desfeitas from desfeita
    `,
  );
  if (!resultado?.desfeitas) throw new ErroApp("nao_sao_amigos", 404);
}

export async function listarAmigos(banco: Banco, eu: string): Promise<(Pessoa & { desde: Date })[]> {
  const outro = sql`case when ${amizade.usuarioA} = ${eu} then ${amizade.usuarioB} else ${amizade.usuarioA} end`;
  return banco
    .select({ ...colunasPessoa, desde: amizade.criadaEm })
    .from(amizade)
    .innerJoin(user, eq(user.id, outro))
    .where(or(eq(amizade.usuarioA, eu), eq(amizade.usuarioB, eu)))
    .orderBy(sql`lower(${user.name})`);
}

// Pedido pendente que vale: entre quem ainda não é amigo. Numa corrida (pedir
// de novo por uma aba antiga enquanto o outro aceita) pode sobrar um pedido
// entre amigos; ele não aparece nem conta (gate da 1.3, REL-004).
const pendenteValido = and(
  eq(pedidoAmizade.status, "pendente"),
  sql`not exists (
    select 1 from ${amizade} a
    where a.usuario_a = least(${pedidoAmizade.de}, ${pedidoAmizade.para})
      and a.usuario_b = greatest(${pedidoAmizade.de}, ${pedidoAmizade.para})
  )`,
);

export async function listarPedidos(banco: Banco, eu: string): Promise<{ recebidos: PedidoComPessoa[]; enviados: PedidoComPessoa[] }> {
  const colunas = { pedidoId: pedidoAmizade.id, criadoEm: pedidoAmizade.criadoEm, ...colunasPessoa };
  const [recebidos, enviados] = await Promise.all([
    banco
      .select(colunas)
      .from(pedidoAmizade)
      .innerJoin(user, eq(user.id, pedidoAmizade.de))
      .where(and(eq(pedidoAmizade.para, eu), pendenteValido))
      .orderBy(desc(pedidoAmizade.criadoEm)),
    banco
      .select(colunas)
      .from(pedidoAmizade)
      .innerJoin(user, eq(user.id, pedidoAmizade.para))
      .where(and(eq(pedidoAmizade.de, eu), pendenteValido))
      .orderBy(desc(pedidoAmizade.criadoEm)),
  ]);
  return { recebidos, enviados };
}

export function contarPedidosRecebidos(banco: Banco, eu: string): Promise<number> {
  return banco.$count(pedidoAmizade, and(eq(pedidoAmizade.para, eu), pendenteValido));
}
