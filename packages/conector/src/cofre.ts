import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Ambiente } from "./ambiente";

// Sessão do conector guardada no disco (security-and-performance.md): no
// Windows, cifrada com a DPAPI do usuário (só ele, nesta máquina, decifra).
// A DPAPI vem do .NET pelo Windows PowerShell, sem dependência nativa; o
// conteúdo vai e volta em base64 pela entrada e saída padrão, nunca na linha
// de comando. Fora do Windows (amigos, depois do MVP), arquivo só do usuário.

const SCRIPT = (operacao: "Protect" | "Unprotect") =>
  "Add-Type -AssemblyName System.Security;" +
  "$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim());" +
  `$o=[Security.Cryptography.ProtectedData]::${operacao}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);` +
  "[Console]::Out.Write([Convert]::ToBase64String($o))";

async function dpapi(amb: Ambiente, operacao: "Protect" | "Unprotect", dados: Buffer): Promise<Buffer> {
  const r = await amb.rodar("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT(operacao)], {
    entrada: dados.toString("base64"),
  });
  if (r.codigo !== 0) throw new Error(`DPAPI (${operacao}) falhou: ${r.erro.trim().split("\n")[0] ?? r.codigo}`);
  return Buffer.from(r.saida.trim(), "base64");
}

export const caminhoDaSessao = (amb: Ambiente) => join(amb.pastaDados, "sessao.bin");

export async function guardarSessao(amb: Ambiente, token: string): Promise<void> {
  const arquivo = caminhoDaSessao(amb);
  await mkdir(dirname(arquivo), { recursive: true });
  const dados = Buffer.from(token, "utf8");
  await writeFile(arquivo, amb.plataforma === "win32" ? await dpapi(amb, "Protect", dados) : dados, { mode: 0o600 });
}

// Sem arquivo, null. Arquivo que não decifra (outro usuário, outra máquina,
// corrompido) também é null: o conector refaz o login.
export async function lerSessao(amb: Ambiente): Promise<string | null> {
  const dados = await readFile(caminhoDaSessao(amb)).catch(() => null);
  if (!dados) return null;
  if (amb.plataforma !== "win32") return dados.toString("utf8") || null;
  return (await dpapi(amb, "Unprotect", dados).catch(() => null))?.toString("utf8") || null;
}

export async function apagarSessao(amb: Ambiente): Promise<void> {
  await rm(caminhoDaSessao(amb), { force: true });
}
