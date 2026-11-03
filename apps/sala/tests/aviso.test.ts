import { assinarTokenSala, hashDoConteudo } from "@coodevelopment/protocolo";
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
