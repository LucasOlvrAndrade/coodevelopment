import { assinarTokenSala, DURACAO_TOKEN_SALA_S } from "@coodevelopment/protocolo";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

type Presenca = { v: number; tipo: string; online: string[] };

async function token(usuarioId: string, jamId: string, agora = Date.now()) {
  return (await assinarTokenSala({ usuarioId, jamId, via: "pagina" }, env.SEGREDO_SALA, agora)).token;
}

// Abre uma conexão com a sala e guarda as mensagens de presença que chegam.
async function conectar(jamId: string, comToken?: string) {
  const busca = comToken === undefined ? "" : `?token=${encodeURIComponent(comToken)}`;
  const resposta = await exports.default.fetch(`http://sala/parties/jam/${jamId}${busca}`, { headers: { Upgrade: "websocket" } });
  expect(resposta.status).toBe(101);
  const ws = resposta.webSocket!;
  const recebidas: Presenca[] = [];
  const esperando: { teste: (p: Presenca) => boolean; resolver: (p: Presenca) => void }[] = [];
  ws.addEventListener("message", (e) => {
    const p = JSON.parse(String(e.data)) as Presenca;
    recebidas.push(p);
    for (const espera of esperando.splice(0).filter((x) => !x.teste(p) || (x.resolver(p), false))) esperando.push(espera);
  });
  const fechou = new Promise<CloseEvent>((resolve) => ws.addEventListener("close", resolve));
  ws.accept();
  return {
    ws,
    fechou,
    // Próxima presença (ou a última que já chegou) que passa no teste.
    presenca(teste: (p: Presenca) => boolean) {
      const ja = recebidas.findLast(teste);
      return ja ? Promise.resolve(ja) : new Promise<Presenca>((resolver) => esperando.push({ teste, resolver }));
    },
  };
}

const com = (...ids: string[]) => (p: Presenca) => JSON.stringify(p.online) === JSON.stringify(ids);

describe("sala da jam", () => {
  it("responde 404 fora do caminho das salas", async () => {
    const resposta = await exports.default.fetch("http://sala/qualquer-coisa");
    expect(resposta.status).toBe(404);
  });

  it("fecha com 4401 a conexão sem token", async () => {
    const { fechou } = await conectar("jam-sem-token");
    expect((await fechou).code).toBe(4401);
  });

  it("fecha com 4401 o token vencido, o de outra jam e o adulterado (AC 3)", async () => {
    const vencido = await token("lucas", "jam-recusa", Date.now() - (DURACAO_TOKEN_SALA_S + 1) * 1000);
    const deOutraJam = await token("lucas", "outra-jam");
    const adulterado = (await token("lucas", "jam-recusa")).slice(0, -4) + "AAAA";
    for (const t of [vencido, deOutraJam, adulterado]) {
      const { fechou } = await conectar("jam-recusa", t);
      expect((await fechou).code).toBe(4401);
    }
  });

  it("quem entra recebe a presença com ele mesmo (AC 1)", async () => {
    const lucas = await conectar("jam-entrar", await token("lucas", "jam-entrar"));
    expect((await lucas.presenca(com("lucas"))).v).toBe(1);
    lucas.ws.close();
  });

  it("todos recebem quem entrou e quem saiu, sem recarregar (AC 2)", async () => {
    const lucas = await conectar("jam-ao-vivo", await token("lucas", "jam-ao-vivo"));
    await lucas.presenca(com("lucas"));
    const pai = await conectar("jam-ao-vivo", await token("pai", "jam-ao-vivo"));
    await pai.presenca(com("lucas", "pai"));
    await lucas.presenca(com("lucas", "pai"));
    pai.ws.close(1000, "saiu");
    await lucas.presenca(com("lucas"));
    lucas.ws.close();
  });

  it("a mesma pessoa em duas abas conta uma vez e só sai quando fecha as duas", async () => {
    const aba1 = await conectar("jam-abas", await token("lucas", "jam-abas"));
    const aba2 = await conectar("jam-abas", await token("lucas", "jam-abas"));
    const pai = await conectar("jam-abas", await token("pai", "jam-abas"));
    await pai.presenca(com("lucas", "pai"));
    aba1.ws.close(1000, "fechou a aba");
    await new Promise((r) => setTimeout(r, 50));
    expect((await pai.presenca(() => true)).online).toEqual(["lucas", "pai"]);
    aba2.ws.close(1000, "fechou a outra");
    await pai.presenca(com("pai"));
    pai.ws.close();
  });
});
