import { createRequire } from "node:module";
import type { Ambiente } from "./ambiente";
import { encerrarSessao, ErroApi, SemConexao } from "./api";
import { apagarSessao, lerSessao } from "./cofre";
import { diagnosticar, formatarDiagnostico } from "./diagnostico";
import { entrar, ErroDoUsuario } from "./entrar";
import { LoginRecusado } from "./login";
import { PastaErrada } from "./pasta";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const AJUDA = `coodevelopment ${version}

Liga o Claude Code e a pasta do projeto a uma jam do Coodevelopment.

Uso:
  npx coodevelopment entrar <jam>   entra na jam a partir da pasta atual (Ctrl+C desliga)
  npx coodevelopment diagnostico    mostra o que está ligado e o que falta
  npx coodevelopment sair           encerra a sessão do conector neste computador

Opções:
  --version   mostra a versão
  --help      mostra esta ajuda`;

export type Resultado = { saida: string; codigo: number };

// Erros que a pessoa resolve sozinha viram uma frase; o resto, a mensagem crua.
function explicar(e: unknown): string {
  if (e instanceof ErroDoUsuario || e instanceof LoginRecusado || e instanceof PastaErrada || e instanceof SemConexao) return e.message;
  if (e instanceof ErroApi) return `O app recusou o pedido: ${e.message}`;
  return `Algo deu errado: ${e instanceof Error ? e.message : String(e)}`;
}

async function sair(amb: Ambiente): Promise<Resultado> {
  const sessao = await lerSessao(amb);
  if (!sessao) return { saida: "Este computador não tem sessão do conector.", codigo: 0 };
  // Encerra no app; se o app não responde, apaga daqui mesmo assim e avisa.
  const encerrada = await encerrarSessao(amb, sessao).then(
    () => true,
    () => false,
  );
  await apagarSessao(amb);
  return encerrada
    ? { saida: "Sessão do conector encerrada neste computador.", codigo: 0 }
    : { saida: "Sessão apagada deste computador, mas o app não respondeu para encerrá-la lá. Ela vence sozinha em até 7 dias.", codigo: 0 };
}

export async function executar(argumentos: string[], amb: Ambiente, parar: Promise<void> = new Promise(() => {})): Promise<Resultado> {
  const [primeiro, segundo] = argumentos;

  if (primeiro === "--version" || primeiro === "-v") return { saida: version, codigo: 0 };
  if (primeiro === undefined || primeiro === "--help" || primeiro === "-h") return { saida: AJUDA, codigo: 0 };

  try {
    switch (primeiro) {
      case "entrar":
        if (!segundo) return { saida: "Falta o identificador da jam: npx coodevelopment entrar <jam>", codigo: 1 };
        await entrar(amb, segundo, parar);
        return { saida: "", codigo: 0 };
      case "diagnostico": {
        const itens = await diagnosticar(amb);
        return { saida: formatarDiagnostico(itens), codigo: itens.some((i) => !i.ok && !i.informativo) ? 1 : 0 };
      }
      case "sair":
        return await sair(amb);
      default:
        return { saida: `Comando desconhecido: ${primeiro}\n\n${AJUDA}`, codigo: 1 };
    }
  } catch (e) {
    return { saida: explicar(e), codigo: 1 };
  }
}
