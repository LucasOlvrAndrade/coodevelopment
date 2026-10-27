// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jam, participante } from "@/servidor/db/schema";
import { ErroApp } from "@/servidor/erros";
import {
  criarJam,
  criarJamComRepositorioNovo,
  gerarIdJam,
  listarJams,
  listarRepositorios,
  nomeDeRepositorioValido,
  type GithubRepositorios,
  type Repositorio,
} from "@/servidor/dominio/jam";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

let teste: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const banco = () => teste.banco;

const LUCAS = { id: "lucas", githubId: 1000 };
const PAI = { id: "pai", githubId: 1001 };

type RepoFalso = { id: number; owner: string; ownerId: number; nome: string; branchPadrao: string; sha: string | null };

// GitHub de mentira com os repositórios dados (nomes sem diferença de maiúscula, como no GitHub).
function githubFalso(repos: RepoFalso[], paginas?: Repositorio[][], selecao: "all" | "selected" | null = "all") {
  const pedidas: number[] = [];
  const criados: string[] = [];
  const github: GithubRepositorios = {
    criar: async (nome, privado) => {
      if (repos.some((r) => r.nome.toLowerCase() === nome.toLowerCase())) throw new ErroApp("repositorio_ja_existe", 422);
      criados.push(`${nome}:${privado ? "privado" : "público"}`);
      const novo = { id: 9000 + repos.length, owner: "LucasOlvrAndrade", ownerId: 1000, nome, branchPadrao: "main", sha: "inicial1" };
      repos.push(novo);
      return { id: novo.id, owner: novo.owner, ownerId: novo.ownerId, nome, branchPadrao: "main" };
    },
    instalacao: async () => ({ id: selecao ? 77 : null, selecao }),
    listar: async (pagina) => {
      pedidas.push(pagina);
      return paginas?.[pagina - 1] ?? [];
    },
    buscar: async (owner, nome) => {
      const r = repos.find((x) => x.owner.toLowerCase() === owner.toLowerCase() && x.nome.toLowerCase() === nome.toLowerCase());
      return r ? { id: r.id, owner: r.owner, ownerId: r.ownerId, nome: r.nome, branchPadrao: r.branchPadrao } : null;
    },
    shaDaBranch: async (owner, nome) => repos.find((x) => x.owner === owner && x.nome === nome)?.sha ?? null,
  };
  return { github, pedidas, criados };
}

const projeto: RepoFalso = { id: 500, owner: "LucasOlvrAndrade", ownerId: 1000, nome: "projeto", branchPadrao: "main", sha: "abc123" };

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

  it("o índice segura duas criações ao mesmo tempo no mesmo repositório, e o perdedor recebe jam_ja_existe", async () => {
    const { github } = githubFalso([projeto]);
    const resultados = await Promise.allSettled([
      criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }),
      criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const perdedor = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(perdedor.reason).toMatchObject({ codigo: "jam_ja_existe", status: 409 });
    expect(await banco().select().from(jam)).toHaveLength(1);
    expect(await banco().select().from(participante)).toHaveLength(1);
  });

  it("a jam aberta vale pelo id do repositório: renomear não abre outra, e um repositório novo com o nome antigo pode (REL-001)", async () => {
    const { github } = githubFalso([projeto]);
    await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    // Renomeado no GitHub: mesmo id, nome novo.
    const renomeado = githubFalso([{ ...projeto, nome: "app" }]);
    expect(await erroDe(criarJam(banco(), LUCAS, renomeado.github, { owner: "LucasOlvrAndrade", repo: "app" }))).toEqual({
      codigo: "jam_ja_existe",
      status: 409,
    });
    // Outro repositório com o nome antigo: id diferente.
    const novoComNomeAntigo = githubFalso([{ ...projeto, id: 777 }]);
    await criarJam(banco(), LUCAS, novoComNomeAntigo.github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    expect(await banco().select().from(jam)).toHaveLength(2);
  });

  it("importar também exige a instalação com All repositories (SEC-001)", async () => {
    const { github } = githubFalso([projeto], undefined, "selected");
    expect(await erroDe(criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" }))).toEqual({
      codigo: "instalacao_parcial",
      status: 409,
    });
    expect(await banco().select().from(jam)).toEqual([]);
  });

  it("id repetido tenta outro e grava (TEST-001)", async () => {
    const { github } = githubFalso([projeto, { ...projeto, id: 501, nome: "outro" }]);
    const real = crypto.getRandomValues.bind(crypto);
    // Os primeiros bytes saem zerados: o id "2222-2222" se repete na segunda jam.
    let zerados = 1;
    const sorteio = vi.spyOn(crypto, "getRandomValues").mockImplementation(((arr: Uint8Array) => {
      if (zerados-- > 0) return arr.fill(0);
      return real(arr);
    }) as unknown as typeof crypto.getRandomValues);
    const primeira = await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "projeto" });
    zerados = 1;
    const segunda = await criarJam(banco(), LUCAS, github, { owner: "LucasOlvrAndrade", repo: "outro" });
    sorteio.mockRestore();
    expect(primeira.id).toBe("2222-2222");
    expect(segunda.id).not.toBe("2222-2222");
    expect(await banco().select().from(jam)).toHaveLength(2);
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
    const outro: RepoFalso = { ...projeto, id: 501, nome: "outro", sha: "def456" };
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

describe("criar jam com repositório novo (Story 2.2)", () => {
  const semEspera = async () => {};

  it("valida o nome como o GitHub", () => {
    for (const ok of ["projeto", "meu-app_2", "site.github.io", "a".repeat(100)]) expect(nomeDeRepositorioValido(ok)).toBe(true);
    for (const ruim of ["", ".", "..", "com espaço", "acentuação", "a/b", "a".repeat(101)]) expect(nomeDeRepositorioValido(ruim)).toBe(false);
  });

  it("cria o repositório na conta, com commit inicial, e a jam ligada a ele (AC 2 e 3)", async () => {
    const { github, criados } = githubFalso([]);
    const { id } = await criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "novo-app", privado: true }, semEspera);
    expect(criados).toEqual(["novo-app:privado"]);
    expect((await banco().select().from(jam))[0]).toMatchObject({ id, repoNome: "novo-app", baseSha: "inicial1", criadorId: "lucas" });
    expect((await listarJams(banco(), "lucas")).map((j) => j.id)).toEqual([id]);
  });

  it("nome repetido dá erro claro e não cria nada (AC 4)", async () => {
    const { github, criados } = githubFalso([projeto]);
    expect(await erroDe(criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "Projeto", privado: false }, semEspera))).toEqual({
      codigo: "repositorio_ja_existe",
      status: 422,
    });
    expect(criados).toEqual([]);
    expect(await banco().select().from(jam)).toEqual([]);
  });

  it("nome inválido não chega ao GitHub", async () => {
    const { github, criados } = githubFalso([]);
    expect(await erroDe(criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "com espaço", privado: true }, semEspera))).toEqual({
      codigo: "nome_repositorio_invalido",
      status: 400,
    });
    expect(criados).toEqual([]);
  });

  it("instalação só em alguns repositórios: avisa com o link e não cria (pendência 2 da 1.2)", async () => {
    const { github, criados } = githubFalso([], undefined, "selected");
    const erro = await criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "novo", privado: true }, semEspera).catch((e) => e);
    expect(erro).toMatchObject({ codigo: "instalacao_parcial", status: 409 });
    expect(erro.message).toContain("https://github.com/settings/installations/77");
    expect(criados).toEqual([]);
  });

  it("sem instalação na conta, pede para entrar de novo", async () => {
    const { github } = githubFalso([], undefined, null);
    expect(await erroDe(criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "novo", privado: true }, semEspera))).toEqual({
      codigo: "instalacao_ausente",
      status: 409,
    });
  });

  it("espera o commit inicial aparecer, tentando de novo", async () => {
    const { github } = githubFalso([]);
    let tentativas = 0;
    const original = github.shaDaBranch;
    github.shaDaBranch = async (...args) => (++tentativas < 3 ? null : original(...args));
    const esperas: number[] = [];
    await criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "lento", privado: true }, async (ms) => {
      esperas.push(ms);
    });
    expect(tentativas).toBe(3);
    expect(esperas).toEqual([400, 800]);
  });

  it("repositório criado e jam com falha: a mensagem manda importar, e nada é apagado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { github, criados } = githubFalso([]);
    github.shaDaBranch = async () => null;
    const erro = await criarJamComRepositorioNovo(banco(), LUCAS, github, { nome: "sem-commit", privado: true }, semEspera).catch((e) => e);
    expect(erro).toMatchObject({ codigo: "repositorio_criado_sem_jam" });
    expect(erro.message).toContain("LucasOlvrAndrade/sem-commit");
    expect(criados).toEqual(["sem-commit:privado"]);
    expect(await banco().select().from(jam)).toEqual([]);
    log.mockRestore();
  });
});
