// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jam, participante, pedidoAmizade } from "@/servidor/db/schema";
import { aceitarPedido, desfazerAmizade, pedirAmizade } from "@/servidor/dominio/amizade";
import { listarJams } from "@/servidor/dominio/jam";
import {
  chamarAmigo,
  colocarNoRepositorio,
  dadosParaColocar,
  sincronizarPendentes,
  type GithubColaboracao,
  type GithubConvites,
} from "@/servidor/dominio/participantes";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

let teste: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const banco = () => teste.banco;
const JAM = "k7m2-rbq9";

beforeAll(async () => {
  teste = await criarBancoDeTeste();
}, 60_000);

afterAll(async () => {
  await teste?.fechar();
});

async function amigos(a: string, b: string) {
  await pedirAmizade(banco(), a, b);
  const [pedido] = await banco().select().from(pedidoAmizade).where(and(eq(pedidoAmizade.de, a), eq(pedidoAmizade.para, b)));
  await aceitarPedido(banco(), b, pedido!.id);
}

beforeEach(async () => {
  await teste.limpar();
  const contas: [string, string, number][] = [
    ["lucas", "lucas", 1000],
    ["pai", "pai-dev", 1001],
    ["ana", "ana", 1002],
    ["beto", "beto", 1003],
    ["estranho", "estranho", 1004],
  ];
  for (const [id, login, githubId] of contas) await criarUsuario(banco(), id, login, id, githubId);
  await banco().insert(jam).values({
    id: JAM,
    nome: "projeto",
    repoId: 500,
    repoOwner: "lucas",
    repoNome: "projeto",
    branch: "main",
    criadorId: "lucas",
    baseSha: "abc",
  });
  await banco().insert(participante).values({ jamId: JAM, usuarioId: "lucas", papel: "criador", colaborador: "ok", vaga: 1 });
  await amigos("lucas", "pai");
  await amigos("lucas", "ana");
  await amigos("lucas", "beto");
});

async function erroDe(promessa: Promise<unknown>) {
  return promessa.then(
    () => null,
    (e: { codigo?: string; status?: number }) => ({ codigo: e.codigo, status: e.status }),
  );
}

async function estadoDe(usuarioId: string) {
  const [linha] = await banco().select({ c: participante.colaborador }).from(participante).where(eq(participante.usuarioId, usuarioId));
  return linha?.c;
}

describe("chamar amigo (AC 1)", () => {
  it("o amigo entra na próxima vaga como não adicionado, e a jam aparece no Início dele (AC 3)", async () => {
    expect(await chamarAmigo(banco(), "lucas", JAM, "pai")).toEqual({ vaga: 2 });
    expect(await chamarAmigo(banco(), "lucas", JAM, "ana")).toEqual({ vaga: 3 });
    const [doPai] = await listarJams(banco(), "pai");
    // Nasce "falhou" (não adicionado) até o GitHub responder (gate da 2.3, REL-001).
    expect(doPai?.participantes.map((p) => [p.id, p.papel, p.colaborador])).toEqual([
      ["lucas", "criador", "ok"],
      ["pai", "convidado", "falhou"],
      ["ana", "convidado", "falhou"],
    ]);
  });

  it("no máximo 3 pessoas por jam (D6)", async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
    await chamarAmigo(banco(), "lucas", JAM, "ana");
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "beto"))).toEqual({ codigo: "jam_cheia", status: 409 });
  });

  it("vaga pega por outro chamado ao mesmo tempo: o índice recusa e a regra tenta a próxima (A12)", async () => {
    // O PGlite roda uma instrução por vez; a corrida é simulada com o 23505
    // que o Postgres devolve quando dois inserts calculam a mesma vaga.
    const real = banco().execute.bind(banco());
    const textoDe = (consulta: unknown) =>
      ((consulta as { queryChunks?: unknown[] }).queryChunks ?? [])
        .map((pedaco) => (pedaco && Array.isArray((pedaco as { value?: unknown }).value) ? (pedaco as { value: string[] }).value.join("") : ""))
        .join("");
    let inserts = 0;
    const execute = vi.spyOn(banco(), "execute").mockImplementation((async (consulta: Parameters<typeof real>[0]) => {
      if (textoDe(consulta).includes("insert into") && inserts++ === 0) {
        throw Object.assign(new Error("duplicate key"), { cause: { code: "23505", constraint: "participante_jam_vaga" } });
      }
      return real(consulta);
    }) as typeof real);
    try {
      expect(await chamarAmigo(banco(), "lucas", JAM, "pai")).toEqual({ vaga: 2 });
      expect(inserts).toBe(2);
    } finally {
      execute.mockRestore();
    }
  });

  it("vaga que vagou é usada de novo", async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
    await chamarAmigo(banco(), "lucas", JAM, "ana");
    await banco().delete(participante).where(eq(participante.usuarioId, "pai"));
    expect(await chamarAmigo(banco(), "lucas", JAM, "beto")).toEqual({ vaga: 2 });
  });

  it("só amigos (FR6), só o criador, e ninguém entra duas vezes", async () => {
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "estranho"))).toEqual({ codigo: "so_amigos", status: 403 });
    expect(await erroDe(chamarAmigo(banco(), "pai", JAM, "ana"))).toEqual({ codigo: "jam_nao_encontrada", status: 404 });
    expect(await erroDe(chamarAmigo(banco(), "lucas", "nao-existe", "pai"))).toEqual({ codigo: "jam_nao_encontrada", status: 404 });
    await chamarAmigo(banco(), "lucas", JAM, "pai");
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "pai"))).toEqual({ codigo: "ja_participa", status: 409 });
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "lucas"))).toEqual({ codigo: "ja_participa", status: 409 });
  });

  it("jam fechada não recebe ninguém", async () => {
    await banco().update(jam).set({ estado: "fechada" });
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "pai"))).toEqual({ codigo: "jam_fechada", status: 409 });
  });
});

describe("colocar no repositório (AC 2 e 4)", () => {
  const daJam = { id: JAM, repoOwner: "lucas", repoNome: "projeto" };
  const pai = { id: "pai", githubId: 1001 };

  type Opcoes = {
    login?: string | null;
    convite?: { conviteId: number | null; convidadoId: number | null };
    falha?: Error;
    aceita?: boolean | Error;
    colaborador?: boolean;
    cancelamento?: Error;
  };

  function github(opcoes: Opcoes = {}) {
    const chamadas: string[] = [];
    const criador: GithubColaboracao = {
      loginAtual: async (id) => {
        chamadas.push(`login ${id}`);
        return opcoes.login === undefined ? "pai-dev" : opcoes.login;
      },
      adicionarColaborador: async (owner, repo, login) => {
        chamadas.push(`colaborador ${owner}/${repo} ${login}`);
        if (opcoes.falha) throw opcoes.falha;
        return opcoes.convite ?? { conviteId: 42, convidadoId: 1001 };
      },
      cancelarConvite: async (_o, _r, id) => {
        chamadas.push(`cancelar ${id}`);
        if (opcoes.cancelamento) throw opcoes.cancelamento;
      },
      ehColaborador: async (_o, _r, login) => {
        chamadas.push(`confere ${login}`);
        return opcoes.colaborador ?? false;
      },
    };
    const convidado: GithubConvites = {
      aceitarConvite: async (id) => {
        chamadas.push(`aceitar ${id}`);
        if (opcoes.aceita instanceof Error) throw opcoes.aceita;
        return opcoes.aceita ?? true;
      },
    };
    return { criador, convidado, chamadas };
  }

  beforeEach(async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
  });

  it("convite para o login atual (pelo id), aceito em nome do amigo: ok", async () => {
    const { criador, convidado, chamadas } = github({ login: "pai-novo" });
    expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toEqual({ estado: "ok" });
    expect(chamadas).toEqual(["login 1001", "colaborador lucas/projeto pai-novo", "aceitar 42"]);
    expect(await estadoDe("pai")).toBe("ok");
  });

  it("convite que foi para outra conta é cancelado e fica não adicionado (SEC-001)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { criador, convidado, chamadas } = github({ convite: { conviteId: 42, convidadoId: 9999 } });
    const resultado = await colocarNoRepositorio(banco(), daJam, pai, criador, convidado);
    expect(resultado.estado).toBe("falhou");
    expect(resultado.motivo).toContain("foi para outra conta");
    expect(chamadas).toContain("cancelar 42");
    expect(chamadas).not.toContain("aceitar 42");
    log.mockRestore();
  });

  it("convite errado que não deu para cancelar: fica no log com o id e a mensagem pede para cancelar à mão (SEC-003)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { criador, convidado } = github({ convite: { conviteId: 42, convidadoId: 9999 }, cancelamento: new Error("GitHub fora") });
    const resultado = await colocarNoRepositorio(banco(), daJam, pai, criador, convidado);
    expect(resultado.estado).toBe("falhou");
    expect(resultado.motivo).toContain("não deu para cancelar");
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"evento":"convite_errado_nao_cancelado"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"conviteId":42'));
    log.mockRestore();
  });

  it("conta do amigo que sumiu do GitHub: não adicionado, sem convidar ninguém", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { criador, convidado, chamadas } = github({ login: null });
    expect((await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).estado).toBe("falhou");
    expect(chamadas).toEqual(["login 1001"]);
    log.mockRestore();
  });

  it("já era colaborador (204): ok, sem convite para aceitar", async () => {
    const { criador, convidado, chamadas } = github({ convite: { conviteId: null, convidadoId: null } });
    expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toEqual({ estado: "ok" });
    expect(chamadas).not.toContain("aceitar 42");
  });

  it("o GitHub não deixa aceitar por ele (ou o token dele venceu): pendente", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const aceita of [false, new Error("reautenticar")]) {
      const { criador, convidado } = github({ aceita });
      expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toEqual({ estado: "pendente" });
      expect(await estadoDe("pai")).toBe("pendente");
    }
    aviso.mockRestore();
  });

  it("erro do GitHub ao adicionar: não adicionado, com o motivo traduzido (AC 4)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { criador, convidado } = github({ falha: Object.assign(new Error("limite"), { status: 403 }) });
    const resultado = await colocarNoRepositorio(banco(), daJam, pai, criador, convidado);
    expect(resultado.estado).toBe("falhou");
    expect(resultado.motivo).toContain("O GitHub recusou");
    expect(await estadoDe("pai")).toBe("falhou");
    log.mockRestore();
  });

  it("tentar de novo reconfere: só o criador, jam aberta e ainda amigos (SEC-002)", async () => {
    expect(await dadosParaColocar(banco(), "lucas", JAM, "pai")).toEqual({ daJam, amigo: pai, colaborador: "falhou" });
    expect(await erroDe(dadosParaColocar(banco(), "pai", JAM, "pai"))).toEqual({ codigo: "jam_nao_encontrada", status: 404 });
    await desfazerAmizade(banco(), "pai", "lucas");
    expect(await erroDe(dadosParaColocar(banco(), "lucas", JAM, "pai"))).toEqual({ codigo: "so_amigos", status: 403 });
    await amigos("lucas", "pai");
    await banco().update(jam).set({ estado: "fechada" });
    expect(await erroDe(dadosParaColocar(banco(), "lucas", JAM, "pai"))).toEqual({ codigo: "jam_fechada", status: 409 });
  });

  it("quem aceitou pelo link vira ok na próxima visita ao Início (REL-001)", async () => {
    await banco().update(participante).set({ colaborador: "pendente" }).where(eq(participante.usuarioId, "pai"));
    const aindaNao = github({ colaborador: false });
    expect(await sincronizarPendentes(banco(), "pai", () => aindaNao.criador)).toBe(0);
    expect(await estadoDe("pai")).toBe("pendente");
    const aceitou = github({ colaborador: true, login: "pai-dev" });
    expect(await sincronizarPendentes(banco(), "pai", () => aceitou.criador)).toBe(1);
    expect(await estadoDe("pai")).toBe("ok");
    expect(aceitou.chamadas).toEqual(["login 1001", "confere pai-dev"]);
  });

  it("a sincronização só olha as jams de quem abre o Início, e erro do GitHub não muda nada", async () => {
    await banco().update(participante).set({ colaborador: "pendente" }).where(eq(participante.usuarioId, "pai"));
    const { criador } = github({ colaborador: true });
    expect(await sincronizarPendentes(banco(), "estranho", () => criador)).toBe(0);
    const quebrado = github();
    quebrado.criador.ehColaborador = async () => {
      throw new Error("GitHub fora");
    };
    expect(await sincronizarPendentes(banco(), "lucas", () => quebrado.criador)).toBe(0);
    expect(await estadoDe("pai")).toBe("pendente");
  });
});
