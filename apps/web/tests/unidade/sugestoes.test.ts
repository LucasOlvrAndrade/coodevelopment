// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pedidoAmizade } from "@/servidor/db/schema";
import { aceitarPedido, desfazerAmizade, pedirAmizade, recusarPedido } from "@/servidor/dominio/amizade";
import { filtrarSugestoes, MAX_PAGINAS, mutuosComConta, sugerirMutuos, type GithubMutuos } from "@/servidor/dominio/sugestoes";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

type Conta = { id: number; login: string };

let teste: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const banco = () => teste.banco;

// GitHub de mentira: listas paginadas de 100 e as conferências um a um,
// com o registro de cada chamada.
function githubFalso(seguidores: Conta[], seguindo: Conta[], contagens?: { seguidores: number; seguindo: number }) {
  const chamadas = { listar: [] as string[], sigo: [] as string[], meSegue: [] as string[] };
  const github: GithubMutuos = {
    contagens: async () => ({ login: "lucas", seguidores: contagens?.seguidores ?? seguidores.length, seguindo: contagens?.seguindo ?? seguindo.length }),
    listar: async (lista, pagina) => {
      chamadas.listar.push(`${lista}:${pagina}`);
      return (lista === "seguidores" ? seguidores : seguindo).slice((pagina - 1) * 100, pagina * 100);
    },
    sigo: async (login) => {
      chamadas.sigo.push(login);
      return seguindo.some((c) => c.login === login);
    },
    meSegue: async (login, meuLogin) => {
      chamadas.meSegue.push(`${login}->${meuLogin}`);
      return seguidores.some((c) => c.login === login);
    },
  };
  return { github, chamadas };
}

const conta = (id: number, login: string): Conta => ({ id, login });
const PAI = conta(1001, "pai-dev");
const ANA = conta(1002, "ana");
const BETO = conta(1003, "beto");
const SEM_CONTA = conta(1004, "sem-conta");

beforeAll(async () => {
  teste = await criarBancoDeTeste();
}, 60_000);

afterAll(async () => {
  await teste?.fechar();
});

beforeEach(async () => {
  await teste.limpar();
  await criarUsuario(banco(), "lucas", "lucas", "Lucas", 1000);
  await criarUsuario(banco(), "pai", PAI.login, "Pai", PAI.id);
  await criarUsuario(banco(), "ana", ANA.login, "Ana", ANA.id);
  await criarUsuario(banco(), "beto", BETO.login, "Beto", BETO.id);
});

describe("sugestões de mútuos (AC 1 e 3)", () => {
  it("só os mútuos com conta no app, por nome", async () => {
    // Sigo pai, ana e sem-conta; me seguem pai, ana, beto e sem-conta.
    const { github } = githubFalso([PAI, ANA, BETO, SEM_CONTA], [PAI, ANA, SEM_CONTA]);
    const sugestoes = await sugerirMutuos(banco(), "lucas", github);
    expect(sugestoes).toEqual([
      { id: "ana", login: "ana", nome: "Ana", foto: null },
      { id: "pai", login: "pai-dev", nome: "Pai", foto: null },
    ]);
  });

  it("amigos, pedidos pendentes nos dois sentidos e recusados ficam fora", async () => {
    await criarUsuario(banco(), "caio", "caio", "Caio", 1005);
    const CAIO = conta(1005, "caio");
    await pedirAmizade(banco(), "pai", "lucas");
    await aceitarPedido(banco(), "lucas", (await banco().select().from(pedidoAmizade))[0]!.id); // pai é amigo
    await pedirAmizade(banco(), "lucas", "ana"); // enviado
    await pedirAmizade(banco(), "beto", "lucas"); // recebido
    await pedirAmizade(banco(), "lucas", "caio");
    const pedidoCaio = (await banco().select().from(pedidoAmizade)).find((p) => p.para === "caio")!;
    await recusarPedido(banco(), "caio", pedidoCaio.id); // caio recusou

    const todos = [PAI, ANA, BETO, CAIO];
    const { github } = githubFalso(todos, todos);
    expect(await sugerirMutuos(banco(), "lucas", github)).toEqual([]);
  });

  it("quem desfez a amizade não volta como sugestão para nenhum dos dois (PROD-001)", async () => {
    await pedirAmizade(banco(), "pai", "lucas");
    await aceitarPedido(banco(), "lucas", (await banco().select().from(pedidoAmizade))[0]!.id);
    await desfazerAmizade(banco(), "lucas", "pai");
    const { github } = githubFalso([PAI], [PAI]);
    expect(await sugerirMutuos(banco(), "lucas", github)).toEqual([]);
    const doPai = githubFalso([conta(1000, "lucas")], [conta(1000, "lucas")]);
    expect(await sugerirMutuos(banco(), "pai", doPai.github)).toEqual([]);
  });

  it("a parte do GitHub e o filtro do banco se separam (o filtro vale na hora, sem o GitHub)", async () => {
    const { github, chamadas } = githubFalso([PAI, ANA], [PAI, ANA]);
    const mutuos = await mutuosComConta(banco(), "lucas", github);
    expect(mutuos.map((p) => p.id)).toEqual(["ana", "pai"]);
    await pedirAmizade(banco(), "lucas", "ana");
    const antes = chamadas.sigo.length + chamadas.meSegue.length;
    expect((await filtrarSugestoes(banco(), "lucas", mutuos)).map((p) => p.id)).toEqual(["pai"]);
    expect(chamadas.sigo.length + chamadas.meSegue.length).toBe(antes);
  });

  it("uma conferência que falha só tira aquela pessoa (REL-001)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { github } = githubFalso([PAI, ANA], [PAI, ANA]);
    // Listas do mesmo tamanho: a menor é a de seguidos, e a conferência é "me segue".
    github.meSegue = async (login) => {
      if (login === "ana") throw Object.assign(new Error("secondary rate limit"), { status: 403 });
      return true;
    };
    expect((await sugerirMutuos(banco(), "lucas", github)).map((p) => p.id)).toEqual(["pai"]);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("mutuo_nao_conferido"));
    aviso.mockRestore();
  });

  it("sem seguidores ou sem seguidos, nem lista", async () => {
    const { github, chamadas } = githubFalso([PAI], []);
    expect(await sugerirMutuos(banco(), "lucas", github)).toEqual([]);
    expect(chamadas.listar).toEqual([]);
  });
});

describe("contas que seguem muita gente (AC 4)", () => {
  const muitos = (inicio: number, quantos: number) => Array.from({ length: quantos }, (_, i) => conta(inicio + i, `pessoa${inicio + i}`));

  it("busca inteira só a lista menor e confere a outra direção só de quem tem conta", async () => {
    // Sigo 250 (pai na página 3); me seguem 900 (inclui o pai).
    const seguindo = [...muitos(5000, 240), PAI, ...muitos(6000, 9)];
    const seguidores = [...muitos(7000, 899), PAI];
    const { github, chamadas } = githubFalso(seguidores, seguindo);
    expect((await sugerirMutuos(banco(), "lucas", github)).map((p) => p.id)).toEqual(["pai"]);
    expect(chamadas.listar.sort()).toEqual(["seguindo:1", "seguindo:2", "seguindo:3"]);
    expect(chamadas.meSegue).toEqual(["pai-dev->lucas"]);
    expect(chamadas.sigo).toEqual([]);
  });

  it("quando a lista menor é a de seguidores, confere se eu sigo", async () => {
    const { github, chamadas } = githubFalso([ANA], [...muitos(5000, 300), ANA]);
    expect((await sugerirMutuos(banco(), "lucas", github)).map((p) => p.id)).toEqual(["ana"]);
    expect(chamadas.listar).toEqual(["seguidores:1"]);
    expect(chamadas.sigo).toEqual(["ana"]);
  });

  it(`para em ${MAX_PAGINAS} páginas e avisa no log`, async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { github, chamadas } = githubFalso([], [], { seguidores: 9000, seguindo: 8000 });
    expect(await sugerirMutuos(banco(), "lucas", github)).toEqual([]);
    expect(chamadas.listar).toHaveLength(MAX_PAGINAS);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("mutuos_lista_cortada"));
    aviso.mockRestore();
  });

  it("casa pelo id do GitHub e usa o login atual dele na conferência", async () => {
    // O pai trocou de login no GitHub e ainda não entrou de novo no app.
    const renomeado = conta(PAI.id, "pai-novo");
    const { github, chamadas } = githubFalso([renomeado], [renomeado, ANA]);
    expect((await sugerirMutuos(banco(), "lucas", github)).map((p) => p.login)).toEqual(["pai-dev"]);
    expect(chamadas.sigo).toEqual(["pai-novo"]);
  });
});
