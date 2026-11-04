import { assinarTokenSala, hashDoConteudo } from "@coodevelopment/protocolo";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// O aviso do Claude na sala de verdade (Story 4.2), no workerd.

type Mensagem = { tipo: string; [k: string]: unknown };

async function conectar(jamId: string, usuarioId: string, via: "pagina" | "conector") {
  const { token } = await assinarTokenSala({ usuarioId, jamId, via }, env.SEGREDO_SALA);
  const resposta = await exports.default.fetch(`http://sala/parties/jam/${jamId}?token=${encodeURIComponent(token)}`, { headers: { Upgrade: "websocket" } });
  const ws = resposta.webSocket!;
  const recebidas: Mensagem[] = [];
  const esperando: { teste: (m: Mensagem) => boolean; resolver: (m: Mensagem) => void }[] = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data)) as Mensagem;
    recebidas.push(m);
    for (const espera of esperando.splice(0).filter((x) => !x.teste(m) || (x.resolver(m), false))) esperando.push(espera);
  });
  ws.accept();
  return {
    ws,
    recebidas,
    proxima(teste: (m: Mensagem) => boolean) {
      return new Promise<Mensagem>((resolver) => esperando.push({ teste, resolver }));
    },
    enviar(m: object) {
      ws.send(JSON.stringify({ v: 1, ...m }));
    },
    async escrever(caminho: string, conteudo: string) {
      ws.send(JSON.stringify({ v: 1, tipo: "escrever", caminho, versaoBase: 0, hash: await hashDoConteudo(conteudo, false), conteudo, binario: false, apagado: false, conteudoBase: null }));
    },
  };
}

const feedVivo = (tipo: string) => (m: Mensagem) => m.tipo === "feed" && m.inicial === false && (m.eventos as { tipo: string }[])[0]?.tipo === tipo;
const claudes = (m: Mensagem) => m.tipo === "claudes";

describe("aviso do Claude na sala (Story 4.2)", () => {
  it("o aviso vira item do feed e o resumo vai para o status; termina com o Claude (AC 1, 2 e 6)", async () => {
    const conector = await conectar("jam-aviso", "lucas", "conector");
    const pagina = await conectar("jam-aviso", "pai", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);

    let status = pagina.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    await status;

    const item = pagina.proxima(feedVivo("aviso"));
    status = pagina.proxima(claudes);
    conector.enviar({ tipo: "aviso", resumo: "Login com Google", arquivos: ["src/auth.ts", "src/login.tsx"] });
    expect(await item).toMatchObject({ eventos: [{ tipo: "aviso", autorId: "lucas", resumo: "Login com Google", arquivos: ["src/auth.ts", "src/login.tsx"] }] });
    expect(await status).toMatchObject({ trabalhando: [{ usuarioId: "lucas", resumo: "Login com Google" }] });

    status = pagina.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "parado", motivo: null });
    expect(await status).toMatchObject({ trabalhando: [] });

    // Trabalhando de novo, sem aviso novo: sem resumo.
    status = pagina.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    expect(await status).toMatchObject({ trabalhando: [{ usuarioId: "lucas", resumo: null }] });
    conector.ws.close();
    pagina.ws.close();
  });

  it("mudança sem aviso ativo é marcada; com aviso, ou logo depois do fim dele, não (AC 5)", async () => {
    const conector = await conectar("jam-sem-aviso", "lucas", "conector");
    const pagina = await conectar("jam-sem-aviso", "pai", "pagina");
    if (!pagina.recebidas.some((m) => m.tipo === "feed")) await pagina.proxima((m) => m.tipo === "feed");

    let feito = pagina.proxima(feedVivo("arquivos"));
    await conector.escrever("terminal.txt", "x\n");
    expect(await feito).toMatchObject({ eventos: [{ arquivos: [{ caminho: "terminal.txt", semAviso: true }] }] });

    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    const aviso = pagina.proxima(feedVivo("aviso"));
    conector.enviar({ tipo: "aviso", resumo: "Docs", arquivos: ["README.md"] });
    await aviso;
    feito = pagina.proxima((m) => m.tipo === "feed" && JSON.stringify(m).includes("README.md") && JSON.stringify(m).includes('"semAviso"'));
    await conector.escrever("README.md", "# oi\n");
    expect(JSON.stringify(await feito)).toContain('"caminho":"README.md","mudanca":"criado","binario":false,"adicionadas":1,"removidas":0,"juntado":false,"semAviso":false');

    // O Claude terminou, mas a gravação ainda está saindo: dentro da folga.
    conector.enviar({ tipo: "status", estado: "parado", motivo: null });
    feito = pagina.proxima((m) => m.tipo === "feed" && JSON.stringify(m).includes("tarde.txt"));
    await conector.escrever("tarde.txt", "y\n");
    expect(JSON.stringify(await feito)).toContain('"caminho":"tarde.txt","mudanca":"criado","binario":false,"adicionadas":1,"removidas":0,"juntado":false,"semAviso":false');
    conector.ws.close();
    pagina.ws.close();
  });

  it("a página não anuncia", async () => {
    const pagina = await conectar("jam-aviso-pagina", "lucas", "pagina");
    const outra = await conectar("jam-aviso-pagina", "pai", "pagina");
    pagina.enviar({ tipo: "aviso", resumo: "x", arquivos: [] });
    await new Promise((r) => setTimeout(r, 50));
    expect(outra.recebidas.some(feedVivo("aviso"))).toBe(false);
    pagina.ws.close();
    outra.ws.close();
  });
});

describe("fim do aviso e aviso repetido (gate da 4.2)", () => {
  it("aviso_fim tira o resumo do status; o mesmo aviso de novo não vira outro item (REL-001, UX-001)", async () => {
    const conector = await conectar("jam-aviso-fim", "lucas", "conector");
    const pagina = await conectar("jam-aviso-fim", "pai", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    let status = pagina.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    await status;
    const item = pagina.proxima(feedVivo("aviso"));
    conector.enviar({ tipo: "aviso", resumo: "Plano A", arquivos: [] });
    await item;
    // A reconexão manda o mesmo aviso: só o estado.
    status = pagina.proxima(claudes);
    conector.enviar({ tipo: "aviso", resumo: "Plano A", arquivos: [] });
    await new Promise((r) => setTimeout(r, 50));
    expect(pagina.recebidas.filter(feedVivo("aviso"))).toHaveLength(1);

    // Pelo conteúdo: com a máquina ocupada, o claudes do aviso repetido pode
    // chegar depois daqui.
    status = pagina.proxima((m) => claudes(m) && JSON.stringify(m).includes('"resumo":null'));
    conector.enviar({ tipo: "aviso_fim" });
    expect(await status).toMatchObject({ trabalhando: [{ usuarioId: "lucas", resumo: null }] });
    conector.ws.close();
    pagina.ws.close();
  });
});

describe("duas sessões alternando (gate da 4.2, UX-004)", () => {
  it("um aviso que já virou item e volta só muda o status", async () => {
    const conector = await conectar("jam-aviso-volta", "lucas", "conector");
    const pagina = await conectar("jam-aviso-volta", "pai", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    let status = pagina.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    await status;
    for (const resumo of ["Plano X", "Plano Y"]) {
      const item = pagina.proxima(feedVivo("aviso"));
      const comResumo = pagina.proxima((m) => claudes(m) && JSON.stringify(m).includes(resumo));
      conector.enviar({ tipo: "aviso", resumo, arquivos: [] });
      await item;
      await comResumo;
    }
    status = pagina.proxima(claudes);
    conector.enviar({ tipo: "aviso", resumo: "Plano X", arquivos: [] });
    expect(await status).toMatchObject({ trabalhando: [{ usuarioId: "lucas", resumo: "Plano X" }] });
    await new Promise((r) => setTimeout(r, 50));
    expect(pagina.recebidas.filter(feedVivo("aviso"))).toHaveLength(2);
    conector.ws.close();
    pagina.ws.close();
  });
});

describe("mesmo anúncio em outro período de trabalho (gate da 4.2, UX-005)", () => {
  it("depois que o Claude para, o mesmo anúncio volta a ser item", async () => {
    const conector = await conectar("jam-aviso-periodo", "lucas", "conector");
    const pagina = await conectar("jam-aviso-periodo", "pai", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    for (let vez = 0; vez < 2; vez++) {
      const comecou = pagina.proxima(claudes);
      conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
      await comecou;
      const item = pagina.proxima(feedVivo("aviso"));
      conector.enviar({ tipo: "aviso", resumo: "Rodar o formatador", arquivos: [] });
      await item;
      const parou = pagina.proxima(claudes);
      conector.enviar({ tipo: "status", estado: "parado", motivo: null });
      await parou;
    }
    expect(pagina.recebidas.filter(feedVivo("aviso"))).toHaveLength(2);
    conector.ws.close();
    pagina.ws.close();
  });
});

describe("claudes para os conectores (Story 4.3)", () => {
  it("o conector recebe ao entrar e a cada mudança, com os arquivos anunciados das pastas da pessoa (AC 5)", async () => {
    const lucas = await conectar("jam-cruzado", "lucas", "conector");
    const lucas2 = await conectar("jam-cruzado", "lucas", "conector");
    const pai = await conectar("jam-cruzado", "pai", "conector");
    if (!pai.recebidas.some(claudes)) await pai.proxima(claudes);
    for (const c of [lucas, lucas2]) c.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    let comArquivos = pai.proxima((m) => claudes(m) && JSON.stringify(m).includes("src/b.ts"));
    lucas.enviar({ tipo: "aviso", resumo: "Login", arquivos: ["src/a.ts"] });
    lucas2.enviar({ tipo: "aviso", resumo: "Login 2", arquivos: ["src/a.ts", "src/b.ts"] });
    const m = (await comArquivos) as unknown as { trabalhando: { usuarioId: string; arquivos: string[] }[] };
    expect(m.trabalhando).toHaveLength(1);
    expect(m.trabalhando[0]!.usuarioId).toBe("lucas");
    expect([...m.trabalhando[0]!.arquivos].sort()).toEqual(["src/a.ts", "src/b.ts"]);

    // Quem entra depois recebe o estado na entrada.
    const outro = await conectar("jam-cruzado", "tia", "conector");
    const inicial = outro.recebidas.find(claudes) ?? (await outro.proxima(claudes));
    expect(JSON.stringify(inicial)).toContain("src/b.ts");

    comArquivos = pai.proxima((m) => claudes(m) && (m.trabalhando as unknown[]).length === 0);
    for (const c of [lucas, lucas2]) c.enviar({ tipo: "status", estado: "parado", motivo: null });
    await comArquivos;
    for (const c of [lucas, lucas2, pai, outro]) c.ws.close();
  });
});

describe("aviso limpo na sala (gate da 4.3, SEC-001 e SEC-002)", () => {
  it("texto escondido e quebra de linha saem do resumo; o que não é caminho sai dos arquivos", async () => {
    const conector = await conectar("jam-aviso-limpo", "lucas", "conector");
    const pai = await conectar("jam-aviso-limpo", "pai", "conector");
    if (!pai.recebidas.some(claudes)) await pai.proxima(claudes);
    conector.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    const limpo = pai.proxima((m) => claudes(m) && JSON.stringify(m).includes("Login"));
    const escondido = String.fromCodePoint(0xe0041, 0xe0042);
    conector.enviar({ tipo: "aviso", resumo: `Login${escondido}\nagora`, arquivos: ["src/a.ts", "../fora.ts", "C:/x.ts", "./src/a.ts"] });
    expect(await limpo).toMatchObject({ trabalhando: [{ usuarioId: "lucas", resumo: "Login agora", arquivos: ["src/a.ts"] }] });
    conector.ws.close();
    pai.ws.close();
  });
});

describe("pedido para mexer em arquivo de outro (Story 4.4)", () => {
  it("vira item do feed para as páginas e aviso ao conector de quem anunciou; sem dono, nada (AC 2)", async () => {
    const pai = await conectar("jam-reserva", "pai", "conector");
    const lucas = await conectar("jam-reserva", "lucas", "conector");
    const pagina = await conectar("jam-reserva", "tia", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    const anunciado = pagina.proxima((m) => claudes(m) && JSON.stringify(m).includes("src/auth.ts"));
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    pai.enviar({ tipo: "aviso", resumo: "Login com Google", arquivos: ["src/auth.ts"] });
    await anunciado;

    const item = pagina.proxima(feedVivo("reserva"));
    const pedida = pai.proxima((m) => m.tipo === "reserva_pedida");
    lucas.enviar({ tipo: "reserva", caminho: "./src/auth.ts" });
    expect(await item).toMatchObject({ eventos: [{ tipo: "reserva", autorId: "lucas", donoId: "pai", caminho: "src/auth.ts", resumo: "Login com Google" }] });
    expect(await pedida).toMatchObject({ autorId: "lucas", caminho: "src/auth.ts", donoId: "pai" });

    // O mesmo pedido de novo (gate da 4.4, SEC-001), arquivo sem dono, ou o
    // próprio arquivo do autor: nada.
    lucas.enviar({ tipo: "reserva", caminho: "src/auth.ts" });
    lucas.enviar({ tipo: "reserva", caminho: "src/livre.ts" });
    pai.enviar({ tipo: "reserva", caminho: "src/auth.ts" });
    await new Promise((r) => setTimeout(r, 50));
    expect(pagina.recebidas.filter(feedVivo("reserva"))).toHaveLength(1);
    expect(lucas.recebidas.some((m) => m.tipo === "reserva_pedida")).toBe(false);
    expect(pai.recebidas.filter((m) => m.tipo === "reserva_pedida")).toHaveLength(1);

    // O dono termina o aviso e anuncia o mesmo resumo de novo: aviso novo,
    // id novo, pedido novo (gate da 4.4, REL-005 e REL-006).
    const antes = pagina.recebidas.filter(claudes).at(-1) as unknown as { trabalhando: { avisoId?: string }[] };
    const novoId = pagina.proxima((m) => claudes(m) && JSON.stringify(m).includes("avisoId") && !JSON.stringify(m).includes(String(antes.trabalhando[0]?.avisoId)));
    pai.enviar({ tipo: "aviso_fim" });
    pai.enviar({ tipo: "aviso", resumo: "Login com Google", arquivos: ["src/auth.ts"] });
    await novoId;
    const segundo = pai.proxima((m) => m.tipo === "reserva_pedida");
    lucas.enviar({ tipo: "reserva", caminho: "src/auth.ts" });
    await segundo;
    expect(pai.recebidas.filter((m) => m.tipo === "reserva_pedida")).toHaveLength(2);
    for (const c of [pai, lucas, pagina]) c.ws.close();
  });
});

describe("avisos no SQLite, sessões e quedas (gate da 4.4)", () => {
  type Claudes = { trabalhando: { usuarioId: string; resumo: string | null; avisoId?: string; arquivos: string[]; avisos: { id: string; resumo: string; arquivos: string[]; queda?: boolean }[] }[] };
  const doPai = (ms: Mensagem[]) => (ms.filter(claudes).at(-1) as unknown as Claudes).trabalhando.find((t) => t.usuarioId === "pai");
  const espera = (ms = 50) => new Promise((r) => setTimeout(r, ms));
  const salaDe = (jamId: string) => env.Jam.getByName(jamId);

  it("o id do conector identifica o aviso: voltar com ele não pergunta nem avisa de novo (REL-007)", async () => {
    const jam = "jam-id-estavel";
    let pai = await conectar(jam, "pai", "conector");
    const lucas = await conectar(jam, "lucas", "conector");
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    let visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("aviso-1"));
    pai.enviar({ tipo: "aviso", id: "aviso-1", resumo: "Plano", arquivos: ["a.ts"] });
    await visto;
    const pedida = pai.proxima((m) => m.tipo === "reserva_pedida");
    lucas.enviar({ tipo: "reserva", caminho: "a.ts" });
    await pedida;
    pai.ws.close(4000, "rede");
    pai = await conectar(jam, "pai", "conector");
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("aviso-1") && !JSON.stringify(m).includes("queda"));
    pai.enviar({ tipo: "aviso", id: "aviso-1", resumo: "Plano", arquivos: ["a.ts"] });
    await visto;
    lucas.enviar({ tipo: "reserva", caminho: "a.ts" });
    await espera();
    expect(pai.recebidas.some((m) => m.tipo === "reserva_pedida")).toBe(false);
    for (const c of [pai, lucas]) c.ws.close();
  });

  it("aviso de 50 caminhos longos e 50 pedidos diferentes cabem (REL-008)", async () => {
    const jam = "jam-estado-grande";
    const pai = await conectar(jam, "pai", "conector");
    const lucas = await conectar(jam, "lucas", "conector");
    const arquivos = Array.from({ length: 50 }, (_, i) => `pasta/${"x".repeat(900)}/${i}.ts`);
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    let visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("Plano grande"));
    pai.enviar({ tipo: "aviso", id: "grande", resumo: "Plano grande", arquivos });
    await visto;
    expect(doPai(lucas.recebidas)?.arquivos).toHaveLength(50);
    for (let i = 0; i < 50; i++) lucas.enviar({ tipo: "reserva", caminho: arquivos[i] });
    const ultima = (n: number) => pai.proxima(() => pai.recebidas.filter((m) => m.tipo === "reserva_pedida").length >= n);
    const pedidas = ultima(50);
    await pedidas;
    // O conector de quem pediu segue funcionando: um aviso dele também chega.
    lucas.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    visto = pai.proxima((m) => claudes(m) && JSON.stringify(m).includes("Depois de tudo"));
    lucas.enviar({ tipo: "aviso", id: "depois", resumo: "Depois de tudo", arquivos: arquivos.slice(0, 50) });
    await visto;
    for (const c of [pai, lucas]) c.ws.close();
  });

  it("duas sessões do dono: os dois avisos valem, e o pedido cita o resumo certo (REL-009 e REL-013)", async () => {
    const jam = "jam-duas-sessoes";
    const pai = await conectar(jam, "pai", "conector");
    const lucas = await conectar(jam, "lucas", "conector");
    const pagina = await conectar(jam, "kelson", "pagina");
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    const visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("Plano B"));
    pai.enviar({ tipo: "aviso", id: "b", resumo: "Plano B", arquivos: ["b.ts"], outros: [{ id: "a", resumo: "Plano A", arquivos: ["a.ts"] }] });
    await visto;
    expect(doPai(lucas.recebidas)).toMatchObject({ resumo: "Plano B", avisoId: "b", arquivos: ["b.ts", "a.ts"] });
    expect(doPai(lucas.recebidas)?.avisos.map((a) => a.id)).toEqual(["b", "a"]);
    const item = pagina.proxima(feedVivo("reserva"));
    lucas.enviar({ tipo: "reserva", caminho: "a.ts" });
    expect(await item).toMatchObject({ eventos: [{ caminho: "a.ts", donoId: "pai", resumo: "Plano A", avisoId: "a" }] });
    for (const c of [pai, lucas, pagina]) c.ws.close();
  });

  it("queda do dono: a reserva continua para os conectores, e a página não; depois da tolerância, acaba (REL-010)", async () => {
    const jam = "jam-queda";
    const pai = await conectar(jam, "pai", "conector");
    const lucas = await conectar(jam, "lucas", "conector");
    const pagina = await conectar(jam, "kelson", "pagina");
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    let visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("Plano"));
    pai.enviar({ tipo: "aviso", id: "a", resumo: "Plano", arquivos: ["a.ts"] });
    await visto;

    visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes('"queda":true'));
    const paginaSabe = pagina.proxima((m) => claudes(m) && (m as unknown as Claudes).trabalhando.length === 0);
    pai.ws.close(4000, "rede");
    await visto;
    await paginaSabe;
    expect(doPai(lucas.recebidas)?.avisos[0]).toMatchObject({ id: "a", queda: true });

    // Quem chega durante a tolerância também sabe.
    const novo = await conectar(jam, "ana", "conector");
    if (!novo.recebidas.some(claudes)) await novo.proxima(claudes);
    expect(doPai(novo.recebidas)?.avisos[0]).toMatchObject({ queda: true });

    const salaDaJam = salaDe(jam);
    await runInDurableObject(salaDaJam, (_i, estado) => {
      estado.storage.sql.exec("update aviso_ativo set caiu_em = 1");
    });
    visto = lucas.proxima((m) => claudes(m) && (m as unknown as Claudes).trabalhando.length === 0);
    await runInDurableObject(salaDaJam, async (_i, estado) => {
      await estado.storage.setAlarm(Date.now());
    });
    await runDurableObjectAlarm(salaDaJam);
    await visto;
    for (const c of [lucas, pagina, novo]) c.ws.close();
  });

  it("saída normal do conector (Ctrl+C) encerra a reserva na hora (REL-010)", async () => {
    const jam = "jam-saida-normal";
    const pai = await conectar(jam, "pai", "conector");
    const lucas = await conectar(jam, "lucas", "conector");
    pai.enviar({ tipo: "status", estado: "trabalhando", motivo: null });
    let visto = lucas.proxima((m) => claudes(m) && JSON.stringify(m).includes("Plano"));
    pai.enviar({ tipo: "aviso", id: "a", resumo: "Plano", arquivos: ["a.ts"] });
    await visto;
    visto = lucas.proxima((m) => claudes(m) && (m as unknown as Claudes).trabalhando.length === 0);
    pai.ws.close(1000, "saiu");
    await visto;
    lucas.ws.close();
  });
});
