"use server";

import { z } from "zod";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { normalizarLogin } from "@/servidor/dominio/amizade";
import * as regras from "@/servidor/dominio/jam";
import { ErroApp, executar } from "@/servidor/erros";
import { githubDoUsuario, githubRepositorios } from "@/servidor/github";

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
