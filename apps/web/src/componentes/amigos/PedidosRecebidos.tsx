"use client";

import { useRef, useState, useTransition } from "react";
import { botaoPrincipal, botaoSecundario } from "@/componentes/ui/botoes";
import { aceitarPedido, recusarPedido } from "@/servidor/acoes/amizade";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { LinhaPessoa } from "./LinhaPessoa";
import { useFocarQuandoSair } from "./use-focar-quando-sair";

type Pedido = Pessoa & { pedidoId: string };

// Pedidos recebidos, no topo da tela (front-end spec): aceitar cria a amizade,
// recusar tira o pedido das duas listas (AC 3). Depois de responder, a página
// volta do servidor sem o pedido, e o foco vai para o aviso.
export function PedidosRecebidos({ pedidos }: { pedidos: Pedido[] }) {
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // Cada pedido com a sua resposta em andamento (gate da 1.3, REL-002).
  const [respondendo, setRespondendo] = useState<ReadonlySet<string>>(new Set());
  const [, iniciar] = useTransition();
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const focarQuandoSair = useFocarQuandoSair(
    pedidos.map((p) => p.pedidoId),
    avisoRef,
  );

  function responder(pedido: Pedido, aceitar: boolean) {
    setErro(null);
    setAviso("");
    setRespondendo((atual) => new Set(atual).add(pedido.pedidoId));
    iniciar(async () => {
      const resultado = aceitar ? await aceitarPedido(pedido.pedidoId) : await recusarPedido(pedido.pedidoId);
      if (!resultado.ok) {
        // Só no erro os botões voltam; no sucesso ficam travados até a linha sair.
        setRespondendo((atual) => {
          const proximo = new Set(atual);
          proximo.delete(pedido.pedidoId);
          return proximo;
        });
        setErro(resultado.erro.mensagem);
        return;
      }
      focarQuandoSair(pedido.pedidoId);
      setAviso(aceitar ? `Agora você e ${pedido.nome} são amigos.` : `Pedido de ${pedido.nome} recusado.`);
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
                    disabled={respondendo.has(pedido.pedidoId)}
                    onClick={() => responder(pedido, true)}
                    aria-label={`Aceitar o pedido de ${pedido.nome}`}
                    className={botaoPrincipal}
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={respondendo.has(pedido.pedidoId)}
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
      <p ref={avisoRef} tabIndex={-1} role="status" className="text-corpo outline-none">
        {aviso}
      </p>
    </div>
  );
}
