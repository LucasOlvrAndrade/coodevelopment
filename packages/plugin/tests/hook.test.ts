import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chaveDaPasta as chaveDoConector } from "../../conector/src/descoberta";
import { acharJam, chaveDaPasta, corpoDoAviso, prazoDoHook, saida } from "../scripts/aviso.mjs";

// O script dos hooks (Story 4.1, AC 4 e 5): a entrada JSON documentada do
// Claude Code, o arquivo de descoberta do conector e um conector falso.

const HOOK = new URL("../scripts/hook.mjs", import.meta.url);
const limpar: string[] = [];
afterEach(() => {
  for (const p of limpar.splice(0)) rmSync(p, { recursive: true, force: true });
});

function temporaria() {
  const p = mkdtempSync(join(tmpdir(), "coodev-hook-"));
  limpar.push(p);
  return p;
}

// Um conector falso: guarda o que chega e responde 204, ou o que o teste pedir.
async function conectorFalso(responder?: (url: string) => unknown) {
  const recebidos: { url: string; autorizacao: string | undefined; corpo: unknown }[] = [];
  const servidor = createServer((req: IncomingMessage, res) => {
    let texto = "";
    req.on("data", (d) => (texto += d));
    req.on("end", () => {
      recebidos.push({ url: req.url ?? "", autorizacao: req.headers.authorization, corpo: JSON.parse(texto) });
      const resposta = responder?.(req.url ?? "");
      if (resposta) {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(resposta));
        return;
      }
      res.statusCode = 204;
      res.end();
    });
  });
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const porta = (servidor.address() as { port: number }).port;
  return { porta, recebidos, fechar: () => new Promise((r) => servidor.close(r)) };
}

// Roda o hook como o Claude Code roda: node, entrada JSON pela entrada padrão.
function rodarHook(entrada: unknown, env: Record<string, string>) {
  return new Promise<{ codigo: number | null; saida: string; ms: number }>((resolver) => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, [HOOK.pathname.replace(/^\/(\w:)/, "$1")], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += d));
    filho.on("close", (codigo) => resolver({ codigo, saida, ms: Date.now() - inicio }));
    filho.stdin.end(typeof entrada === "string" ? entrada : JSON.stringify(entrada));
  });
}

function registrar(dados: string, pasta: string, porta: number, segredo = "segredo-de-teste") {
  mkdirSync(join(dados, "pastas"), { recursive: true });
  writeFileSync(join(dados, "pastas", `${chaveDaPasta(pasta)}.json`), JSON.stringify({ jamId: "k7m2-rbq9", pid: process.pid, pasta, porta, segredo }));
}

describe("aviso.mjs", () => {
  it("a chave da pasta é a mesma do conector", () => {
    for (const p of ["C:\\Users\\Lucas\\projeto", "C:/Users/Lucas/Projeto/", "/home/lucas/projeto"]) {
      expect(chaveDaPasta(p, "win32")).toBe(chaveDoConector(p, "win32"));
      expect(chaveDaPasta(p, "linux")).toBe(chaveDoConector(p, "linux"));
    }
  });

  it("acha a jam numa pasta acima (o Claude numa subpasta)", async () => {
    const dados = temporaria();
    const projeto = temporaria();
    registrar(join(dados, "coodevelopment"), projeto, 1234);
    const sub = join(projeto, "src", "app");
    mkdirSync(sub, { recursive: true });
    expect(await acharJam([undefined, sub], join(dados, "coodevelopment"))).toMatchObject({ porta: 1234 });
    expect(await acharJam([temporaria()], join(dados, "coodevelopment"))).toBeNull();
  });

  it("o prompt e a última mensagem não saem do PC (AC 2)", () => {
    const corpo = corpoDoAviso({ session_id: "s1", hook_event_name: "UserPromptSubmit", prompt: "segredo do prompt", last_assistant_message: "x", cwd: "C:/p" });
    expect(JSON.stringify(corpo)).not.toContain("segredo do prompt");
    expect(corpo).toEqual({ session_id: "s1", hook_event_name: "UserPromptSubmit", error: null, reason: null });
  });
});

describe("hook.mjs rodando como o Claude Code roda (AC 4 e 5)", () => {
  it("com a jam: avisa o conector com o segredo, sem escrever nada na saída", async () => {
    const conector = await conectorFalso();
    try {
      const local = temporaria();
      const projeto = temporaria();
      registrar(join(local, "coodevelopment"), projeto, conector.porta);
      const env = { LOCALAPPDATA: local, CLAUDE_PROJECT_DIR: projeto };
      const r = await rodarHook({ session_id: "s1", transcript_path: "x", cwd: projeto, permission_mode: "default", hook_event_name: "UserPromptSubmit", prompt: "faça x" }, env);
      expect(r).toMatchObject({ codigo: 0, saida: "" });
      await rodarHook({ session_id: "s1", cwd: projeto, hook_event_name: "StopFailure", error: "rate_limit" }, env);
      expect(conector.recebidos).toEqual([
        { url: "/hook/UserPromptSubmit", autorizacao: "Bearer segredo-de-teste", corpo: { session_id: "s1", hook_event_name: "UserPromptSubmit", error: null, reason: null } },
        { url: "/hook/StopFailure", autorizacao: "Bearer segredo-de-teste", corpo: expect.objectContaining({ error: "rate_limit" }) },
      ]);
    } finally {
      await conector.fechar();
    }
  });

  it("fora de uma jam, com entrada estranha ou com o conector fora do ar: código 0, nada na saída, rápido", async () => {
    const local = temporaria();
    const projeto = temporaria();
    const env = { LOCALAPPDATA: local, CLAUDE_PROJECT_DIR: projeto };
    for (const entrada of [{ session_id: "s1", cwd: projeto, hook_event_name: "Stop" }, "isto não é json", ""]) {
      expect(await rodarHook(entrada, env)).toMatchObject({ codigo: 0, saida: "" });
    }
    // Arquivo de descoberta de um conector que já fechou: a porta não responde.
    registrar(join(local, "coodevelopment"), projeto, 1);
    const r = await rodarHook({ session_id: "s1", cwd: projeto, hook_event_name: "UserPromptSubmit" }, env);
    expect(r).toMatchObject({ codigo: 0, saida: "" });
    expect(r.ms).toBeLessThan(1500);
  });
});

describe("contexto dos outros Claudes (Story 4.3)", () => {
  it("a saída leva o contexto no UserPromptSubmit e no PreToolUse, junto com a recusa", () => {
    expect(saida("UserPromptSubmit", { contexto: "texto" })).toEqual({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "texto" } });
    expect(saida("PreToolUse", { decisao: "recusar", motivo: "anuncie", contexto: "texto" })).toEqual({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "anuncie", additionalContext: "texto" },
    });
    expect(saida("PreToolUse", { contexto: "texto" })).toEqual({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "texto" } });
    // Recusa só no PreToolUse; nada sem contexto nem recusa.
    expect(saida("UserPromptSubmit", { decisao: "recusar", motivo: "x" })).toBeNull();
    expect(saida("UserPromptSubmit", { contexto: "" })).toBeNull();
    expect(saida("UserPromptSubmit", null)).toBeNull();
  });

  it("hook.mjs escreve o contexto que o conector manda no prompt", async () => {
    const conector = await conectorFalso((url) => (url === "/hook/UserPromptSubmit" ? { contexto: "Kelson está no login" } : null));
    try {
      const local = temporaria();
      const projeto = temporaria();
      registrar(join(local, "coodevelopment"), projeto, conector.porta);
      const r = await rodarHook({ session_id: "s1", cwd: projeto, hook_event_name: "UserPromptSubmit", prompt: "faça x" }, { LOCALAPPDATA: local, CLAUDE_PROJECT_DIR: projeto });
      expect(r.codigo).toBe(0);
      expect(JSON.parse(r.saida)).toEqual({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "Kelson está no login" } });
    } finally {
      await conector.fechar();
    }
  });
});

describe("pergunta antes de mexer em arquivo de outro (Story 4.4)", () => {
  it("a saída do PreToolUse pede confirmação (ask) com o motivo", () => {
    expect(saida("PreToolUse", { decisao: "perguntar", motivo: "é do Kelson" })).toEqual({
      systemMessage: "é do Kelson",
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "é do Kelson" },
    });
    expect(saida("PreToolUse", { decisao: "outra", motivo: "x" })).toBeNull();
  });

  it("o PostToolUse manda a ferramenta e o caminho", () => {
    expect(corpoDoAviso({ session_id: "s", hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "a.ts", new_string: "segredo" } })).toEqual({
      session_id: "s",
      hook_event_name: "PostToolUse",
      error: null,
      reason: null,
      tool_name: "Edit",
      file_path: "a.ts",
    });
  });
});

describe("caminho do NotebookEdit (gate da 4.4, TEST-001)", () => {
  it("a pergunta leva o motivo também como mensagem à pessoa; a recusa e o contexto não (AC 1)", () => {
    expect(saida("PreToolUse", { decisao: "perguntar", motivo: "de Kelson" })).toMatchObject({ systemMessage: "de Kelson", hookSpecificOutput: { permissionDecision: "ask", permissionDecisionReason: "de Kelson" } });
    expect(saida("PreToolUse", { decisao: "recusar", motivo: "x" })).not.toHaveProperty("systemMessage");
    expect(saida("PreToolUse", { contexto: "x" })).not.toHaveProperty("systemMessage");
  });

  it("o id da chamada vai junto quando o Claude Code manda (gate da 4.4, REL-012)", () => {
    expect(prazoDoHook("PreToolUse")).toBeGreaterThan(prazoDoHook("Stop"));
    expect(corpoDoAviso({ session_id: "s", hook_event_name: "PostToolUse", tool_name: "Edit", tool_use_id: "t1", tool_input: { file_path: "a.ts" } })).toMatchObject({ tool_use_id: "t1" });
  });

  it("o notebook_path vai como file_path no PreToolUse e no PostToolUse", () => {
    for (const evento of ["PreToolUse", "PostToolUse"]) {
      expect(corpoDoAviso({ session_id: "s", hook_event_name: evento, tool_name: "NotebookEdit", tool_input: { notebook_path: "nb/a.ipynb" } })).toMatchObject({
        tool_name: "NotebookEdit",
        file_path: "nb/a.ipynb",
      });
    }
  });
});
