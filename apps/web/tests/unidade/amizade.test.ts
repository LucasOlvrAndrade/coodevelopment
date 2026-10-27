// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  aceitarPedido,
  buscarPorLogin,
  contarPedidosRecebidos,
  desfazerAmizade,
  listarAmigos,
  listarPedidos,
  normalizarLogin,
  pedirAmizade,
  recusarPedido,
} from "@/servidor/dominio/amizade";
import { sql } from "drizzle-orm";
import { amizade, pedidoAmizade } from "@/servidor/db/schema";
import { criarBancoDeTeste, criarUsuario } from "../apoio/banco-teste";

let teste: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const banco = () => teste.banco;

// Ids com maiúsculas e minúsculas misturadas, como os do Better Auth. A prova
// de que a ordem do par sai do banco está em "ordem do par", no fim.
const LUCAS = "Zl9lucas";
const PAI = "apai7Q";
const OUTRO = "Mout3ro";

beforeAll(async () => {
  teste = await criarBancoDeTeste();
}, 60_000);

afterAll(async () => {
  await teste?.fechar();
});

beforeEach(async () => {
  await teste.limpar();
  await criarUsuario(banco(), LUCAS, "LucasOlvrAndrade", "Lucas Andrade");
  await criarUsuario(banco(), PAI, "pai-dev", "Pai");
  await criarUsuario(banco(), OUTRO, "outra", "Outra Pessoa");
});

async function pedidoDe(de: string, para: string) {
  const { enviados } = await listarPedidos(banco(), de);
  const pedido = enviados.find((p) => p.id === para);
  if (!pedido) throw new Error("pedido não encontrado");
  return pedido.pedidoId;
}

async function erroDe(promessa: Promise<unknown>) {
  return promessa.then(
    () => null,
    (e: { codigo?: string; status?: number }) => ({ codigo: e.codigo, status: e.status }),
  );
}

describe("normalizarLogin", () => {
  it("aceita o usuário do GitHub com ou sem @ e com espaços em volta", () => {
    expect(normalizarLogin("@LucasOlvrAndrade")).toBe("LucasOlvrAndrade");
    expect(normalizarLogin("  pai-dev ")).toBe("pai-dev");
    expect(normalizarLogin("a".repeat(39))).toBe("a".repeat(39));
  });

  it("recusa o que não pode ser usuário do GitHub", () => {
    for (const invalido of ["", "@", "-pai", "pai-", "pai--dev", "pai dev", "pai_dev", "a".repeat(40), "lucas/x"]) {
      expect(normalizarLogin(invalido)).toBeNull();
    }
  });
});

describe("busca (AC 1)", () => {
  it("acha quem tem conta pelo usuário exato, sem diferença de maiúscula", async () => {
    const [achado] = await buscarPorLogin(banco(), LUCAS, "@PAI-DEV");
    expect(achado).toMatchObject({ id: PAI, login: "pai-dev", nome: "Pai", relacao: { tipo: "nenhuma" } });
  });

  it("não busca por prefixo, para não listar quem usa o app", async () => {
    expect(await buscarPorLogin(banco(), LUCAS, "pai")).toEqual([]);
    expect(await buscarPorLogin(banco(), LUCAS, "p")).toEqual([]);
  });

  it("quem não tem conta não aparece", async () => {
    expect(await buscarPorLogin(banco(), LUCAS, "ninguem")).toEqual([]);
  });

  it("login inválido é erro de entrada", async () => {
    expect(await erroDe(buscarPorLogin(banco(), LUCAS, "pai dev"))).toEqual({ codigo: "login_invalido", status: 400 });
  });

  it("traz as duas pessoas quando um login trocado foi pego por outra", async () => {
    await criarUsuario(banco(), "dono-antigo", "pai-dev", "Dono antigo");
    const achados = await buscarPorLogin(banco(), LUCAS, "pai-dev");
    expect(achados.map((p) => p.id).sort()).toEqual([PAI, "dono-antigo"].sort());
  });

  it("mostra a relação com cada pessoa", async () => {
    expect((await buscarPorLogin(banco(), LUCAS, "LucasOlvrAndrade"))[0]?.relacao).toEqual({ tipo: "eu" });
    await pedirAmizade(banco(), LUCAS, PAI);
    expect((await buscarPorLogin(banco(), LUCAS, "pai-dev"))[0]?.relacao).toEqual({ tipo: "pedido_enviado" });
    const pedidoId = await pedidoDe(LUCAS, PAI);
    expect((await buscarPorLogin(banco(), PAI, "lucasolvrandrade"))[0]?.relacao).toEqual({ tipo: "pedido_recebido", pedidoId });
    await aceitarPedido(banco(), PAI, pedidoId);
    expect((await buscarPorLogin(banco(), PAI, "lucasolvrandrade"))[0]?.relacao).toEqual({ tipo: "amigo" });
  });
});

describe("pedido de amizade (AC 2 e 5)", () => {
  it("fica pendente e aparece para os dois", async () => {
    expect(await pedirAmizade(banco(), LUCAS, PAI)).toBe("pedido_enviado");
    const deLucas = await listarPedidos(banco(), LUCAS);
    const doPai = await listarPedidos(banco(), PAI);
    expect(deLucas.enviados.map((p) => p.id)).toEqual([PAI]);
    expect(deLucas.recebidos).toEqual([]);
    expect(doPai.recebidos.map((p) => ({ id: p.id, nome: p.nome, login: p.login }))).toEqual([
      { id: LUCAS, nome: "Lucas Andrade", login: "LucasOlvrAndrade" },
    ]);
    expect(await contarPedidosRecebidos(banco(), PAI)).toBe(1);
    expect(await contarPedidosRecebidos(banco(), LUCAS)).toBe(0);
  });

  it("não duplica pedido", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    const primeiro = await pedidoDe(LUCAS, PAI);
    expect(await pedirAmizade(banco(), LUCAS, PAI)).toBe("pedido_enviado");
    const todos = await banco().select().from(pedidoAmizade);
    expect(todos).toHaveLength(1);
    expect(todos[0]?.id).toBe(primeiro);
  });

  it("não deixa pedir amizade a si mesmo", async () => {
    expect(await erroDe(pedirAmizade(banco(), LUCAS, LUCAS))).toEqual({ codigo: "amizade_consigo", status: 400 });
  });

  it("pessoa que não existe dá 404", async () => {
    expect(await erroDe(pedirAmizade(banco(), LUCAS, "nao-existe"))).toEqual({ codigo: "usuario_nao_encontrado", status: 404 });
  });

  it("pedido cruzado vira amizade direto, sem pedido sobrando", async () => {
    await pedirAmizade(banco(), PAI, LUCAS);
    expect(await pedirAmizade(banco(), LUCAS, PAI)).toBe("amigos");
    expect((await listarAmigos(banco(), LUCAS)).map((a) => a.id)).toEqual([PAI]);
    expect(await banco().select().from(pedidoAmizade)).toEqual([]);
  });

  it("entre amigos não cria pedido", async () => {
    await pedirAmizade(banco(), PAI, LUCAS);
    await pedirAmizade(banco(), LUCAS, PAI);
    expect(await pedirAmizade(banco(), PAI, LUCAS)).toBe("amigos");
    expect(await banco().select().from(pedidoAmizade)).toEqual([]);
  });

  it("depois de recusado, pedir de novo volta a pendente no mesmo registro", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    const pedidoId = await pedidoDe(LUCAS, PAI);
    await recusarPedido(banco(), PAI, pedidoId);
    expect(await pedirAmizade(banco(), LUCAS, PAI)).toBe("pedido_enviado");
    const { recebidos } = await listarPedidos(banco(), PAI);
    expect(recebidos.map((p) => p.pedidoId)).toEqual([pedidoId]);
  });
});

describe("aceitar e recusar (AC 3)", () => {
  it("aceitar cria a amizade nos dois lados e apaga o pedido", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    await aceitarPedido(banco(), PAI, await pedidoDe(LUCAS, PAI));
    expect((await listarAmigos(banco(), LUCAS)).map((a) => a.nome)).toEqual(["Pai"]);
    expect((await listarAmigos(banco(), PAI)).map((a) => a.nome)).toEqual(["Lucas Andrade"]);
    expect(await banco().select().from(pedidoAmizade)).toEqual([]);
    expect(await contarPedidosRecebidos(banco(), PAI)).toBe(0);
  });

  it("só quem recebeu aceita ou recusa", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    const pedidoId = await pedidoDe(LUCAS, PAI);
    for (const quem of [LUCAS, OUTRO]) {
      expect(await erroDe(aceitarPedido(banco(), quem, pedidoId))).toEqual({ codigo: "pedido_nao_encontrado", status: 404 });
      expect(await erroDe(recusarPedido(banco(), quem, pedidoId))).toEqual({ codigo: "pedido_nao_encontrado", status: 404 });
    }
    expect(await listarAmigos(banco(), LUCAS)).toEqual([]);
  });

  it("aceitar duas vezes dá 404 na segunda", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    const pedidoId = await pedidoDe(LUCAS, PAI);
    await aceitarPedido(banco(), PAI, pedidoId);
    expect(await erroDe(aceitarPedido(banco(), PAI, pedidoId))).toEqual({ codigo: "pedido_nao_encontrado", status: 404 });
  });

  it("aceitar um de dois pedidos cruzados limpa os dois", async () => {
    // Os dois pediram ao mesmo tempo: nenhum viu o pedido do outro.
    await banco().insert(pedidoAmizade).values([
      { id: "p1", de: LUCAS, para: PAI },
      { id: "p2", de: PAI, para: LUCAS },
    ]);
    await aceitarPedido(banco(), PAI, "p1");
    expect(await banco().select().from(pedidoAmizade)).toEqual([]);
    expect((await listarAmigos(banco(), PAI)).map((a) => a.id)).toEqual([LUCAS]);
  });

  it("recusar tira o pedido das listas dos dois", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    await recusarPedido(banco(), PAI, await pedidoDe(LUCAS, PAI));
    expect(await listarPedidos(banco(), PAI)).toEqual({ recebidos: [], enviados: [] });
    expect(await listarPedidos(banco(), LUCAS)).toEqual({ recebidos: [], enviados: [] });
    expect(await listarAmigos(banco(), PAI)).toEqual([]);
    expect((await buscarPorLogin(banco(), LUCAS, "pai-dev"))[0]?.relacao).toEqual({ tipo: "nenhuma" });
  });
});

describe("desfazer amizade (AC 4)", () => {
  async function amigos(a: string, b: string) {
    await pedirAmizade(banco(), a, b);
    await aceitarPedido(banco(), b, await pedidoDe(a, b));
  }

  it("qualquer um dos dois desfaz", async () => {
    await amigos(LUCAS, PAI);
    await desfazerAmizade(banco(), LUCAS, PAI);
    expect(await listarAmigos(banco(), PAI)).toEqual([]);

    await amigos(LUCAS, PAI);
    await desfazerAmizade(banco(), PAI, LUCAS);
    expect(await listarAmigos(banco(), LUCAS)).toEqual([]);
  });

  it("sem amizade dá 404, e um terceiro não desfaz a amizade dos outros", async () => {
    await amigos(LUCAS, PAI);
    expect(await erroDe(desfazerAmizade(banco(), OUTRO, PAI))).toEqual({ codigo: "nao_sao_amigos", status: 404 });
    expect((await listarAmigos(banco(), LUCAS)).map((a) => a.id)).toEqual([PAI]);
    await desfazerAmizade(banco(), LUCAS, PAI);
    expect(await erroDe(desfazerAmizade(banco(), LUCAS, PAI))).toEqual({ codigo: "nao_sao_amigos", status: 404 });
  });

  it("desfazer conta como recusa de quem desfez: nenhum pedido aparece, e o outro ainda pode pedir (PROD-001)", async () => {
    await amigos(LUCAS, PAI);
    await desfazerAmizade(banco(), LUCAS, PAI);
    expect(await listarPedidos(banco(), PAI)).toEqual({ recebidos: [], enviados: [] });
    expect(await listarPedidos(banco(), LUCAS)).toEqual({ recebidos: [], enviados: [] });
    expect(await banco().select({ de: pedidoAmizade.de, para: pedidoAmizade.para, status: pedidoAmizade.status }).from(pedidoAmizade)).toEqual([
      { de: PAI, para: LUCAS, status: "recusado" },
    ]);
    expect((await buscarPorLogin(banco(), PAI, "lucasolvrandrade"))[0]?.relacao).toEqual({ tipo: "nenhuma" });
    expect(await pedirAmizade(banco(), PAI, LUCAS)).toBe("pedido_enviado");
    expect((await listarPedidos(banco(), LUCAS)).recebidos.map((p) => p.id)).toEqual([PAI]);
  });

  it("o pedido que sobrou de uma corrida não reabre a amizade depois de desfeita (REL-004)", async () => {
    await amigos(LUCAS, PAI);
    await banco().insert(pedidoAmizade).values({ id: "sobra", de: LUCAS, para: PAI });
    await desfazerAmizade(banco(), LUCAS, PAI);
    expect(await listarPedidos(banco(), PAI)).toEqual({ recebidos: [], enviados: [] });

    await amigos(LUCAS, PAI);
    await banco().insert(pedidoAmizade).values({ id: "sobra2", de: LUCAS, para: PAI });
    await desfazerAmizade(banco(), PAI, LUCAS);
    expect(await listarPedidos(banco(), PAI)).toEqual({ recebidos: [], enviados: [] });
    expect(await contarPedidosRecebidos(banco(), PAI)).toBe(0);
  });

  it("depois de desfeita, os dois podem pedir de novo", async () => {
    await amigos(LUCAS, PAI);
    await desfazerAmizade(banco(), LUCAS, PAI);
    expect(await pedirAmizade(banco(), PAI, LUCAS)).toBe("pedido_enviado");
  });

  it("lista os amigos por nome, com a data da amizade", async () => {
    await amigos(OUTRO, LUCAS);
    await amigos(PAI, LUCAS);
    const lista = await listarAmigos(banco(), LUCAS);
    expect(lista.map((a) => a.nome)).toEqual(["Outra Pessoa", "Pai"]);
    expect(lista[0]?.desde).toBeInstanceOf(Date);
  });
});

describe("ordem do par e pedidos que sobram", () => {
  // Em UTF-16 (JavaScript) o emoji vem antes do A de largura cheia; em bytes
  // UTF-8 (collation C do banco) vem depois. Se a ordem saísse do JavaScript,
  // o check usuario_a < usuario_b recusaria a amizade (gate da 1.3, TEST-001).
  const EMOJI = "\u{1F600}a";
  const LARGO = "Ａb";

  it("os dois ids se ordenam diferente no JavaScript e no banco", async () => {
    const [linha] = (await banco().execute(sql`select least(${EMOJI}::text, ${LARGO}::text) as menor`)).rows as { menor: string }[];
    expect(EMOJI < LARGO).toBe(true);
    expect(linha?.menor).toBe(LARGO);
  });

  it("pedir, aceitar, pedido cruzado e desfazer funcionam com eles", async () => {
    await criarUsuario(banco(), EMOJI, "emoji");
    await criarUsuario(banco(), LARGO, "largo");
    await pedirAmizade(banco(), EMOJI, LARGO);
    await aceitarPedido(banco(), LARGO, await pedidoDe(EMOJI, LARGO));
    expect((await listarAmigos(banco(), EMOJI)).map((a) => a.id)).toEqual([LARGO]);
    expect((await buscarPorLogin(banco(), LARGO, "emoji"))[0]?.relacao).toEqual({ tipo: "amigo" });
    await desfazerAmizade(banco(), EMOJI, LARGO);

    await pedirAmizade(banco(), LARGO, EMOJI);
    expect(await pedirAmizade(banco(), EMOJI, LARGO)).toBe("amigos");
    expect((await listarAmigos(banco(), LARGO)).map((a) => a.id)).toEqual([EMOJI]);
  });

  it("pedido pendente que sobrou entre amigos não aparece nem conta (REL-004)", async () => {
    await pedirAmizade(banco(), LUCAS, PAI);
    await aceitarPedido(banco(), PAI, await pedidoDe(LUCAS, PAI));
    // A corrida: um pedido de novo por uma aba antiga, gravado depois do aceite.
    await banco().insert(pedidoAmizade).values({ id: "sobra", de: LUCAS, para: PAI });
    expect(await banco().select().from(amizade)).toHaveLength(1);
    expect(await listarPedidos(banco(), PAI)).toEqual({ recebidos: [], enviados: [] });
    expect(await listarPedidos(banco(), LUCAS)).toEqual({ recebidos: [], enviados: [] });
    expect(await contarPedidosRecebidos(banco(), PAI)).toBe(0);
  });
});
