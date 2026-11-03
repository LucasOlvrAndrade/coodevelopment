import { assinarTokenSala } from "@coodevelopment/protocolo";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// O status do Claude na sala de verdade (Story 4.1), no workerd.

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
    // A próxima mensagem que passa no teste (as que já chegaram não contam).
    proxima(teste: (m: Mensagem) => boolean) {
      return new Promise<Mensagem>((resolver) => esperando.push({ teste, resolver }));
    },
    status(estado: "trabalhando" | "parado", motivo: string | null = null) {
      ws.send(JSON.stringify({ v: 1, tipo: "status", estado, motivo }));
    },
  };
}

const claudes = (m: Mensagem) => m.tipo === "claudes";

describe("status do Claude na sala (Story 4.1)", () => {
  it("a página recebe quem está trabalhando ao abrir, ao começar e ao parar; parada por erro vem como parou (AC 2 e 3)", async () => {
    const conector = await conectar("jam-status", "lucas", "conector");
    const paginaQuieta = await conectar("jam-status", "pai", "pagina");
    await new Promise((r) => setTimeout(r, 30));
    expect(paginaQuieta.recebidas.find(claudes)).toMatchObject({ trabalhando: [] });

    const comecou = paginaQuieta.proxima(claudes);
    conector.status("trabalhando");
    const m = await comecou;
    expect(m).toMatchObject({ trabalhando: [{ usuarioId: "lucas" }] });

    // Quem abre depois já vê.
    const depois = await conectar("jam-status", "pai", "pagina");
    await new Promise((r) => setTimeout(r, 30));
    expect(depois.recebidas.find(claudes)).toMatchObject({ trabalhando: [{ usuarioId: "lucas", desde: (m.trabalhando as { desde: string }[])[0]!.desde }] });

    const parou = paginaQuieta.proxima((x) => x.tipo === "parou");
    const vazio = paginaQuieta.proxima(claudes);
    conector.status("parado", "rate_limit");
    expect(await vazio).toMatchObject({ trabalhando: [] });
    expect(await parou).toMatchObject({ usuarioId: "lucas", motivo: "rate_limit" });
    // O conector não recebe o status.
    expect(conector.recebidas.some((x) => x.tipo === "claudes" || x.tipo === "parou")).toBe(false);
    for (const c of [conector, paginaQuieta, depois]) c.ws.close();
  });

  it("o conector que cai tira o status; a página não consegue mandar status", async () => {
    const conector = await conectar("jam-status-cai", "lucas", "conector");
    const pagina = await conectar("jam-status-cai", "pai", "pagina");
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    const comecou = pagina.proxima(claudes);
    conector.status("trabalhando");
    await comecou;
    const sumiu = pagina.proxima(claudes);
    conector.ws.close(1000, "Ctrl+C");
    expect(await sumiu).toMatchObject({ trabalhando: [] });

    pagina.status("trabalhando");
    await new Promise((r) => setTimeout(r, 50));
    expect(pagina.recebidas.filter(claudes).at(-1)).toMatchObject({ trabalhando: [] });
    pagina.ws.close();
  });

  it("duas pastas da mesma pessoa: trabalhando enquanto qualquer uma estiver", async () => {
    const a = await conectar("jam-status-duas", "lucas", "conector");
    const b = await conectar("jam-status-duas", "lucas", "conector");
    const pagina = await conectar("jam-status-duas", "pai", "pagina");
    // O claudes inicial, de quando a página abre, primeiro: senão ele ocupa
    // o lugar do próximo e tudo se desloca (gate da 4.1, TEST-003).
    if (!pagina.recebidas.some(claudes)) await pagina.proxima(claudes);
    let proxima = pagina.proxima(claudes);
    a.status("trabalhando");
    await proxima;
    // Espera o anúncio do b, não um tempo fixo (gate da 4.1, TEST-003).
    proxima = pagina.proxima(claudes);
    b.status("trabalhando");
    await proxima;
    proxima = pagina.proxima(claudes);
    a.status("parado");
    expect(await proxima).toMatchObject({ trabalhando: [{ usuarioId: "lucas" }] });
    proxima = pagina.proxima(claudes);
    b.status("parado");
    expect(await proxima).toMatchObject({ trabalhando: [] });
    for (const c of [a, b, pagina]) c.ws.close();
  });
});
