import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Ambiente } from "./ambiente";

// Arquivo de descoberta da pasta (components.md): diz aos hooks do Claude
// Code (Epic 4) que esta pasta está ligada a uma jam e qual processo cuida
// dela. Fica em %LOCALAPPDATA%\coodevelopment\pastas\<sha1 do caminho>.json.
// A porta e o segredo do servidor local entram com os hooks, na Story 4.1.

export type Descoberta = { jamId: string; pid: number; pasta: string };

// O mesmo caminho escrito de jeitos diferentes (barra, maiúscula no Windows) dá o mesmo arquivo.
export function chaveDaPasta(pasta: string, plataforma: NodeJS.Platform): string {
  const normal = resolve(pasta).replace(/[\\/]+$/, "");
  return createHash("sha1")
    .update(plataforma === "win32" ? normal.toLowerCase() : normal)
    .digest("hex");
}

const arquivo = (amb: Ambiente, pasta: string) => join(amb.pastaDados, "pastas", `${chaveDaPasta(pasta, amb.plataforma)}.json`);

export async function registrarPasta(amb: Ambiente, descoberta: Descoberta): Promise<void> {
  const destino = arquivo(amb, descoberta.pasta);
  await mkdir(join(amb.pastaDados, "pastas"), { recursive: true });
  await writeFile(destino, JSON.stringify(descoberta), { mode: 0o600 });
}

export async function lerPasta(amb: Ambiente, pasta: string): Promise<Descoberta | null> {
  const dados = await readFile(arquivo(amb, pasta), "utf8").catch(() => null);
  if (!dados) return null;
  try {
    return JSON.parse(dados) as Descoberta;
  } catch {
    return null;
  }
}

export async function esquecerPasta(amb: Ambiente, pasta: string): Promise<void> {
  await rm(arquivo(amb, pasta), { force: true });
}

// O processo do arquivo ainda roda? (um arquivo velho fica depois de um fechamento à força)
export function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}
