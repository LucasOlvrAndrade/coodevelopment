"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { auth, exigirSessao } from "@/servidor/auth";
import { ErroApp, executar } from "@/servidor/erros";

// Confirmar o login do conector (Story 3.1, FR10). A consulta liga o código à
// sessão de quem abriu a tela; só essa pessoa confirma ou recusa depois.

const codigo = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9-]+$/);

export type SituacaoDispositivo = "pendente" | "confirmado" | "recusado";

const SITUACOES: Record<string, SituacaoDispositivo> = {
  pending: "pendente",
  approved: "confirmado",
  denied: "recusado",
};

function lerCodigo(valor: unknown): string {
  const lido = codigo.safeParse(valor);
  if (!lido.success) throw new ErroApp("codigo_dispositivo_invalido");
  return lido.data.toUpperCase();
}

// Os erros do plugin viram as mensagens do app; o resto segue como inesperado.
function traduzir(e: unknown): never {
  if (e instanceof APIError) {
    const erro = (e.body as { error?: string } | undefined)?.error;
    if (erro === "expired_token") throw new ErroApp("codigo_dispositivo_vencido");
    if (erro === "invalid_request") throw new ErroApp("codigo_dispositivo_invalido");
    if (erro === "access_denied") throw new ErroApp("codigo_dispositivo_de_outro");
  }
  throw e;
}

export async function consultarDispositivo(valor: string) {
  return executar(async () => {
    await exigirSessao();
    const userCode = lerCodigo(valor);
    const resposta = await auth()
      .api.deviceVerify({ query: { user_code: userCode }, headers: await headers() })
      .catch(traduzir);
    return { codigo: userCode, situacao: SITUACOES[resposta.status] ?? "recusado" };
  });
}

export async function responderDispositivo(valor: string, confirmar: boolean) {
  return executar(async () => {
    await exigirSessao();
    const userCode = lerCodigo(valor);
    const pedido = { body: { userCode }, headers: await headers() };
    await (confirmar ? auth().api.deviceApprove(pedido) : auth().api.deviceDeny(pedido)).catch(traduzir);
    const situacao: SituacaoDispositivo = confirmar ? "confirmado" : "recusado";
    return { situacao };
  });
}
