"use client";

import { useState, useTransition } from "react";
import { aceitarPedido, pedirAmizade } from "@/servidor/acoes/amizade";
import type { Pessoa, Relacao } from "@/servidor/dominio/amizade";
import { botaoPrincipal, botaoSecundario } from "./estilos";

type Props = { pessoa: Pessoa; relacaoInicial: Relacao; anunciar: (texto: string) => void };

// Ação ao lado de uma pessoa na busca e nas sugestões: pedir amizade (o botão
// vira "Pedido enviado" na hora e volta se der erro), aceitar o pedido dela, ou
// só a relação. Pedido cruzado vira amizade (front-end spec).
export function AcaoPessoa({ pessoa, relacaoInicial, anunciar }: Props) {
  const [relacao, setRelacao] = useState<Relacao>(relacaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();

  function pedir() {
    setErro(null);
    setRelacao({ tipo: "pedido_enviado" });
    iniciar(async () => {
      const resultado = await pedirAmizade(pessoa.id);
      if (!resultado.ok) {
        setRelacao(relacaoInicial);
        setErro(resultado.erro.mensagem);
      } else if (resultado.dados === "amigos") {
        setRelacao({ tipo: "amigo" });
        anunciar(`${pessoa.nome} já tinha pedido amizade a você. Agora vocês são amigos.`);
      } else {
        anunciar(`Pedido enviado para ${pessoa.nome}.`);
      }
    });
  }

  function aceitar(pedidoId: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await aceitarPedido(pedidoId);
      if (resultado.ok) {
        setRelacao({ tipo: "amigo" });
        anunciar(`Agora você e ${pessoa.nome} são amigos.`);
      } else {
        setErro(resultado.erro.mensagem);
      }
    });
  }

  return (
    <>
      {relacao.tipo === "eu" && <span className="text-pequeno text-texto-suave">É você</span>}
      {relacao.tipo === "amigo" && <span className="text-pequeno text-sucesso">Amigo</span>}
      {relacao.tipo === "pedido_enviado" && (
        <button type="button" disabled className={botaoSecundario}>
          Pedido enviado
        </button>
      )}
      {relacao.tipo === "pedido_recebido" && (
        <button
          type="button"
          disabled={indo}
          onClick={() => aceitar(relacao.pedidoId)}
          aria-label={`Aceitar o pedido de ${pessoa.nome}`}
          className={botaoPrincipal}
        >
          Aceitar pedido
        </button>
      )}
      {relacao.tipo === "nenhuma" && (
        <button type="button" disabled={indo} onClick={pedir} aria-label={`Pedir amizade a ${pessoa.nome}`} className={botaoPrincipal}>
          Pedir amizade
        </button>
      )}
      {erro && (
        <p role="alert" className="w-full text-pequeno text-erro">
          {erro}
        </p>
      )}
    </>
  );
}
