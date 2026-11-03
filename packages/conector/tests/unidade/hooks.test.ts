import { mensagemDoConector, type MensagemStatus } from "@coodevelopment/protocolo";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ambiente } from "../../src/ambiente";
import { registrarPasta } from "../../src/descoberta";
import { SESSAO_VALE_MS, StatusDoClaude, abrirServidorDeHooks } from "../../src/hooks";
import { instalarPlugin, prepararMarketplace } from "../../src/plugin";

// Story 4.1: o servidor local dos hooks, o status do Claude e a instalação
// do plugin.

const limpar: string[] = [];
afterEach(() => {
  for (const p of limpar.splice(0)) rmSync(p, { recursive: true, force: true });
});
function temporaria() {
  const p = mkdtempSync(join(tmpdir(), "coodev-hooks-"));
  limpar.push(p);
  return p;
}

describe("StatusDoClaude", () => {
  it("muda só quando a primeira sessão começa e a última termina; parada por erro leva o motivo (AC 2 e 3)", () => {
    const mensagens: MensagemStatus[] = [];
    const s = new StatusDoClaude((m) => mensagens.push(m));
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.evento("UserPromptSubmit", { session_id: "b" });
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.evento("Stop", { session_id: "a" });
    expect(mensagens).toEqual([{ v: 1, tipo: "status", estado: "trabalhando", motivo: null }]);
    s.evento("StopFailure", { session_id: "b", error: "rate_limit" });
    s.evento("UserPromptSubmit", { session_id: "c" });
    s.evento("StopFailure", { session_id: "c", error: "erro-que-ninguem-conhece" });
    s.evento("UserPromptSubmit", { session_id: "d" });
    s.evento("SessionEnd", { session_id: "d" });
    expect(mensagens.slice(1)).toEqual([
      { v: 1, tipo: "status", estado: "parado", motivo: "rate_limit" },
      { v: 1, tipo: "status", estado: "trabalhando", motivo: null },
      { v: 1, tipo: "status", estado: "parado", motivo: "unknown" },
      { v: 1, tipo: "status", estado: "trabalhando", motivo: null },
      { v: 1, tipo: "status", estado: "parado", motivo: null },
    ]);
  });

  it("Esc ou janela fechada sem Stop: o Claude ocioso (Notification) ou a validade tiram o status (gate da 4.1, REL-001)", () => {
    let agora = 0;
    const mensagens: MensagemStatus[] = [];
    const s = new StatusDoClaude((m) => mensagens.push(m), () => agora);
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.evento("Notification", { session_id: "a" });
    expect(s.trabalhando).toBe(false);

    s.evento("UserPromptSubmit", { session_id: "b" });
    agora += SESSAO_VALE_MS - 1000;
    // O fim de cada ferramenta renova: tarefa longa continua trabalhando.
    s.evento("PostToolUse", { session_id: "b" });
    agora += SESSAO_VALE_MS - 1000;
    s.vencer();
    expect(s.trabalhando).toBe(true);
    agora += 2000;
    s.vencer();
    expect(s.trabalhando).toBe(false);
    expect(mensagens.map((m) => m.estado)).toEqual(["trabalhando", "parado", "trabalhando", "parado"]);
  });

  it("PostToolUse atrasado, depois do Stop, não liga o status de novo (gate da 4.1, REL-008)", () => {
    const mensagens: MensagemStatus[] = [];
    const s = new StatusDoClaude((m) => mensagens.push(m));
    s.evento("UserPromptSubmit", { session_id: "a" });
    s.evento("Stop", { session_id: "a" });
    s.evento("PostToolUse", { session_id: "a" });
    expect(s.trabalhando).toBe(false);
    expect(mensagens.map((m) => m.estado)).toEqual(["trabalhando", "parado"]);
  });

  it("evento sem sessão, desconhecido ou Stop de sessão que não começou não muda nada", () => {
    const mensagens: MensagemStatus[] = [];
    const s = new StatusDoClaude((m) => mensagens.push(m));
    s.evento("UserPromptSubmit", {});
    s.evento("PreToolUse", { session_id: "a" });
    s.evento("Stop", { session_id: "a" });
    expect(mensagens).toEqual([]);
  });
});

describe("servidor local dos hooks (AC 4)", () => {
  it("só em 127.0.0.1, só com o segredo; responde na hora", async () => {
    const eventos: [string, unknown][] = [];
    const servidor = await abrirServidorDeHooks((nome, corpo) => eventos.push([nome, corpo]));
    try {
      const url = `http://127.0.0.1:${servidor.porta}/hook/UserPromptSubmit`;
      const corpo = JSON.stringify({ session_id: "s" });
      expect((await fetch(url, { method: "POST", body: corpo })).status).toBe(404);
      expect((await fetch(url, { method: "POST", body: corpo, headers: { authorization: "Bearer errado" } })).status).toBe(404);
      expect((await fetch(`http://127.0.0.1:${servidor.porta}/outra`, { method: "POST", body: corpo, headers: { authorization: `Bearer ${servidor.segredo}` } })).status).toBe(404);
      expect(eventos).toEqual([]);
      expect((await fetch(url, { method: "POST", body: corpo, headers: { authorization: `Bearer ${servidor.segredo}` } })).status).toBe(204);
      await vi.waitFor(() => expect(eventos).toEqual([["UserPromptSubmit", { session_id: "s" }]]));
      expect(servidor.segredo).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await servidor.fechar();
    }
  });
});

describe("do hook do Claude Code até a mensagem para a sala (AC 5)", () => {
  it("o script do plugin com a entrada documentada vira status válido para a sala", async () => {
    const local = temporaria();
    const projeto = temporaria();
    const mensagens: unknown[] = [];
    const status = new StatusDoClaude((m) => mensagens.push(m));
    const servidor = await abrirServidorDeHooks((nome, corpo) => status.evento(nome, corpo));
    try {
      const amb = { pastaDados: join(local, "coodevelopment"), plataforma: process.platform } as Ambiente;
      await registrarPasta(amb, { jamId: "k7m2-rbq9", pid: process.pid, pasta: projeto, porta: servidor.porta, segredo: servidor.segredo });
      const hook = join(__dirname, "..", "..", "..", "plugin", "scripts", "hook.mjs");
      const rodar = (entrada: object) =>
        new Promise<number | null>((resolver) => {
          const filho = spawn(process.execPath, [hook], { env: { ...process.env, LOCALAPPDATA: local, CLAUDE_PROJECT_DIR: projeto }, stdio: ["pipe", "ignore", "ignore"] });
          filho.on("close", resolver);
          filho.stdin.end(JSON.stringify(entrada));
        });
      const comum = { session_id: "abc123", transcript_path: "x.jsonl", cwd: join(projeto, "src"), permission_mode: "default" };
      expect(await rodar({ ...comum, hook_event_name: "UserPromptSubmit", prompt: "Write a function" })).toBe(0);
      await vi.waitFor(() => expect(mensagens).toHaveLength(1));
      expect(await rodar({ ...comum, hook_event_name: "Stop", last_assistant_message: "pronto" })).toBe(0);
      await vi.waitFor(() => expect(mensagens).toHaveLength(2));
      for (const m of mensagens) expect(mensagemDoConector.safeParse(m).success).toBe(true);
      expect(mensagens).toEqual([
        { v: 1, tipo: "status", estado: "trabalhando", motivo: null },
        { v: 1, tipo: "status", estado: "parado", motivo: null },
      ]);
    } finally {
      await servidor.fechar();
    }
  });
});

// Ambiente falso para a instalação: grava o que rodou.
function ambienteFalso(dados: string, respostas: Record<string, { codigo: number; saida?: string; erro?: string }>) {
  const rodou: { programa: string; argumentos: string[]; cwd?: string; shell?: boolean }[] = [];
  const linhas: string[] = [];
  const amb = {
    pastaDados: dados,
    plataforma: "win32",
    escrever: (l: string) => linhas.push(l),
    rodar: async (programa: string, argumentos: string[], opcoes: { cwd?: string; shell?: boolean } = {}) => {
      rodou.push({ programa, argumentos, cwd: opcoes.cwd, shell: opcoes.shell });
      const chave = programa === "where" ? "where" : argumentos.slice(0, 2).join(" ");
      const r = respostas[chave] ?? { codigo: 0 };
      return { codigo: r.codigo, saida: r.saida ?? "", erro: r.erro ?? "" };
    },
  } as unknown as Ambiente;
  return { amb, rodou, linhas };
}

describe("instalação do plugin (AC 1)", () => {
  it("copia o plugin com a versão do conector e instala com escopo local na pasta da jam", async () => {
    const dados = temporaria();
    const { amb, rodou, linhas } = ambienteFalso(dados, { where: { codigo: 0, saida: "C:\\Users\\Lucas\\.local\\bin\\claude.exe\r\n" } });
    expect(await instalarPlugin(amb, "C:\\jam")).toBe("instalado");
    const marketplace = join(dados, "marketplace");
    expect(rodou.slice(1)).toEqual([
      { programa: "C:\\Users\\Lucas\\.local\\bin\\claude.exe", argumentos: ["plugin", "marketplace", "add", marketplace, "--scope", "local"], cwd: "C:\\jam", shell: false },
      { programa: "C:\\Users\\Lucas\\.local\\bin\\claude.exe", argumentos: ["plugin", "install", "coodevelopment@coodevelopment", "--scope", "local"], cwd: "C:\\jam", shell: false },
      // O update grava a versão nova no registro do Claude Code (gate da 4.1, REL-002).
      { programa: "C:\\Users\\Lucas\\.local\\bin\\claude.exe", argumentos: ["plugin", "update", "coodevelopment@coodevelopment", "--scope", "local"], cwd: "C:\\jam", shell: false },
    ]);
    const { version } = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")) as { version: string };
    const manifesto = JSON.parse(readFileSync(join(marketplace, "plugins", "coodevelopment", ".claude-plugin", "plugin.json"), "utf8"));
    expect(manifesto).toMatchObject({ name: "coodevelopment", version });
    expect(JSON.parse(readFileSync(join(marketplace, ".claude-plugin", "marketplace.json"), "utf8"))).toMatchObject({
      name: "coodevelopment",
      plugins: [{ name: "coodevelopment", source: "./plugins/coodevelopment", version }],
    });
    expect(readFileSync(join(marketplace, "plugins", "coodevelopment", "scripts", "hook.mjs"), "utf8")).toContain("rodar");
    expect(linhas.at(-1)).toContain("/reload-plugins");
  });

  it("claude do npm (.cmd) roda por shell, com todo argumento entre aspas (REL-006)", async () => {
    const dados = join(temporaria(), "com espaço");
    const { amb, rodou } = ambienteFalso(dados, { where: { codigo: 0, saida: "C:\\Program Files\\nodejs\\claude.cmd\r\n" } });
    await instalarPlugin(amb, "C:\\jam");
    expect(rodou[1]).toMatchObject({ programa: '"C:\\Program Files\\nodejs\\claude.cmd"', shell: true });
    expect(rodou[1]!.argumentos).toEqual(["\"plugin\"", "\"marketplace\"", "\"add\"", `"${join(dados, "marketplace")}"`, "\"--scope\"", "\"local\""]);
  });

  it("sem o Claude Code, ou se ele recusar, a jam segue e o terminal explica", async () => {
    let t = ambienteFalso(temporaria(), { where: { codigo: 1 } });
    expect(await instalarPlugin(t.amb, "C:\\jam")).toBe("sem_claude");
    expect(t.linhas.join("\n")).toContain("O Claude Code não foi encontrado");
    t = ambienteFalso(temporaria(), { where: { codigo: 0, saida: "C:\\claude.exe" }, "plugin install": { codigo: 1, erro: "Plugin not found" } });
    expect(await instalarPlugin(t.amb, "C:\\jam")).toBe("falhou");
    expect(t.linhas.at(-1)).toContain("Plugin not found");
  });

  it("copiar de novo substitui a versão anterior (o Claude Code lê o plugin direto da pasta)", async () => {
    const dados = temporaria();
    const amb = { pastaDados: dados } as Ambiente;
    const origem = join(__dirname, "..", "..", "..", "plugin");
    await prepararMarketplace(amb, origem);
    await prepararMarketplace(amb, origem);
    expect(readFileSync(join(dados, "marketplace", "plugins", "coodevelopment", "hooks", "hooks.json"), "utf8")).toContain("UserPromptSubmit");
  });
});
