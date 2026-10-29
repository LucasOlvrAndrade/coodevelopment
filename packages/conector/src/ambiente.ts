import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// Tudo o que o conector faz fora dele mesmo: rede, git, PowerShell, disco,
// relógio e terminal. Os comandos recebem um Ambiente; os testes passam um
// falso, sem tocar em nada da máquina.

export type ResultadoProcesso = { codigo: number; saida: string; erro: string };

export type Ambiente = {
  urlApp: string;
  // %LOCALAPPDATA%\coodevelopment: sessão e arquivos de descoberta.
  pastaDados: string;
  cwd: string;
  plataforma: NodeJS.Platform;
  versaoNode: string;
  fetch: typeof fetch;
  // Roda um programa sem shell; a entrada vai pela entrada padrão.
  rodar(programa: string, argumentos: string[], opcoes?: { cwd?: string; entrada?: string; env?: Record<string, string> }): Promise<ResultadoProcesso>;
  abrirNavegador(url: string): void;
  esperar(ms: number): Promise<void>;
  escrever(linha: string): void;
};

export const URL_APP_PADRAO = "https://coodevelopment.lucas-andrade.dev";

function rodar(programa: string, argumentos: string[], opcoes: { cwd?: string; entrada?: string; env?: Record<string, string> } = {}) {
  return new Promise<ResultadoProcesso>((resolve) => {
    const filho = spawn(programa, argumentos, {
      cwd: opcoes.cwd,
      env: { ...process.env, ...opcoes.env },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let saida = "";
    let erro = "";
    filho.stdout.setEncoding("utf8").on("data", (d: string) => (saida += d));
    filho.stderr.setEncoding("utf8").on("data", (d: string) => (erro += d));
    // Programa que não existe (git ou PowerShell fora do PATH): código 127, como no shell.
    filho.on("error", (e) => resolve({ codigo: 127, saida, erro: String(e) }));
    filho.on("close", (codigo) => resolve({ codigo: codigo ?? 1, saida, erro }));
    filho.stdin.end(opcoes.entrada ?? "");
  });
}

function abrirNavegador(url: string) {
  // Sem shell: o "&" de uma URL não vira outro comando no cmd.
  const [programa, argumentos] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(programa, argumentos, { detached: true, stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
  } catch {
    // Sem navegador, a pessoa abre o link mostrado no terminal.
  }
}

export function ambienteReal(): Ambiente {
  const base = process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share");
  return {
    urlApp: (process.env.COODEVELOPMENT_URL ?? URL_APP_PADRAO).replace(/\/+$/, ""),
    pastaDados: join(base, "coodevelopment"),
    cwd: process.cwd(),
    plataforma: process.platform,
    versaoNode: process.versions.node,
    fetch: globalThis.fetch,
    rodar,
    abrirNavegador,
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    escrever: (linha) => console.log(linha),
  };
}
