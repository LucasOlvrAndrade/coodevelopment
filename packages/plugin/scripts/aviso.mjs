// Hook do Claude Code para o Coodevelopment (Story 4.1). Lê a entrada JSON do
// hook, acha a jam da pasta pelo arquivo de descoberta do conector e avisa o
// conector local (127.0.0.1, com o segredo da sessão dele). Sem jam, sem
// conector ou com qualquer erro, sai em silêncio com código 0: o Claude Code
// segue normal (NFR5). Nunca escreve na saída padrão, que viraria contexto
// do Claude. O texto do prompt não sai daqui.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Prazos: o POST ao conector e o hook inteiro, contado desde o início do
// processo (o prompt espera por ele; gate da 4.1, REL-005).
export const PRAZO_DO_AVISO_MS = 500;
export const PRAZO_MS = 800;

// A mesma chave do conector (packages/conector/src/descoberta.ts).
export function chaveDaPasta(pasta, plataforma = process.platform) {
  const normal = resolve(pasta).replace(/[\\/]+$/, "");
  return createHash("sha1")
    .update(plataforma === "win32" ? normal.toLowerCase() : normal)
    .digest("hex");
}

export function pastaDados(env = process.env) {
  return join(env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "coodevelopment");
}

// A jam da pasta do projeto ou de uma pasta acima (o Claude pode estar numa
// subpasta). Primeiro a raiz da sessão, depois o cwd do hook.
export async function acharJam(pastas, dados) {
  for (const inicio of pastas.filter(Boolean)) {
    let atual = resolve(inicio);
    for (;;) {
      const lido = await readFile(join(dados, "pastas", `${chaveDaPasta(atual)}.json`), "utf8").catch(() => null);
      if (lido) {
        try {
          const d = JSON.parse(lido);
          if (typeof d.porta === "number" && typeof d.segredo === "string") return d;
        } catch {
          // Arquivo pela metade: segue procurando.
        }
      }
      const acima = dirname(atual);
      if (acima === atual) break;
      atual = acima;
    }
  }
  return null;
}

// Só o que o conector usa; o prompt e a última mensagem ficam aqui.
export function corpoDoAviso(entrada) {
  return {
    session_id: entrada.session_id,
    hook_event_name: entrada.hook_event_name,
    error: entrada.error ?? entrada.error_type ?? null,
    reason: entrada.reason ?? null,
  };
}

export async function rodar(entrada, env = process.env) {
  if (!entrada || typeof entrada.hook_event_name !== "string" || typeof entrada.session_id !== "string") return;
  const jam = await acharJam([env.CLAUDE_PROJECT_DIR, entrada.cwd], pastaDados(env));
  if (!jam) return;
  await fetch(`http://127.0.0.1:${jam.porta}/hook/${encodeURIComponent(entrada.hook_event_name)}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${jam.segredo}` },
    body: JSON.stringify(corpoDoAviso(entrada)),
    signal: AbortSignal.timeout(PRAZO_DO_AVISO_MS),
  });
}
