import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chaveDaPasta as chaveDoConector } from "../../conector/src/descoberta";
import { acharJam, chaveDaPasta, corpoDoAviso } from "../scripts/aviso.mjs";

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

// Um conector falso: guarda o que chega e responde 204.
async function conectorFalso() {
  const recebidos: { url: string; autorizacao: string | undefined; corpo: unknown }[] = [];
  const servidor = createServer((req: IncomingMessage, res) => {
    let texto = "";
    req.on("data", (d) => (texto += d));
    req.on("end", () => {
      recebidos.push({ url: req.url ?? "", autorizacao: req.headers.authorization, corpo: JSON.parse(texto) });
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
