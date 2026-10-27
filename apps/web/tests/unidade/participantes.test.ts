// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jam, participante } from "@/servidor/db/schema";
import { aceitarPedido, pedirAmizade } from "@/servidor/dominio/amizade";
import { listarJams } from "@/servidor/dominio/jam";
import {
  chamarAmigo,
  colocarNoRepositorio,
  dadosParaColocar,
  type GithubColaboracao,
  type GithubConvites,
} from "@/servidor/dominio/participantes";
import { pedidoAmizade } from "@/servidor/db/schema";
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
  const [pedido] = await banco().select().from(pedidoAmizade).where(eq(pedidoAmizade.para, b));
  await aceitarPedido(banco(), b, pedido!.id);
}

beforeEach(async () => {
  await teste.limpar();
  for (const [id, login] of [["lucas", "lucas"], ["pai", "pai-dev"], ["ana", "ana"], ["beto", "beto"], ["estranho", "estranho"]]) {
    await criarUsuario(banco(), id!, login!);
  }
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

describe("chamar amigo (AC 1)", () => {
  it("o amigo entra como convidado pendente, na próxima vaga, e a jam aparece no Início dele (AC 3)", async () => {
    expect(await chamarAmigo(banco(), "lucas", JAM, "pai")).toEqual({ vaga: 2 });
    expect(await chamarAmigo(banco(), "lucas", JAM, "ana")).toEqual({ vaga: 3 });
    const [doPai] = await listarJams(banco(), "pai");
    expect(doPai?.participantes.map((p) => [p.id, p.papel, p.colaborador])).toEqual([
      ["lucas", "criador", "ok"],
      ["pai", "convidado", "pendente"],
      ["ana", "convidado", "pendente"],
    ]);
  });

  it("no máximo 3 pessoas por jam (D6)", async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
    await chamarAmigo(banco(), "lucas", JAM, "ana");
    expect(await erroDe(chamarAmigo(banco(), "lucas", JAM, "beto"))).toEqual({ codigo: "jam_cheia", status: 409 });
  });

  it("dois chamados ao mesmo tempo não passam de 3 (A12)", async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
    const resultados = await Promise.allSettled([chamarAmigo(banco(), "lucas", JAM, "ana"), chamarAmigo(banco(), "lucas", JAM, "beto")]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await banco().select().from(participante)).toHaveLength(3);
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
  const pai = { id: "pai", login: "pai-dev" };

  function github(opcoes: { conviteId?: number | null; falha?: Error; aceita?: boolean | Error }) {
    const chamadas: string[] = [];
    const criador: GithubColaboracao = {
      adicionarColaborador: async (owner, repo, login) => {
        chamadas.push(`colaborador ${owner}/${repo} ${login}`);
        if (opcoes.falha) throw opcoes.falha;
        return { conviteId: opcoes.conviteId === undefined ? 42 : opcoes.conviteId };
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

  async function estadoDoPai() {
    const [linha] = await banco().select({ c: participante.colaborador }).from(participante).where(eq(participante.usuarioId, "pai"));
    return linha?.c;
  }

  beforeEach(async () => {
    await chamarAmigo(banco(), "lucas", JAM, "pai");
  });

  it("convite aceito em nome do amigo: ok", async () => {
    const { criador, convidado, chamadas } = github({});
    expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toBe("ok");
    expect(chamadas).toEqual(["colaborador lucas/projeto pai-dev", "aceitar 42"]);
    expect(await estadoDoPai()).toBe("ok");
  });

  it("já era colaborador (204): ok, sem convite para aceitar", async () => {
    const { criador, convidado, chamadas } = github({ conviteId: null });
    expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toBe("ok");
    expect(chamadas).toEqual(["colaborador lucas/projeto pai-dev"]);
  });

  it("o GitHub não deixa aceitar por ele (ou o token dele venceu): pendente", async () => {
    for (const aceita of [false, new Error("reautenticar")]) {
      const { criador, convidado } = github({ aceita });
      expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toBe("pendente");
      expect(await estadoDoPai()).toBe("pendente");
    }
  });

  it("erro do GitHub ao adicionar: falhou, e o participante fica com estado claro (AC 4)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { criador, convidado } = github({ falha: Object.assign(new Error("limite"), { status: 403 }) });
    expect(await colocarNoRepositorio(banco(), daJam, pai, criador, convidado)).toBe("falhou");
    expect(await estadoDoPai()).toBe("falhou");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("colaborador_falhou"));
    log.mockRestore();
  });

  it("os dados para tentar de novo só saem para o criador", async () => {
    expect(await dadosParaColocar(banco(), "lucas", JAM, "pai")).toEqual({ daJam, amigo: pai, colaborador: "pendente" });
    expect(await erroDe(dadosParaColocar(banco(), "pai", JAM, "pai"))).toEqual({ codigo: "jam_nao_encontrada", status: 404 });
    expect(await erroDe(dadosParaColocar(banco(), "lucas", JAM, "lucas"))).toEqual({ codigo: "jam_nao_encontrada", status: 404 });
  });
});
