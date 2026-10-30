import { assinarTokenSala, hashDoConteudo } from "@coodevelopment/protocolo";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// A sincronização ligada na sala de verdade (Story 3.3), no workerd: as
// mensagens circulam entre conectores e o estado fica no SQLite da sala.

type Mensagem = { tipo: string; [k: string]: unknown };

async function conectar(jamId: string, usuarioId: string, via: "pagina" | "conector" = "conector") {
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
    // Próxima mensagem (ou uma que já chegou) que passa no teste.
    esperar(teste: (m: Mensagem) => boolean) {
      const ja = recebidas.find(teste);
      return ja ? Promise.resolve(ja) : new Promise<Mensagem>((resolver) => esperando.push({ teste, resolver }));
    },
    async escrever(caminho: string, conteudo: string, versaoBase: number, conteudoBase: string | null = null) {
      ws.send(JSON.stringify({ v: 1, tipo: "escrever", caminho, versaoBase, hash: await hashDoConteudo(conteudo, false), conteudo, binario: false, apagado: false, conteudoBase }));
    },
  };
}

const arquivo = (caminho: string) => (m: Mensagem) => m.tipo === "arquivo" && m.caminho === caminho;

describe("arquivos na sala (Story 3.3)", () => {
  it("o que um conector escreve chega ao outro e não volta para o autor; o autor recebe o aceito (AC 1)", async () => {
    const lucas = await conectar("jam-arquivos", "lucas");
    const pai = await conectar("jam-arquivos", "pai");
    await lucas.escrever("src/a.ts", "export const a = 1;\n", 0, "export const a = 0;\n");
    const chegou = await pai.esperar(arquivo("src/a.ts"));
    expect(chegou).toMatchObject({ versao: 1, conteudo: "export const a = 1;\n", autorId: "lucas", origem: "escrita" });
    expect(await lucas.esperar((m) => m.tipo === "aceito")).toMatchObject({ caminho: "src/a.ts", versao: 1 });
    expect(lucas.recebidas.some(arquivo("src/a.ts"))).toBe(false);
    lucas.ws.close();
    pai.ws.close();
  });

  it("quem conecta depois recebe o manifesto e os arquivos guardados na sala (AC 5)", async () => {
    const lucas = await conectar("jam-depois", "lucas");
    await lucas.escrever("README.md", "# oi\n", 0, null);
    await lucas.esperar((m) => m.tipo === "aceito");
    lucas.ws.close();

    const pai = await conectar("jam-depois", "pai");
    expect(await pai.esperar((m) => m.tipo === "manifesto")).toMatchObject({ arquivos: [{ caminho: "README.md", versao: 1, apagado: false }] });
    expect(await pai.esperar(arquivo("README.md"))).toMatchObject({ conteudo: "# oi\n", origem: "estado" });
    pai.ws.close();
  });

  it("a página não escreve arquivo nem recebe os arquivos", async () => {
    const pagina = await conectar("jam-pagina", "lucas", "pagina");
    const conector = await conectar("jam-pagina", "pai");
    await pagina.escrever("x.txt", "x\n", 0);
    await conector.escrever("y.txt", "y\n", 0);
    await conector.esperar((m) => m.tipo === "aceito");
    await new Promise((r) => setTimeout(r, 50));
    expect(pagina.recebidas.some((m) => m.tipo === "arquivo" || m.tipo === "manifesto")).toBe(false);
    expect(conector.recebidas.some(arquivo("x.txt"))).toBe(false);
    pagina.ws.close();
    conector.ws.close();
  });

  it("nome que só muda a caixa, com acento, é recusado no SQLite da sala (gate da 3.3, REL-001)", async () => {
    const lucas = await conectar("jam-caixa", "lucas");
    await lucas.escrever("docs/Ação.md", "a\n", 0);
    await lucas.esperar((m) => m.tipo === "aceito");
    await lucas.escrever("docs/AÇÃO.md", "b\n", 0);
    expect(await lucas.esperar((m) => m.tipo === "recusado")).toMatchObject({ caminho: "docs/AÇÃO.md", motivo: "caminho_invalido" });
    lucas.ws.close();
  });

  it("merge de duas escritas da mesma versão vai para todos os conectores (AC 6)", async () => {
    const lucas = await conectar("jam-merge", "lucas");
    const pai = await conectar("jam-merge", "pai");
    const base = "a\nb\nc\nd\ne\n";
    await lucas.escrever("m.txt", "a\nB\nc\nd\ne\n", 0, base);
    await lucas.esperar((m) => m.tipo === "aceito");
    await pai.escrever("m.txt", "a\nb\nc\nd\nE\n", 0, base);
    const juntou = (m: Mensagem) => m.tipo === "arquivo" && m.origem === "merge";
    expect(await lucas.esperar(juntou)).toMatchObject({ versao: 2, conteudo: "a\nB\nc\nd\nE\n" });
    expect(await pai.esperar(juntou)).toMatchObject({ versao: 2, conteudo: "a\nB\nc\nd\nE\n" });
    lucas.ws.close();
    pai.ws.close();
  });
});
