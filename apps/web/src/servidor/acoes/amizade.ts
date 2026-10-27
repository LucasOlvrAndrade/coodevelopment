"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import * as regras from "@/servidor/dominio/amizade";
import { ErroApp, executar } from "@/servidor/erros";

// Server Actions da tela de Amigos (Story 1.3). São endpoints públicos: cada
// uma confere a sessão e valida a entrada, e quem age vem sempre da sessão.
// As que mudam dados atualizam a página (e o contador da barra) com refresh().

const id = z.string().min(1).max(100);
const texto = z.string().max(100);

function entrada<T>(esquema: z.ZodType<T>, valor: unknown): T {
  const lido = esquema.safeParse(valor);
  if (!lido.success) throw new ErroApp("entrada_invalida");
  return lido.data;
}

export async function buscarAmigo(login: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    return regras.buscarPorLogin(db(), eu.id, entrada(texto, login));
  });
}

export async function pedirAmizade(paraId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    const resultado = await regras.pedirAmizade(db(), eu.id, entrada(id, paraId));
    refresh();
    return resultado;
  });
}

export async function aceitarPedido(pedidoId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    await regras.aceitarPedido(db(), eu.id, entrada(id, pedidoId));
    refresh();
  });
}

export async function recusarPedido(pedidoId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    await regras.recusarPedido(db(), eu.id, entrada(id, pedidoId));
    refresh();
  });
}

export async function desfazerAmizade(amigoId: string) {
  return executar(async () => {
    const eu = await exigirSessao();
    await regras.desfazerAmizade(db(), eu.id, entrada(id, amigoId));
    refresh();
  });
}

// Contador de pedidos da barra: o layout não é renderizado de novo na navegação
// sem recarregar, então a barra pede a contagem quando a página muda (REL-003).
export async function contarMeusPedidos() {
  return executar(async () => {
    const eu = await exigirSessao();
    return regras.contarPedidosRecebidos(db(), eu.id);
  });
}
