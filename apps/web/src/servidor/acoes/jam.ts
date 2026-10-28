"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { normalizarLogin } from "@/servidor/dominio/amizade";
import * as regras from "@/servidor/dominio/jam";
import * as participantes from "@/servidor/dominio/participantes";
import { ErroApp, executar } from "@/servidor/erros";
import { githubColaboracao, githubConvites, githubDoUsuario, githubRepositorios } from "@/servidor/github";

// Server Actions de jam (Story 2.1). Quem cria vem da sessão; o repositório
// escolhido é conferido no GitHub dentro da regra.

// Dono com a regra do usuário do GitHub e repositório com a do nome: "." e
// ".." nunca chegam à URL do GitHub (o fetch resolveria os pontos e trocaria o
// endpoint chamado; gate da 2.1, SEC-002).
const dono = z.string().refine((v) => normalizarLogin(v) === v);
const repositorio = z.string().refine(regras.nomeDeRepositorioValido);

function entrada<T>(esquema: z.ZodType<T>, valor: unknown): T {
  const lido = esquema.safeParse(valor);
  if (!lido.success) throw new ErroApp("entrada_invalida");
  return lido.data;
}

export async function criarJamImportando(owner: string, repo: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    return regras.criarJam(db(), { id: eu.id, githubId: eu.githubId }, githubRepositorios(githubDoUsuario(eu.id)), {
      owner: entrada(dono, owner),
      repo: entrada(repositorio, repo),
    });
  });
}

export async function criarJamComRepositorio(nome: string, privado: boolean) {
  return executar(async () => {
    const eu = await exigirSessao();
    return regras.criarJamComRepositorioNovo(db(), { id: eu.id, githubId: eu.githubId }, githubRepositorios(githubDoUsuario(eu.id)), {
      nome: entrada(z.string().min(1).max(100), nome),
      privado: entrada(z.boolean(), privado),
    });
  });
}

// Story 2.3: chamar amigos (no máximo 2) depois de criar a jam, e tentar de
// novo quem ficou de fora do repositório. A vaga vem primeiro (regra no banco);
// o GitHub vem depois, com o token do criador para o colaborador e o do amigo
// para aceitar o convite em nome dele (FR5).
const idJam = z.string().refine(regras.idDeJamValido);
const idUsuario = z.string().min(1).max(100);

async function colocar(eu: string, jamId: string, amigoId: string) {
  const { daJam, amigo } = await participantes.dadosParaColocar(db(), eu, jamId, amigoId);
  return participantes.colocarNoRepositorio(
    db(),
    daJam,
    amigo,
    githubColaboracao(githubDoUsuario(eu)),
    githubConvites(githubDoUsuario(amigoId)),
  );
}

// Cada amigo à parte: erro com um não impede o outro, e a página sempre volta
// atualizada (gate da 2.3, REL-001). Quem pegou a vaga e caiu no meio fica
// "não adicionado", com tentar de novo no Início.
export async function chamarAmigos(jamId: string, amigoIds: string[]) {
  return executar(async () => {
    const eu = await exigirSessao();
    const jam = entrada(idJam, jamId);
    const ids = entrada(z.array(idUsuario).max(2), amigoIds);
    const resultados: ({ amigoId: string } & (participantes.ResultadoColocar | { erro: string }))[] = [];
    for (const amigoId of ids) {
      try {
        await participantes.chamarAmigo(db(), eu.id, jam, amigoId);
        resultados.push({ amigoId, ...(await colocar(eu.id, jam, amigoId)) });
      } catch (e) {
        if (!(e instanceof ErroApp)) console.error(JSON.stringify({ nivel: "erro", evento: "chamar_amigo", erro: String(e) }));
        resultados.push({ amigoId, erro: e instanceof ErroApp ? e.message : "Algo deu errado ao chamar essa pessoa." });
      }
    }
    refresh();
    return resultados;
  });
}

export async function tentarDeNovo(jamId: string, amigoId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    const estado = await colocar(eu.id, entrada(idJam, jamId), entrada(idUsuario, amigoId));
    refresh();
    return estado;
  });
}

// Story 2.4: o criador exclui a jam (A13). O repositório no GitHub não muda.
export async function excluirJam(jamId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    await regras.excluirJam(db(), eu.id, entrada(idJam, jamId));
  });
}
