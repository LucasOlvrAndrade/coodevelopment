import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import type { Ambiente, ResultadoProcesso } from "../../src/ambiente";

// Ambiente sem rede, sem git e sem PowerShell: as respostas do app vêm de uma
// tabela por "MÉTODO caminho" e os programas, de uma função. O disco é uma
// pasta temporária de verdade (sessão em texto, como fora do Windows).

export type RespostaFalsa = { status?: number; corpo?: unknown };

export function ambienteFalso(opcoes: {
  respostas?: Record<string, RespostaFalsa | RespostaFalsa[]>;
  rodar?: (programa: string, argumentos: string[], extra?: { cwd?: string; env?: Record<string, string> }) => Partial<ResultadoProcesso>;
  cwd?: string;
  versaoNode?: string;
} = {}) {
  const linhas: string[] = [];
  const pedidos: { metodo: string; caminho: string; cabecalhos: Record<string, string>; corpo: unknown }[] = [];
  const filas = new Map(Object.entries(opcoes.respostas ?? {}).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));

  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const { pathname } = new URL(String(url));
    const metodo = init?.method ?? "GET";
    pedidos.push({
      metodo,
      caminho: pathname,
      cabecalhos: Object.fromEntries(new Headers(init?.headers).entries()),
      corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const fila = filas.get(`${metodo} ${pathname}`);
    const resposta = fila && (fila.length > 1 ? fila.shift()! : fila[0]!);
    if (!resposta) throw new TypeError(`fetch failed: ${metodo} ${pathname}`);
    return new Response(JSON.stringify(resposta.corpo ?? {}), { status: resposta.status ?? 200 });
  });

  const rodar = vi.fn(async (programa: string, argumentos: string[], extra?: { cwd?: string; env?: Record<string, string> }) => ({
    codigo: 0,
    saida: "",
    erro: "",
    ...(opcoes.rodar?.(programa, argumentos, extra) ?? { codigo: 127 }),
  }));

  const amb: Ambiente = {
    urlApp: "https://app.teste",
    pastaDados: mkdtempSync(join(tmpdir(), "coodev-dados-")),
    cwd: opcoes.cwd ?? mkdtempSync(join(tmpdir(), "coodev-pasta-")),
    plataforma: "linux",
    versaoNode: opcoes.versaoNode ?? "22.12.0",
    fetch: fetch as unknown as typeof globalThis.fetch,
    rodar,
    abrirNavegador: vi.fn(),
    esperar: vi.fn(async () => {}),
    escrever: (linha) => linhas.push(linha),
  };
  return { amb, linhas, pedidos, rodar, fetch };
}
