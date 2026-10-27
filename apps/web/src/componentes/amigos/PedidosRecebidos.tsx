"use client";

import { useState, useTransition } from "react";
import { aceitarPedido, recusarPedido } from "@/servidor/acoes/amizade";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { botaoPrincipal, botaoSecundario } from "./estilos";
import { LinhaPessoa } from "./LinhaPessoa";

type Pedido = Pessoa & { pedidoId: string };

// Pedidos recebidos, no topo da tela (front-end spec): aceitar cria a amizade,
// recusar tira o pedido das duas listas (AC 3). Depois de responder, a página
// volta do servidor sem o pedido.
export function PedidosRecebidos({ pedidos }: { pedidos: Pedido[] }) {
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function responder(pedido: Pedido, aceitar: boolean) {
    setErro(null);
    setAviso("");
    setRespondendo(pedido.pedidoId);
    iniciar(async () => {
      const resultado = aceitar ? await aceitarPedido(pedido.pedidoId) : await recusarPedido(pedido.pedidoId);
      setRespondendo(null);
      if (!resultado.ok) setErro(resultado.erro.mensagem);
      else setAviso(aceitar ? `Agora você e ${pedido.nome} são amigos.` : `Pedido de ${pedido.nome} recusado.`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {pedidos.length > 0 && (
        <section aria-labelledby="titulo-recebidos" className="flex flex-col gap-1">
          <h2 id="titulo-recebidos" className="text-h2 font-semibold">
            Pedidos recebidos
          </h2>
          <ul className="divide-y divide-divisoria">
            {pedidos.map((pedido) => (
              <li key={pedido.pedidoId}>
                <LinhaPessoa nome={pedido.nome} login={pedido.login} foto={pedido.foto}>
                  <button
                    type="button"
                    disabled={respondendo === pedido.pedidoId}
                    onClick={() => responder(pedido, true)}
                    aria-label={`Aceitar o pedido de ${pedido.nome}`}
                    className={botaoPrincipal}
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={respondendo === pedido.pedidoId}
                    onClick={() => responder(pedido, false)}
                    aria-label={`Recusar o pedido de ${pedido.nome}`}
                    className={botaoSecundario}
                  >
                    Recusar
                  </button>
                </LinhaPessoa>
              </li>
            ))}
          </ul>
        </section>
      )}
      {erro && (
        <p role="alert" className="text-pequeno text-erro">
          {erro}
        </p>
      )}
      <p role="status" className="text-corpo">
        {aviso}
      </p>
    </div>
  );
}
