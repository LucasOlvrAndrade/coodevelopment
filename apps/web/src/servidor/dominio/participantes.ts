import { and, eq, sql, type SQL } from "drizzle-orm";
import { amizade, jam, participante, user } from "@/servidor/db/schema";
import { ErroApp } from "@/servidor/erros";
import type { Banco } from "./amizade";

// Chamar amigos para a jam (Story 2.3). Duas etapas: a vaga no banco
// (chamarAmigo) e o acesso ao repositório no GitHub (colocarNoRepositorio).
// A vaga vem antes: assim o limite de 3 (D6) e o "só amigos" (FR6) valem
// mesmo se o GitHub falhar, e o participante nunca fica pela metade sem
// estado (pendente, ok ou falhou).

export type EstadoColaborador = "ok" | "pendente" | "falhou";

export interface GithubColaboracao {
  // Com o token do criador. 201 traz o convite; 204 quando já é colaborador.
  adicionarColaborador(owner: string, repo: string, login: string): Promise<{ conviteId: number | null }>;
}

export interface GithubConvites {
  // Com o token do amigo. false quando o GitHub não deixa aceitar por ele.
  aceitarConvite(conviteId: number): Promise<boolean>;
}

async function linhas<T>(banco: Banco, consulta: SQL): Promise<T[]> {
  return ((await banco.execute(consulta)) as unknown as { rows: T[] }).rows;
}

function violacaoUnica(e: unknown): string | null {
  for (let atual = e as { code?: string; constraint?: string; cause?: unknown } | undefined; atual; atual = atual.cause as typeof atual) {
    if (atual.code === "23505") return atual.constraint ?? "";
  }
  return null;
}

// Só o criador chama, só amigo (FR6), no máximo 3 pessoas (D6). A vaga livre
// sai numa instrução só; se outro chamado pegou a mesma vaga ao mesmo tempo,
// o índice único recusa e a regra tenta a próxima (A12).
export async function chamarAmigo(banco: Banco, eu: string, jamId: string, amigoId: string): Promise<{ vaga: number }> {
  const [daJam] = await banco.select({ criadorId: jam.criadorId, estado: jam.estado }).from(jam).where(eq(jam.id, jamId)).limit(1);
  if (!daJam || daJam.criadorId !== eu) throw new ErroApp("jam_nao_encontrada", 404);
  if (daJam.estado !== "aberta") throw new ErroApp("jam_fechada", 409);
  if (amigoId === eu) throw new ErroApp("ja_participa", 409);

  const [amigos] = await banco
    .select({ desde: amizade.criadaEm })
    .from(amizade)
    .where(and(eq(amizade.usuarioA, sql`least(${eu}, ${amigoId})`), eq(amizade.usuarioB, sql`greatest(${eu}, ${amigoId})`)))
    .limit(1);
  if (!amigos) throw new ErroApp("so_amigos", 403);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const [nova] = await linhas<{ vaga: number }>(
        banco,
        sql`
          insert into ${participante} (jam_id, usuario_id, papel, colaborador, vaga)
          select ${jamId}, ${amigoId}, 'convidado', 'pendente', livre.vaga
          from (
            select min(s)::smallint as vaga from generate_series(1, 3) s
            where s not in (select vaga from ${participante} where jam_id = ${jamId})
          ) livre
          where livre.vaga is not null
          returning vaga
        `,
      );
      if (!nova) throw new ErroApp("jam_cheia", 409);
      return { vaga: nova.vaga };
    } catch (e) {
      const restricao = violacaoUnica(e);
      if (restricao === "participante_jam_usuario") throw new ErroApp("ja_participa", 409);
      if (restricao !== "participante_jam_vaga") throw e;
    }
  }
  throw new ErroApp("jam_cheia", 409);
}

// Colaborador no GitHub e aceite do convite em nome do amigo (FR5). Sem aceite
// automático (o GitHub não deixa, ou o token do amigo venceu), fica pendente e
// o amigo vê o link do convite. Erro do GitHub fica como falhou, com "tentar de
// novo" para o criador (front-end spec).
export async function colocarNoRepositorio(
  banco: Banco,
  daJam: { id: string; repoOwner: string; repoNome: string },
  amigo: { id: string; login: string },
  criador: GithubColaboracao,
  convidado: GithubConvites,
): Promise<EstadoColaborador> {
  let estado: EstadoColaborador;
  try {
    const { conviteId } = await criador.adicionarColaborador(daJam.repoOwner, daJam.repoNome, amigo.login);
    estado = conviteId === null || (await convidado.aceitarConvite(conviteId).catch(() => false)) ? "ok" : "pendente";
  } catch (e) {
    console.error(JSON.stringify({ nivel: "erro", evento: "colaborador_falhou", jam: daJam.id, erro: String(e) }));
    estado = "falhou";
  }
  await banco
    .update(participante)
    .set({ colaborador: estado })
    .where(and(eq(participante.jamId, daJam.id), eq(participante.usuarioId, amigo.id)));
  return estado;
}

// O que as Server Actions precisam para chamar o GitHub: a jam (só do criador) e o amigo.
export async function dadosParaColocar(banco: Banco, eu: string, jamId: string, amigoId: string) {
  const [linha] = await banco
    .select({
      repoOwner: jam.repoOwner,
      repoNome: jam.repoNome,
      criadorId: jam.criadorId,
      login: user.login,
      colaborador: participante.colaborador,
    })
    .from(participante)
    .innerJoin(jam, eq(jam.id, participante.jamId))
    .innerJoin(user, eq(user.id, participante.usuarioId))
    .where(and(eq(participante.jamId, jamId), eq(participante.usuarioId, amigoId), eq(participante.papel, "convidado")))
    .limit(1);
  if (!linha || linha.criadorId !== eu) throw new ErroApp("jam_nao_encontrada", 404);
  return {
    daJam: { id: jamId, repoOwner: linha.repoOwner, repoNome: linha.repoNome },
    amigo: { id: amigoId, login: linha.login },
    colaborador: linha.colaborador,
  };
}
