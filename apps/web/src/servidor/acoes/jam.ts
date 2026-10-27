"use server";

import { z } from "zod";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import * as regras from "@/servidor/dominio/jam";
import { ErroApp, executar } from "@/servidor/erros";
import { githubDoUsuario, githubRepositorios } from "@/servidor/github";

// Server Actions de jam (Story 2.1). Quem cria vem da sessão; o repositório
// escolhido é conferido no GitHub dentro da regra.

// Conta e repositório do GitHub: letras, números, hífen, ponto e sublinhado.
const nomeGithub = z.string().min(1).max(100).regex(/^[\w.-]+$/);

function entrada<T>(esquema: z.ZodType<T>, valor: unknown): T {
  const lido = esquema.safeParse(valor);
  if (!lido.success) throw new ErroApp("entrada_invalida");
  return lido.data;
}

export async function criarJamImportando(owner: string, repo: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    return regras.criarJam(db(), { id: eu.id, githubId: eu.githubId }, githubRepositorios(githubDoUsuario(eu.id)), {
      owner: entrada(nomeGithub, owner),
      repo: entrada(nomeGithub, repo),
    });
  });
}
