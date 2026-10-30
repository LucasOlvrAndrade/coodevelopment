import { idDeJamValido, type MensagemEscrever } from "@coodevelopment/protocolo";
import type { Ambiente } from "./ambiente";
import { dadosDaJam, ErroApi, tokenDeClone, type DadosDaJam } from "./api";
import { apagarSessao, guardarSessao, lerSessao } from "./cofre";
import { esquecerPasta, registrarPasta } from "./descoberta";
import { entrarPorDispositivo } from "./login";
import { clonar, conferirPasta, destinoDoClone, raizDoRepositorio } from "./pasta";
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

async function prepararPasta(amb: Ambiente, sessao: string, jam: DadosDaJam): Promise<string> {
  const raiz = await raizDoRepositorio(amb, amb.cwd);
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

export async function entrar(amb: Ambiente, jamId: string, parar: Promise<void>): Promise<void> {
  if (!idDeJamValido(jamId)) {
    throw new ErroDoUsuario(`"${jamId}" não parece o identificador de uma jam. Ele tem o formato k7m2-rbq9 e aparece na página da jam.`);
  }

  const { sessao, valor: jam } = await comSessao(amb, (s) => dadosDaJam(amb, s, jamId)).catch((e: unknown) => {
    if (e instanceof ErroApi && e.status === 403) throw new ErroDoUsuario("Você não participa dessa jam. Peça para quem criou te chamar.");
    throw e;
  });
  if (jam.estado !== "aberta") throw new ErroDoUsuario(`A jam ${jam.nome} está fechada.`);

  const pasta = await prepararPasta(amb, sessao, jam);
  amb.escrever(`Pasta do projeto: ${pasta}`);

  // Os arquivos da pasta sincronizam com a sala (Story 3.3). Antes de
  // conectar, o sincronizador sabe gravar; só depois de conectar ele vigia a
  // pasta, para nada sair sem conexão.
  // O que sair antes de a conexão existir espera numa fila, em vez de se perder.
  let conexaoDaSala: ConexaoSala | undefined = undefined;
  const antesDaConexao: MensagemEscrever[] = [];
  const sincronizador = new Sincronizador(amb, pasta, jam.baseSha, jam.eu, {
    enviar: (m) => (conexaoDaSala ? conexaoDaSala.enviar(m) : antesDaConexao.push(m)),
  });
  await sincronizador.preparar();
  const conexao = await conectarNaSala(amb, sessao, jamId, {
    aoConectar: () => amb.escrever(`Conectado à jam ${jam.nome}. Deixe esta janela aberta; Ctrl+C desliga.`),
    aoReceber: (m) => sincronizador.receber(m),
    aoReconectar: () => sincronizador.reconectou(),
  }).catch((e: unknown) => {
    if (e instanceof ErroApi && e.status === 503) {
      throw new ErroDoUsuario("A sala ao vivo da jam ainda não está no ar. A pasta está pronta; tente conectar de novo mais tarde.");
    }
    throw e;
  });
  conexaoDaSala = conexao;
  for (const m of antesDaConexao.splice(0)) conexao.enviar(m);
  await registrarPasta(amb, { jamId, pid: process.pid, pasta });
  try {
    await sincronizador.comecarAVigiar();
    const motivo = await Promise.race([conexao.fechou, parar.then(() => "")]);
    if (motivo) throw new ErroDoUsuario(motivo);
    amb.escrever("Desligado da jam.");
  } finally {
    await sincronizador.parar();
    conexao.fechar();
    await esquecerPasta(amb, pasta);
  }
}
