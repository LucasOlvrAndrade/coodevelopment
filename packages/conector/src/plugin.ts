import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Ambiente } from "./ambiente";

// Instalação do plugin do Claude Code na pasta da jam (Story 4.1, FR11). O
// plugin vai dentro do pacote do conector; ele é copiado para um marketplace
// local em %LOCALAPPDATA%\coodevelopment\marketplace e instalado com escopo
// local, que grava em .claude/settings.local.json (fora do git e fora da
// sincronização). O Claude Code lê o plugin direto dessa pasta: copiar a
// versão nova já atualiza, valendo na próxima sessão ou com /reload-plugins
// (conferido no Claude Code 2.1.316 em 03/11).

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const NOME = "coodevelopment";
// Só o que o Claude Code usa; testes e configuração de build ficam de fora.
const PARTES = [".claude-plugin", "hooks", "scripts", ".mcp.json"];

async function existe(caminho: string) {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

// No pacote publicado, dist/plugin; no repositório, packages/plugin.
export async function pastaDoPlugin(): Promise<string> {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const publicado = join(aqui, "plugin");
  return (await existe(join(publicado, ".claude-plugin"))) ? publicado : join(aqui, "..", "..", "plugin");
}

// Copia o plugin desta versão do conector para o marketplace local.
export async function prepararMarketplace(amb: Ambiente, origem: string): Promise<string> {
  const marketplace = join(amb.pastaDados, "marketplace");
  const destino = join(marketplace, "plugins", NOME);
  await rm(destino, { recursive: true, force: true });
  await mkdir(destino, { recursive: true });
  for (const parte of PARTES) await cp(join(origem, parte), join(destino, parte), { recursive: true });
  const manifesto = JSON.parse(await readFile(join(destino, ".claude-plugin", "plugin.json"), "utf8")) as Record<string, unknown>;
  await writeFile(join(destino, ".claude-plugin", "plugin.json"), JSON.stringify({ ...manifesto, version }, null, 2));
  await mkdir(join(marketplace, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(marketplace, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      {
        name: NOME,
        owner: { name: "Coodevelopment" },
        plugins: [{ name: NOME, source: `./plugins/${NOME}`, description: manifesto.description, version }],
      },
      null,
      2,
    ),
  );
  return marketplace;
}

// Como chamar o claude: no Windows ele pode ser o .exe do instalador ou o
// .cmd do npm, que o Node só roda por um shell.
async function comandoDoClaude(amb: Ambiente): Promise<{ programa: string; shell: boolean } | null> {
  if (amb.plataforma !== "win32") {
    const r = await amb.rodar("which", ["claude"]);
    return r.codigo === 0 ? { programa: "claude", shell: false } : null;
  }
  const r = await amb.rodar("where", ["claude"]);
  const caminhos = r.codigo === 0 ? r.saida.split(/\r?\n/).filter(Boolean) : [];
  const exe = caminhos.find((c) => /\.exe$/i.test(c));
  if (exe) return { programa: exe, shell: false };
  const cmd = caminhos.find((c) => /\.(cmd|bat)$/i.test(c));
  return cmd ? { programa: `"${cmd}"`, shell: true } : null;
}

export type ResultadoDoPlugin = "instalado" | "sem_claude" | "falhou";

// Instala ou atualiza o plugin para a pasta. Nunca impede a jam: sem o Claude
// Code, ou se ele recusar, a sincronização segue e o terminal diz o que fazer.
export async function instalarPlugin(amb: Ambiente, pasta: string): Promise<ResultadoDoPlugin> {
  const claude = await comandoDoClaude(amb);
  if (!claude) {
    amb.escrever("O Claude Code não foi encontrado neste PC. Os arquivos sincronizam normalmente; para o status ao vivo, instale o Claude Code e rode este comando de novo.");
    return "sem_claude";
  }
  let marketplace: string;
  try {
    marketplace = await prepararMarketplace(amb, await pastaDoPlugin());
  } catch (e) {
    amb.escrever(`Não consegui preparar o plugin do Claude Code (${String(e)}). Os arquivos sincronizam normalmente.`);
    return "falhou";
  }
  const rodar = (argumentos: string[]) =>
    amb.rodar(claude.programa, claude.shell ? argumentos.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : argumentos, { cwd: pasta, shell: claude.shell });
  for (const argumentos of [
    ["plugin", "marketplace", "add", marketplace, "--scope", "local"],
    ["plugin", "install", `${NOME}@${NOME}`, "--scope", "local"],
  ]) {
    const r = await rodar(argumentos);
    if (r.codigo !== 0) {
      amb.escrever(`O Claude Code não instalou o plugin da jam (${(r.erro || r.saida).trim().split(/\r?\n/).at(-1) ?? "sem detalhe"}). Os arquivos sincronizam normalmente.`);
      return "falhou";
    }
  }
  amb.escrever("Plugin do Claude Code pronto nesta pasta. Se o Claude Code já estava aberto aqui, rode /reload-plugins nele (ou abra de novo).");
  return "instalado";
}
