import { idDeJamValido, textoLimpo, type MensagemDoConector } from "@coodevelopment/protocolo";
import type { Ambiente } from "./ambiente";
import { dadosDaJam, ErroApi, tokenDeClone, type DadosDaJam } from "./api";
import { apagarSessao, guardarSessao, lerSessao } from "./cofre";
import { ContextoDosOutros, limpar, responderAoHook } from "./contexto";
import { esquecerPasta, registrarPasta } from "./descoberta";
import { StatusDoClaude, abrirServidorDeHooks } from "./hooks";
import { entrarPorDispositivo } from "./login";
import { instalarPlugin } from "./plugin";
import { clonar, conferirPasta, destinoDoClone, raizDoRepositorio, vazia } from "./pasta";
import { conectarNaSala, type ConexaoSala } from "./sala";
import { Sincronizador } from "./sincronizar";

// `npx coodevelopment entrar <jam>` (Story 3.1): login, pasta, sala. Fica
// rodando até Ctrl+C; a pasta se desliga da jam quando ele para.

export class ErroDoUsuario extends Error {}

async function sessaoNova(amb: Ambiente): Promise<string> {
  const sessao = await entrarPorDispositivo(amb);
  await guardarSessao(amb, sessao);
  amb.escrever("Pronto, este computador entrou na sua conta.");
  return sessao;
}

// A sessão guardada, ou um login novo. Se o app não reconhece a guardada
// (vencida ou encerrada pelo sair em outro lugar), faz o login de novo uma vez.
async function comSessao<T>(amb: Ambiente, f: (sessao: string) => Promise<T>): Promise<{ sessao: string; valor: T }> {
  const guardada = await lerSessao(amb);
  if (guardada) {
    try {
      return { sessao: guardada, valor: await f(guardada) };
    } catch (e) {
      if (!(e instanceof ErroApi && e.status === 401)) throw e;
      await apagarSessao(amb);
      amb.escrever("Sua sessão deste computador venceu. Vamos entrar de novo.");
    }
  }
  const sessao = await sessaoNova(amb);
  return { sessao, valor: await f(sessao) };
}

async function prepararPasta(amb: Ambiente, sessao: string, jam: DadosDaJam, pastaEscolhida: boolean): Promise<string> {
  // A pasta escolhida com --pasta, vazia, é para clonar, mesmo dentro de
  // outro repositório git (uma pasta nova dentro de Documentos versionado,
  // o %TEMP%): senão o conector pegaria o repositório de cima e recusaria.
  // Sem --pasta, rodar numa subpasta do repositório continua valendo.
  const raiz = pastaEscolhida && (await vazia(amb.cwd)) ? null : await raizDoRepositorio(amb, amb.cwd);
  if (raiz) {
    await conferirPasta(amb, raiz, jam.repo, jam.branch);
    return raiz;
  }
  const destino = await destinoDoClone(amb, jam.repo);
  if (destino.existe) {
    const raizDoDestino = await raizDoRepositorio(amb, destino.pasta);
    if (!raizDoDestino) {
      throw new ErroDoUsuario(`Já existe uma pasta ${destino.pasta} que não é um repositório git. Rode o comando numa pasta vazia.`);
    }
    await conferirPasta(amb, raizDoDestino, jam.repo, jam.branch);
    return raizDoDestino;
  }
  amb.escrever(`Clonando ${jam.repo.owner}/${jam.repo.nome} em ${destino.pasta}...`);
  const { token } = await tokenDeClone(amb, sessao, jam.jamId);
  await clonar(amb, jam.repo, jam.branch, destino.pasta, token);
  return destino.pasta;
}

const nomesDe = (jam: DadosDaJam) => new Map((jam.participantes ?? []).map((p) => [p.id, p.nome]));

export async function entrar(amb: Ambiente, jamId: string, parar: Promise<void>, pastaEscolhida = false): Promise<void> {
  if (!idDeJamValido(jamId)) {
    throw new ErroDoUsuario(`"${jamId}" não parece o identificador de uma jam. Ele tem o formato k7m2-rbq9 e aparece na página da jam.`);
  }

  const { sessao, valor: jam } = await comSessao(amb, (s) => dadosDaJam(amb, s, jamId)).catch((e: unknown) => {
    if (e instanceof ErroApi && e.status === 403) throw new ErroDoUsuario("Você não participa dessa jam. Peça para quem criou te chamar.");
    throw e;
  });
  if (jam.estado !== "aberta") throw new ErroDoUsuario(`A jam ${jam.nome} está fechada.`);

  const pasta = await prepararPasta(amb, sessao, jam, pastaEscolhida);
  amb.escrever(`Pasta do projeto: ${pasta}`);

  // Os arquivos da pasta sincronizam com a sala (Story 3.3). Antes de
  // conectar, o sincronizador sabe gravar; só depois de conectar ele vigia a
  // pasta, para nada sair sem conexão.
  // O que sair antes de a conexão existir espera numa fila, em vez de se perder.
  let conexaoDaSala: ConexaoSala | undefined = undefined;
  const antesDaConexao: MensagemDoConector[] = [];
  const enviar = (m: MensagemDoConector) => (conexaoDaSala ? conexaoDaSala.enviar(m) : antesDaConexao.push(m));
  const sincronizador = new Sincronizador(amb, pasta, jam.baseSha, jam.eu, { enviar });
  // O Claude Code desta pasta avisa pelos hooks quando trabalha (Story 4.1).
  const status = new StatusDoClaude(enviar, Date.now, pasta);
  // O que os Claudes dos outros anunciaram vai ao Claude desta pasta (Story 4.3).
  let nomesFalharam = false;
  const contexto = new ContextoDosOutros(jam.eu, nomesDe(jam), {
    // Alguém que entrou na jam depois: os nomes de novo, do app.
    buscarNomes: () =>
      dadosDaJam(amb, sessao, jamId)
        .then(nomesDe)
        .catch((e: unknown) => {
          if (!nomesFalharam) amb.escrever("Não consegui buscar os nomes de quem entrou na jam agora; o Claude vai ver \"outro participante\".");
          nomesFalharam = true;
          throw e;
        }),
  });
  const hooks = await abrirServidorDeHooks({
    // Arquivo de outro: a sala põe no feed e avisa quem anunciou (Story 4.4).
    aoEvento: (nome, corpo) =>
      responderAoHook(status, contexto, nome, corpo, (r) => {
        enviar({ v: 1, tipo: "reserva", caminho: r.caminho });
        amb.escrever(`Seu Claude Code pediu para mexer em ${r.caminho}, que está no aviso de ${r.nome} ("${r.resumo}"). Ele só segue se você confirmar no Claude Code.`);
      }),
    // O anunciar do servidor MCP do plugin (Story 4.2).
    aoAnunciar: (corpo) => {
      if (typeof corpo.resumo !== "string" || !textoLimpo(corpo.resumo) || !Array.isArray(corpo.arquivos)) return { status: 400, corpo: { mensagem: "Falta o resumo ou a lista de arquivos." } };
      const aviso = status.anunciar(corpo.resumo, corpo.arquivos.filter((a): a is string => typeof a === "string"));
      // Arquivos que já estão no aviso de outro: o Claude fica sabendo antes (Story 4.4).
      const deOutros = contexto.deOutros(aviso.arquivos);
      const atencao = deOutros.length
        ? ` Atenção: ${deOutros.map((r) => `${r.caminho} está no aviso de ${r.nome} ("${r.resumo}")`).join("; ")}. Editar esses arquivos vai pedir confirmação a quem está falando com você; combine antes.`
        : "";
      return { status: 200, corpo: { mensagem: `Anunciado para a jam: ${aviso.resumo}. Pode editar.${atencao}` } };
    },
  });
  const vencerSessoes = setInterval(() => status.vencer(), 60_000);
  vencerSessoes.unref();
  await sincronizador.preparar();
  const conexao = await conectarNaSala(amb, sessao, jamId, {
    aoConectar: () => amb.escrever(`Conectado à jam ${jam.nome}. Deixe esta janela aberta; Ctrl+C desliga.`),
    aoReceber: (m) => {
      if (m.tipo === "claudes") contexto.atualizar(m);
      // O Claude de outro pediu para mexer num arquivo do seu aviso (Story 4.4).
      else if (m.tipo === "reserva_pedida")
        amb.escrever(`O Claude Code de ${contexto.nomeDe(m.autorId)} pediu para mexer em ${limpar(m.caminho)}, que o seu Claude Code anunciou.`);
      else sincronizador.receber(m);
    },
    // Sem a sala, os avisos dos outros podem estar velhos (gate da 4.3, REL-001).
    aoCair: () => contexto.semSala(),
    aoReconectar: () => {
      sincronizador.reconectou();
      // A sala esquece o status da conexão que caiu: manda de novo, com o aviso.
      if (status.trabalhando) conexao.enviar({ v: 1, tipo: "status", estado: "trabalhando", motivo: null });
      const aviso = status.avisoAtual;
      if (aviso) conexao.enviar(aviso);
    },
  }).catch(async (e: unknown) => {
    await hooks.fechar();
    if (e instanceof ErroApi && e.status === 503) {
      throw new ErroDoUsuario("A sala ao vivo da jam ainda não está no ar. A pasta está pronta; tente conectar de novo mais tarde.");
    }
    throw e;
  });
  conexaoDaSala = conexao;
  for (const m of antesDaConexao.splice(0)) conexao.enviar(m);
  await registrarPasta(amb, { jamId, pid: process.pid, pasta, porta: hooks.porta, segredo: hooks.segredo });
  try {
    // Em paralelo: a instalação leva alguns segundos (e pode travar no
    // Claude Code), e a sincronização não espera por ela (gate da 4.1, REL-004).
    void instalarPlugin(amb, pasta).catch(() => {});
    await sincronizador.comecarAVigiar();
    const motivo = await Promise.race([conexao.fechou, parar.then(() => "")]);
    if (motivo) throw new ErroDoUsuario(motivo);
    amb.escrever("Desligado da jam.");
  } finally {
    clearInterval(vencerSessoes);
    await sincronizador.parar();
    await hooks.fechar();
    conexao.fechar();
    await esquecerPasta(amb, pasta);
  }
}
