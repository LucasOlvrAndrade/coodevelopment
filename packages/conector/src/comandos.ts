import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const AJUDA = `coodevelopment ${version}

Liga o Claude Code e a pasta do projeto a uma jam do Coodevelopment.

Uso:
  npx coodevelopment entrar <jam>   entra na jam a partir da pasta atual
  npx coodevelopment diagnostico    mostra o que está ligado e o que falta
  npx coodevelopment sair           desliga esta pasta da jam

Opções:
  --version   mostra a versão
  --help      mostra esta ajuda`;

const COMANDOS_FUTUROS = new Set(["entrar", "diagnostico", "sair"]);

export type Resultado = { saida: string; codigo: number };

export function executar(argumentos: string[]): Resultado {
  const [primeiro] = argumentos;

  if (primeiro === "--version" || primeiro === "-v") return { saida: version, codigo: 0 };
  if (primeiro === undefined || primeiro === "--help" || primeiro === "-h") return { saida: AJUDA, codigo: 0 };
  if (COMANDOS_FUTUROS.has(primeiro)) {
    return { saida: `O comando "${primeiro}" ainda não está disponível nesta versão.`, codigo: 1 };
  }
  return { saida: `Comando desconhecido: ${primeiro}\n\n${AJUDA}`, codigo: 1 };
}
