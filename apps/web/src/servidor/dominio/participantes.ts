import { and, eq, sql, type SQL } from "drizzle-orm";
import { amizade, jam, participante, user } from "@/servidor/db/schema";
import { ErroApp } from "@/servidor/erros";
import type { Banco } from "./amizade";

// Chamar amigos para a jam (Story 2.3). Duas etapas: a vaga no banco
// (chamarAmigo) e o acesso ao repositório no GitHub (colocarNoRepositorio).
// A vaga vem antes: assim o limite de 3 (D6) e o "só amigos" (FR6) valem
// mesmo se o GitHub falhar, e o participante sempre tem um estado claro.

export type EstadoColaborador = "ok" | "pendente" | "falhou";
export type ResultadoColocar = { estado: EstadoColaborador; motivo?: string };

export interface GithubColaboracao {
  // Login atual da conta pelo id numérico (GET /user/{account_id}); null se a conta sumiu.
  loginAtual(githubId: number): Promise<string | null>;
  // Com o token do criador. 201 traz o convite e quem foi convidado; 204 quando já é colaborador.
  adicionarColaborador(owner: string, repo: string, login: string): Promise<{ conviteId: number | null; convidadoId: number | null }>;
  cancelarConvite(owner: string, repo: string, conviteId: number): Promise<void>;
  ehColaborador(owner: string, repo: string, login: string): Promise<boolean>;
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

const saoAmigos = (eu: string, outro: string) => sql`exists (
  select 1 from ${amizade} a
  where a.usuario_a = least(${eu}, ${outro}) and a.usuario_b = greatest(${eu}, ${outro})
)`;

// Só o criador da jam aberta, e só para amigo (FR6). Vale para chamar e para
// tentar de novo: quem desfez a amizade não é convidado de novo (A10; gate da
// 2.3, SEC-002).
async function conferirJamEAmizade(banco: Banco, eu: string, jamId: string, amigoId: string) {
  const [daJam] = await banco.select({ criadorId: jam.criadorId, estado: jam.estado }).from(jam).where(eq(jam.id, jamId)).limit(1);
  if (!daJam || daJam.criadorId !== eu) throw new ErroApp("jam_nao_encontrada", 404);
  if (daJam.estado !== "aberta") throw new ErroApp("jam_fechada", 409);
  const [r] = await linhas<{ amigos: boolean }>(banco, sql`select ${saoAmigos(eu, amigoId)} as amigos`);
  if (!r?.amigos) throw new ErroApp("so_amigos", 403);
}

// A vaga livre sai numa instrução só; se outro chamado pegou a mesma vaga ao
// mesmo tempo, o índice único recusa e a regra tenta a próxima (A12).
export async function chamarAmigo(banco: Banco, eu: string, jamId: string, amigoId: string): Promise<{ vaga: number }> {
  if (amigoId === eu) throw new ErroApp("ja_participa", 409);
  await conferirJamEAmizade(banco, eu, jamId, amigoId);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      // As condições também dentro do insert: entre conferir e gravar, a
      // amizade pode ter sido desfeita ou a jam fechada. Nasce "falhou" (não
      // adicionado): se o processo cair antes do GitHub, o criador vê o
      // "tentar de novo", não um pendente sem convite (gate da 2.3, REL-001).
      const [nova] = await linhas<{ vaga: number }>(
        banco,
        sql`
          insert into ${participante} (jam_id, usuario_id, papel, colaborador, vaga)
          select ${jamId}, ${amigoId}, 'convidado', 'falhou', livre.vaga
          from (
            select min(s)::smallint as vaga from generate_series(1, 3) s
            where s not in (select vaga from ${participante} where jam_id = ${jamId})
          ) livre
          where livre.vaga is not null
            and exists (select 1 from ${jam} j where j.id = ${jamId} and j.criador_id = ${eu} and j.estado = 'aberta')
            and ${saoAmigos(eu, amigoId)}
          returning vaga
        `,
      );
      if (nova) return { vaga: nova.vaga };
      // Nada gravado: algo mudou desde a conferência, ou a jam encheu.
      await conferirJamEAmizade(banco, eu, jamId, amigoId);
      throw new ErroApp("jam_cheia", 409);
    } catch (e) {
      const restricao = violacaoUnica(e);
      if (restricao === "participante_jam_usuario") throw new ErroApp("ja_participa", 409);
      if (restricao !== "participante_jam_vaga") throw e;
    }
  }
  throw new ErroApp("jam_cheia", 409);
}

// O motivo do "não adicionado", em português, para quem tenta de novo.
function motivoDoGithub(e: unknown): string {
  if (e instanceof ErroApp && e.codigo === "convite_para_outra_conta") return e.message;
  if (e instanceof ErroApp && e.codigo === "reautenticar") {
    return "A conexão de quem criou a jam com o GitHub venceu. Saia, entre de novo e tente outra vez.";
  }
  const status = (e as { status?: number }).status;
  if (status === 403) return 'O GitHub recusou: confira se o app continua instalado com "All repositories", ou se o limite de convites do dia acabou.';
  if (status === 404) return "O GitHub não achou o repositório ou a conta dessa pessoa.";
  if (status === 422) return "O GitHub não aceitou convidar essa pessoa para o repositório.";
  return "O GitHub não respondeu como esperado. Tente de novo daqui a pouco.";
}

// Colaborador no GitHub e aceite do convite em nome do amigo (FR5). O convite
// sai para o login atual da conta (buscado pelo id) e o convidado é conferido:
// o login guardado pode ter passado para outra pessoa (gate da 2.3, SEC-001).
// Sem aceite automático, fica pendente e o amigo vê o link do convite.
export async function colocarNoRepositorio(
  banco: Banco,
  daJam: { id: string; repoOwner: string; repoNome: string },
  amigo: { id: string; githubId: number },
  criador: GithubColaboracao,
  convidado: GithubConvites,
): Promise<ResultadoColocar> {
  let resultado: ResultadoColocar;
  try {
    const login = await criador.loginAtual(amigo.githubId);
    if (!login) throw Object.assign(new Error("conta do GitHub não encontrada"), { status: 404 });
    const { conviteId, convidadoId } = await criador.adicionarColaborador(daJam.repoOwner, daJam.repoNome, login);
    if (conviteId !== null && convidadoId !== amigo.githubId) {
      await criador.cancelarConvite(daJam.repoOwner, daJam.repoNome, conviteId).catch(() => {});
      throw new ErroApp("convite_para_outra_conta", 409, "O convite do GitHub foi para outra conta e foi cancelado. Tente de novo.");
    }
    if (conviteId === null) {
      resultado = { estado: "ok" };
    } else {
      const aceito = await convidado.aceitarConvite(conviteId).catch((e) => {
        console.warn(JSON.stringify({ nivel: "aviso", evento: "aceite_do_convite_falhou", jam: daJam.id, erro: String(e) }));
        return false;
      });
      resultado = { estado: aceito ? "ok" : "pendente" };
    }
  } catch (e) {
    console.error(JSON.stringify({ nivel: "erro", evento: "colaborador_falhou", jam: daJam.id, erro: String(e) }));
    resultado = { estado: "falhou", motivo: motivoDoGithub(e) };
  }
  await banco
    .update(participante)
    .set({ colaborador: resultado.estado })
    .where(and(eq(participante.jamId, daJam.id), eq(participante.usuarioId, amigo.id)));
  return resultado;
}

// O que as Server Actions precisam para chamar o GitHub, reconferindo jam e
// amizade (para tentar de novo também).
export async function dadosParaColocar(banco: Banco, eu: string, jamId: string, amigoId: string) {
  await conferirJamEAmizade(banco, eu, jamId, amigoId);
  const [linha] = await banco
    .select({ repoOwner: jam.repoOwner, repoNome: jam.repoNome, githubId: user.githubId, colaborador: participante.colaborador })
    .from(participante)
    .innerJoin(jam, eq(jam.id, participante.jamId))
    .innerJoin(user, eq(user.id, participante.usuarioId))
    .where(and(eq(participante.jamId, jamId), eq(participante.usuarioId, amigoId), eq(participante.papel, "convidado")))
    .limit(1);
  if (!linha) throw new ErroApp("jam_nao_encontrada", 404);
  return {
    daJam: { id: jamId, repoOwner: linha.repoOwner, repoNome: linha.repoNome },
    amigo: { id: amigoId, githubId: linha.githubId },
    colaborador: linha.colaborador,
  };
}

// Quem aceitou o convite pelo link do GitHub vira ok na próxima visita ao
// Início (gate da 2.3, REL-001): confere no GitHub, com o token de quem criou
// a jam. Falha do GitHub deixa como está.
export async function sincronizarPendentes(
  banco: Banco,
  eu: string,
  githubDoCriador: (criadorId: string) => GithubColaboracao,
): Promise<number> {
  const pendentes = await banco
    .select({
      jamId: participante.jamId,
      usuarioId: participante.usuarioId,
      githubId: user.githubId,
      repoOwner: jam.repoOwner,
      repoNome: jam.repoNome,
      criadorId: jam.criadorId,
    })
    .from(participante)
    .innerJoin(jam, eq(jam.id, participante.jamId))
    .innerJoin(user, eq(user.id, participante.usuarioId))
    .where(
      and(
        eq(participante.colaborador, "pendente"),
        sql`${participante.jamId} in (select jam_id from ${participante} where usuario_id = ${eu})`,
      ),
    );

  const conferidos = await Promise.allSettled(
    pendentes.map(async (p) => {
      const github = githubDoCriador(p.criadorId);
      const login = await github.loginAtual(p.githubId);
      if (!login || !(await github.ehColaborador(p.repoOwner, p.repoNome, login))) return false;
      await banco
        .update(participante)
        .set({ colaborador: "ok" })
        .where(and(eq(participante.jamId, p.jamId), eq(participante.usuarioId, p.usuarioId), eq(participante.colaborador, "pendente")));
      return true;
    }),
  );
  return conferidos.filter((c) => c.status === "fulfilled" && c.value).length;
}
