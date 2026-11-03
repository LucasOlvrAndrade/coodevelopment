import { mensagemDoConector, type MensagemDoConector } from "@coodevelopment/protocolo";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Ambiente } from "../../src/ambiente";
import { registrarPasta } from "../../src/descoberta";
import { FERRAMENTA_ANUNCIAR, MOTIVO_SEM_AVISO, StatusDoClaude, abrirServidorDeHooks } from "../../src/hooks";

// Story 4.2: o anunciar do servidor MCP do plugin e a recusa da edição sem
// aviso, com os scripts de verdade rodando como o Claude Code roda.

const PLUGIN = join(__dirname, "..", "..", "..", "plugin", "scripts");
const limpar: string[] = [];
afterEach(() => {
  for (const p of limpar.splice(0)) rmSync(p, { recursive: true, force: true });
});
function temporaria() {
  const p = mkdtempSync(join(tmpdir(), "coodev-aviso-"));
  limpar.push(p);
  return p;
}

describe("StatusDoClaude: aviso (Story 4.2)", () => {
  it("anunciar guarda o aviso com caminhos relativos à pasta, sem os de fora e sem repetir (AC 1)", () => {
    const pasta = temporaria();
    const enviadas: MensagemDoConector[] = [];
    const s = new StatusDoClaude((m) => enviadas.push(m), Date.now, pasta);
    const m = s.anunciar("  Login com Google  ", [join(pasta, "src", "auth.ts"), "src/login.tsx", "src\\auth.ts", "../fora.txt", join(tmpdir(), "outro.txt")]);
    expect(m).toEqual({ v: 1, tipo: "aviso", resumo: "Login com Google", arquivos: ["src/auth.ts", "src/login.tsx"] });
    expect(mensagemDoConector.safeParse(m).success).toBe(true);
    expect(enviadas).toEqual([m]);
    expect(s.avisoAtual).toEqual(m);
  });

  it("sem aviso, a edição de arquivo da pasta é recusada com o motivo; com aviso ou fora da pasta, segue (AC 3)", () => {
    const pasta = temporaria();
    const s = new StatusDoClaude(() => {}, Date.now, pasta);
    expect(s.decidirEdicao({ file_path: join(pasta, "src", "a.ts") })).toEqual({ decisao: "recusar", motivo: MOTIVO_SEM_AVISO });
    expect(MOTIVO_SEM_AVISO).toContain(FERRAMENTA_ANUNCIAR);
    expect(s.decidirEdicao({ file_path: join(tmpdir(), "rascunho.txt") })).toBeNull();
    s.anunciar("Ajustes", ["src/a.ts"]);
    expect(s.decidirEdicao({ file_path: join(pasta, "src", "a.ts") })).toBeNull();
  });

  it("o aviso termina quando o Claude termina, e a sala recebe o fim (AC 6)", () => {
    const enviadas: MensagemDoConector[] = [];
    const s = new StatusDoClaude((m) => enviadas.push(m), Date.now, temporaria());
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.anunciar("Ajustes", [], "a");
    s.evento("Stop", { session_id: "a" });
    expect(s.avisoAtivo).toBe(false);
    expect(s.decidirEdicao({ file_path: "x.ts", session_id: "a" })).not.toBeNull();
    expect(enviadas.map((m) => m.tipo)).toEqual(["status", "aviso", "aviso_fim", "status"]);
  });
});

describe("aviso por sessão (gate da 4.2)", () => {
  it("prompt novo depois de um Esc pede anúncio novo (REL-001)", () => {
    const s = new StatusDoClaude(() => {}, Date.now, temporaria());
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.preToolUse({ tool_name: FERRAMENTA_ANUNCIAR, session_id: "a", resumo: "Plano A", arquivos: [] });
    expect(s.decidirEdicao({ file_path: "x.ts", session_id: "a" })).toBeNull();
    // Esc: nenhum Stop. Outro prompt.
    s.evento("UserPromptSubmit", { session_id: "a" });
    expect(s.decidirEdicao({ file_path: "x.ts", session_id: "a" })).not.toBeNull();
  });

  it("outra sessão na mesma pasta não aproveita o aviso da primeira (REL-003)", () => {
    const s = new StatusDoClaude(() => {}, Date.now, temporaria());
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.evento("UserPromptSubmit", { session_id: "b" });
    s.preToolUse({ tool_name: FERRAMENTA_ANUNCIAR, session_id: "a", resumo: "Plano A", arquivos: [] });
    expect(s.decidirEdicao({ file_path: "x.ts", session_id: "b" })).not.toBeNull();
    expect(s.decidirEdicao({ file_path: "x.ts", session_id: "a" })).toBeNull();
  });

  it("o MCP repetindo o anúncio que o hook já registrou não manda de novo; sozinho, vale e vence com aviso à sala (REL-002)", () => {
    let agora = 0;
    const enviadas: MensagemDoConector[] = [];
    const s = new StatusDoClaude((m) => enviadas.push(m), () => agora, temporaria());
    s.preToolUse({ tool_name: FERRAMENTA_ANUNCIAR, session_id: "a", resumo: "Plano A", arquivos: ["x.ts"] });
    s.anunciar("Plano A", ["x.ts"]);
    expect(enviadas.filter((m) => m.tipo === "aviso")).toHaveLength(1);

    const sozinho = new StatusDoClaude((m) => enviadas.push(m), () => agora, temporaria());
    enviadas.length = 0;
    sozinho.anunciar("Sem hook", []);
    expect(sozinho.decidirEdicao({ file_path: "x.ts", session_id: "z" })).toBeNull();
    agora += 11 * 60 * 1000;
    sozinho.vencer();
    expect(sozinho.avisoAtivo).toBe(false);
    expect(enviadas.map((m) => m.tipo)).toEqual(["aviso", "aviso_fim"]);
  });

  it("..env está dentro da pasta; caminho longo demais fica fora do aviso (DATA-001, DATA-002)", () => {
    const pasta = temporaria();
    const s = new StatusDoClaude(() => {}, Date.now, pasta);
    expect(s.decidirEdicao({ file_path: join(pasta, "..env"), session_id: "a" })).not.toBeNull();
    const m = s.anunciar("x", ["..env", `${"a/".repeat(600)}b.ts`], "a");
    expect(m.arquivos).toEqual(["..env"]);
    expect(mensagemDoConector.safeParse(m).success).toBe(true);
  });
});

// Um processo do plugin com a entrada pela entrada padrão.
function processo(script: string, entrada: string, env: Record<string, string>, cwd: string) {
  return new Promise<{ codigo: number | null; saida: string }>((resolver) => {
    const filho = spawn(process.execPath, [join(PLUGIN, script)], { env: { ...process.env, ...env }, cwd, stdio: ["pipe", "pipe", "ignore"] });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += d));
    filho.on("close", (codigo) => resolver({ codigo, saida }));
    filho.stdin.end(entrada);
  });
}

async function jam() {
  const local = temporaria();
  const pasta = temporaria();
  const enviadas: MensagemDoConector[] = [];
  const status = new StatusDoClaude((m) => enviadas.push(m), Date.now, pasta);
  const servidor = await abrirServidorDeHooks({
    aoEvento: (nome, corpo) => (nome === "PreToolUse" ? status.preToolUse(corpo) : status.evento(nome, corpo)),
    aoAnunciar: (corpo) => {
      const aviso = status.anunciar(String(corpo.resumo), (corpo.arquivos as string[]) ?? []);
      return { status: 200, corpo: { mensagem: `Anunciado para a jam: ${aviso.resumo}. Pode editar.` } };
    },
  });
  const amb = { pastaDados: join(local, "coodevelopment"), plataforma: process.platform } as Ambiente;
  await registrarPasta(amb, { jamId: "k7m2-rbq9", pid: process.pid, pasta, porta: servidor.porta, segredo: servidor.segredo });
  return { pasta, enviadas, servidor, env: { LOCALAPPDATA: local, CLAUDE_PROJECT_DIR: pasta } };
}

const linhas = (...msgs: object[]) => msgs.map((m) => JSON.stringify(m)).join("\n") + "\n";

describe("servidor MCP do plugin (AC 1 e 4)", () => {
  it("responde ao initialize, lista a ferramenta e o anunciar chega ao conector", async () => {
    const j = await jam();
    try {
      const r = await processo(
        "mcp.mjs",
        linhas(
          { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "1" } } },
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
          { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "anunciar", arguments: { resumo: "Login com Google", arquivos: ["src/auth.ts"] } } },
          { jsonrpc: "2.0", id: 4, method: "nao/existe" },
        ),
        j.env,
        j.pasta,
      );
      // JSON-RPC permite responder fora de ordem: o id casa cada resposta.
      const respostas = r.saida
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l))
        .sort((a, b) => a.id - b.id);
      expect(respostas.map((x) => x.id)).toEqual([1, 2, 3, 4]);
      expect(respostas[0].result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "coodevelopment" } });
      const ferramenta = respostas[1].result.tools[0];
      expect(ferramenta).toMatchObject({ name: "anunciar", inputSchema: { required: ["resumo", "arquivos"] } });
      // A descrição pede para anunciar também antes de comandos de terminal (AC 4).
      expect(ferramenta.description).toMatch(/comandos de terminal/);
      expect(respostas[2].result).toEqual({ content: [{ type: "text", text: "Anunciado para a jam: Login com Google. Pode editar." }] });
      expect(respostas[3].error).toMatchObject({ code: -32601 });
      expect(j.enviadas).toEqual([{ v: 1, tipo: "aviso", resumo: "Login com Google", arquivos: ["src/auth.ts"] }]);
    } finally {
      await j.servidor.fechar();
    }
  });

  it("fora de uma jam, o anunciar diz que pode seguir", async () => {
    const r = await processo(
      "mcp.mjs",
      linhas({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "anunciar", arguments: { resumo: "x", arquivos: [] } } }),
      { LOCALAPPDATA: temporaria(), CLAUDE_PROJECT_DIR: temporaria() },
      temporaria(),
    );
    expect(JSON.parse(r.saida).result.content[0].text).toMatch(/não está ligada a uma jam/);
  });
});

describe("hook PreToolUse (AC 3)", () => {
  it("sem aviso, devolve a recusa com o motivo; depois do anunciar, a edição segue sem nada na saída", async () => {
    const j = await jam();
    try {
      const edicao = JSON.stringify({
        session_id: "s1",
        cwd: j.pasta,
        hook_event_name: "PreToolUse",
        tool_name: "Edit",
        tool_input: { file_path: join(j.pasta, "src", "a.ts"), old_string: "segredo", new_string: "x" },
      });
      const recusada = await processo("hook.mjs", edicao, j.env, j.pasta);
      expect(recusada.codigo).toBe(0);
      expect(JSON.parse(recusada.saida)).toEqual({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: MOTIVO_SEM_AVISO },
      });
      await fetch(`http://127.0.0.1:${j.servidor.porta}/mcp/anunciar`, {
        method: "POST",
        headers: { authorization: `Bearer ${j.servidor.segredo}` },
        body: JSON.stringify({ resumo: "Ajustes", arquivos: ["src/a.ts"] }),
      });
      expect(await processo("hook.mjs", edicao, j.env, j.pasta)).toEqual({ codigo: 0, saida: "" });
    } finally {
      await j.servidor.fechar();
    }
  });

  it("fora de uma jam, a edição segue sem nada na saída", async () => {
    const pasta = temporaria();
    const r = await processo(
      "hook.mjs",
      JSON.stringify({ session_id: "s1", cwd: pasta, hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(pasta, "a.ts"), content: "x" } }),
      { LOCALAPPDATA: temporaria(), CLAUDE_PROJECT_DIR: pasta },
      pasta,
    );
    expect(r).toEqual({ codigo: 0, saida: "" });
  });
});
