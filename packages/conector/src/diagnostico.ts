import type { Ambiente } from "./ambiente";
import { ErroApi, quemSouEu } from "./api";
import { apagarSessao, lerSessao } from "./cofre";
import { lerPasta, processoVivo } from "./descoberta";
import { GIT_MINIMO, gitNovoOBastante, originDe, raizDoRepositorio, versaoDoGit } from "./pasta";

// `npx coodevelopment diagnostico` (Story 3.1, AC 4): o que está ligado e o
// que falta, cada linha com o que fazer.

export type Item = { nome: string; ok: boolean; detalhe: string; informativo?: boolean };

const NODE_MINIMO = 22;

async function versao(amb: Ambiente, programa: string, argumentos: string[]): Promise<string | null> {
  const r = await amb.rodar(programa, argumentos);
  return r.codigo === 0 ? r.saida.trim().split("\n")[0]!.trim() : null;
}

export async function diagnosticar(amb: Ambiente): Promise<Item[]> {
  const itens: Item[] = [];

  const maior = Number(amb.versaoNode.split(".")[0]);
  itens.push(
    maior >= NODE_MINIMO
      ? { nome: "Node.js", ok: true, detalhe: amb.versaoNode }
      : { nome: "Node.js", ok: false, detalhe: `${amb.versaoNode}; o conector precisa do ${NODE_MINIMO} ou mais novo. Instale pelo nodejs.org.` },
  );

  const git = await versao(amb, "git", ["--version"]);
  const numeroDoGit = git ? versaoDoGit(git) : null;
  itens.push(
    !git
      ? { nome: "Git", ok: false, detalhe: "não encontrado. Instale pelo git-scm.com." }
      : numeroDoGit && !gitNovoOBastante(numeroDoGit)
        ? { nome: "Git", ok: false, detalhe: `${git}; o conector precisa do ${GIT_MINIMO.join(".")} ou mais novo. Atualize pelo git-scm.com.` }
        : { nome: "Git", ok: true, detalhe: git },
  );

  const sessao = await lerSessao(amb);
  if (!sessao) {
    itens.push({ nome: "Sessão", ok: false, detalhe: "nenhuma neste computador. O comando entrar faz o login." });
  } else {
    try {
      const eu = await quemSouEu(amb, sessao);
      if (eu?.user) itens.push({ nome: "Sessão", ok: true, detalhe: `@${eu.user.login}` });
      else {
        await apagarSessao(amb);
        itens.push({ nome: "Sessão", ok: false, detalhe: "venceu. O comando entrar faz o login de novo." });
      }
    } catch (e) {
      itens.push({ nome: "Sessão", ok: false, detalhe: e instanceof ErroApi ? `o app respondeu ${e.status}.` : "não deu para conferir (app fora do ar ou sem internet)." });
    }
  }

  const resposta = await amb.fetch(`${amb.urlApp}/api/saude`).catch(() => null);
  const saude = resposta?.ok ? ((await resposta.json().catch(() => null)) as { app?: string; banco?: string; sala?: string } | null) : null;
  itens.push(
    saude?.app === "ok" && saude.banco === "ok"
      ? { nome: "App", ok: true, detalhe: amb.urlApp }
      : { nome: "App", ok: false, detalhe: `${amb.urlApp} não respondeu. Confira a internet e tente de novo.` },
  );
  // A sala ao vivo, pelo app (que sabe o endereço dela). Sem o app, não há o que dizer.
  if (saude) {
    itens.push(
      saude.sala === "ok"
        ? { nome: "Sala ao vivo", ok: true, detalhe: "no ar" }
        : saude.sala === "desligada"
          ? { nome: "Sala ao vivo", ok: false, detalhe: "ainda não está no ar. A pasta funciona, mas sem conectar à jam." }
          : { nome: "Sala ao vivo", ok: false, detalhe: "não respondeu agora. Tente de novo em alguns minutos." },
    );
  }

  const raiz = await raizDoRepositorio(amb, amb.cwd);
  if (!raiz) {
    itens.push({ nome: "Pasta", ok: false, detalhe: `${amb.cwd} não é um repositório git. Entre na pasta do projeto ou use o comando entrar para clonar.` });
  } else {
    const origin = await originDe(amb, raiz);
    const ligada = await lerPasta(amb, raiz);
    const jam = ligada && processoVivo(ligada.pid) ? `, ligada à jam ${ligada.jamId}` : ", sem jam ligada agora";
    itens.push({ nome: "Pasta", ok: true, detalhe: `${raiz}${origin ? ` (${origin.owner}/${origin.nome})` : ""}${jam}` });
  }

  // Só onde está: no Windows o claude é um .cmd, que o Node não roda sem shell.
  const claude = await versao(amb, amb.plataforma === "win32" ? "where" : "which", ["claude"]);
  itens.push(
    claude
      ? { nome: "Claude Code", ok: true, detalhe: claude, informativo: true }
      : { nome: "Claude Code", ok: false, detalhe: "não encontrado. A jam funciona sem ele, mas o status do Claude chega depois.", informativo: true },
  );

  return itens;
}

export function formatarDiagnostico(itens: Item[]): string {
  const linhas = itens.map((i) => `${i.ok ? "ok  " : i.informativo ? "--  " : "falta"} ${i.nome}: ${i.detalhe}`);
  const faltam = itens.filter((i) => !i.ok && !i.informativo).length;
  linhas.push("", faltam === 0 ? "Tudo pronto para entrar numa jam." : `${faltam === 1 ? "Falta 1 item" : `Faltam ${faltam} itens`} para entrar numa jam.`);
  return linhas.join("\n");
}
