// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { jam, participante } from "@/servidor/db/schema";
import { criarJam, gerarIdJam, listarJams, listarRepositorios, type GithubRepositorios, type Repositorio } from "@/servidor/dominio/jam";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

let teste: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const banco = () => teste.banco;

const LUCAS = { id: "lucas", githubId: 1000 };
const PAI = { id: "pai", githubId: 1001 };

type RepoFalso = { owner: string; ownerId: number; nome: string; branchPadrao: string; sha: string | null };

// GitHub de mentira com os repositórios dados (nomes sem diferença de maiúscula, como no GitHub).
function githubFalso(repos: RepoFalso[], paginas?: Repositorio[][]) {
  const pedidas: number[] = [];
  const github: GithubRepositorios = {
    listar: async (pagina) => {
      pedidas.push(pagina);
      return paginas?.[pagina - 1] ?? [];
    },
    buscar: async (owner, nome) => {
      const r = repos.find((x) => x.owner.toLowerCase() === owner.toLowerCase() && x.nome.toLowerCase() === nome.toLowerCase());
      return r ? { owner: r.owner, ownerId: r.ownerId, nome: r.nome, branchPadrao: r.branchPadrao } : null;
    },
    shaDaBranch: async (owner, nome) => repos.find((x) => x.owner === owner && x.nome === nome)?.sha ?? null,
  };
  return { github, pedidas };
}

const projeto: RepoFalso = { owner: "LucasOlvrAndrade", ownerId: 1000, nome: "projeto", branchPadrao: "main", sha: "abc123" };

beforeAll(async () => {
  teste = await criarBancoDeTeste();
}, 60_000);

afterAll(async () => {
  await teste?.fechar();
});

beforeEach(async () => {
  await teste.limpar();
  await criarUsuario(banco(), LUCAS.id, "LucasOlvrAndrade", "Lucas", LUCAS.githubId);
  await criarUsuario(banco(), PAI.id, "pai-dev", "Pai", PAI.githubId);
});

async function erroDe(promessa: Promise<unknown>) {
  return promessa.then(
    () => null,
    (e: { codigo?: string; status?: number }) => ({ codigo: e.codigo, status: e.status }),
  );
}

describe("id da jam", () => {
  it("tem o formato curto, sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) expect(gerarIdJam()).toMatch(/^[2-9a-hj-km-np-z]{4}-[2-9a-hj-km-np-z]{4}$/);
  });
});

describe("lista de repositórios (AC 1)", () => {
  const repo = (nome: string): Repositorio => ({ owner: "lucas", nome, privado: false, descricao: null, atualizadoEm: null });

  it("pagina até a última página incompleta", async () => {
    const cheia = Array.from({ length: 100 }, (_, i) => repo(`r${i}`));
    const { github, pedidas } = githubFalso([], [cheia, cheia, [repo("ultimo")]]);
    const lista = await listarRepositorios(github);
    expect(lista).toHaveLength(201);
    expect(pedidas).toEqual([1, 2, 3]);
  });
});

describe("criar jam (AC 2)", () => {
  it("cria com nome, repositório, branch, commit de partida e o criador como participante", async () => {
    const { github } = githubFalso([projeto]);
    const { id } = await criarJam(banco(), LUCAS, github, { owner: "lucasolvrandrade", repo: "PROJETO" });
    const [criada] = await banco().select().from(jam);
    expect(criada).toMatchObject({
      id,
      nome: "projeto",
      repoOwner: "LucasOlvrAndrade",
      repoNome: "projeto",
      branch: "main",
      baseSha: "abc123",
      criadorId: "lucas",
      estado: "aberta",
    });
    expect(await banco().select().from(participante)).toEqual([
      expect.objectContaining({ jamId: id, usuarioId: "lucas", papel: "criador", colaborador: "ok" }),
    ]);
  });

  it("repositório de outra conta é recusado, mesmo que o app o alcance", async () => {
    const { github } = githubFalso([{ ...projeto, owner: "pai-dev", ownerId: PAI.githubId }]);
    expect(await erroDe(criarJam(banco(), LUCAS, github, { owner: "pai-dev", repo: "projeto" }))).toEqual({
      codigo: "repositorio_de_outra_conta",
      status: 403,
    });
    expect(await banco().select().from(jam)).toEqual([]);
  });

  it("repositório que não existe (ou que o app não alcança) dá 404", async () => {
    const { github } = githubFalso([]);
    expect(await erroDe(criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "nada" }))).toEqual({
      codigo: "repositorio_nao_encontrado",
      status: 404,
    });
  });

  it("repositório vazio não tem commit de partida", async () => {
    const { github } = githubFalso([{ ...projeto, sha: null }]);
    expect(await erroDe(criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }))).toEqual({
      codigo: "repositorio_vazio",
      status: 400,
    });
    expect(await banco().select().from(jam)).toEqual([]);
  });

  it("uma jam aberta por repositório (A11)", async () => {
    const { github } = githubFalso([projeto]);
    await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    expect(await erroDe(criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "Projeto" }))).toEqual({
      codigo: "jam_ja_existe",
      status: 409,
    });
    expect(await banco().select().from(jam)).toHaveLength(1);
  });

  it("o índice segura duas criações ao mesmo tempo no mesmo repositório", async () => {
    const { github } = githubFalso([projeto]);
    const resultados = await Promise.allSettled([
      criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }),
      criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await banco().select().from(jam)).toHaveLength(1);
    expect(await banco().select().from(participante)).toHaveLength(1);
  });

  it("com a jam anterior fechada, o repositório aceita outra", async () => {
    const { github } = githubFalso([projeto]);
    await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    await banco().update(jam).set({ estado: "fechada" });
    await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    expect(await banco().select().from(jam)).toHaveLength(2);
  });
});

describe("Início (AC 3)", () => {
  it("lista as jams de que a pessoa participa, abertas primeiro, com os participantes", async () => {
    const outro: RepoFalso = { ...projeto, nome: "outro", sha: "def456" };
    const { github } = githubFalso([projeto, outro]);
    const primeira = await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    const segunda = await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "outro" });
    await banco().update(jam).set({ estado: "fechada" }).where((await import("drizzle-orm")).eq(jam.id, segunda.id));
    await banco().insert(participante).values({ jamId: primeira.id, usuarioId: "pai", papel: "convidado", colaborador: "ok" });

    const doLucas = await listarJams(banco(), "lucas");
    expect(doLucas.map((j) => [j.repoNome, j.estado])).toEqual([
      ["projeto", "aberta"],
      ["outro", "fechada"],
    ]);
    expect(doLucas[0]?.participantes.map((p) => [p.nome, p.papel])).toEqual([
      ["Lucas", "criador"],
      ["Pai", "convidado"],
    ]);
    expect((await listarJams(banco(), "pai")).map((j) => j.id)).toEqual([primeira.id]);
  });

  it("sem jams, lista vazia", async () => {
    expect(await listarJams(banco(), "pai")).toEqual([]);
  });
});
