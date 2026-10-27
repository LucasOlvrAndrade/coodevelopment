"use client";

import { useRef, useState, useTransition } from "react";
import { botaoPrincipal, botaoSecundario } from "@/componentes/ui/botoes";
import { aceitarPedido, pedirAmizade } from "@/servidor/acoes/amizade";
import type { Pessoa, Relacao } from "@/servidor/dominio/amizade";

type Props = { pessoa: Pessoa; relacaoInicial: Relacao; anunciar: (texto: string, pessoaId: string) => void };

const mesmaRelacao = (a: Relacao, b: Relacao) =>
  a.tipo === b.tipo && (a.tipo !== "pedido_recebido" || (b.tipo === "pedido_recebido" && a.pedidoId === b.pedidoId));

// Ação ao lado de uma pessoa na busca e nas sugestões: pedir amizade (vira
// "Pedido enviado" na hora e volta se der erro), aceitar o pedido dela, ou só a
// relação. Pedido cruzado vira amizade (front-end spec).
export function AcaoPessoa({ pessoa, relacaoInicial, anunciar }: Props) {
  const [relacao, setRelacao] = useState<Relacao>(relacaoInicial);
  // Quando a busca é refeita, a relação que vem do servidor passa a valer
  // (gate da 1.3, REL-001); sem isso, um pedido recusado seguia "enviado".
  const [vinda, setVinda] = useState<Relacao>(relacaoInicial);
  if (!mesmaRelacao(vinda, relacaoInicial)) {
    setVinda(relacaoInicial);
    setRelacao(relacaoInicial);
  }
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();
  // "Amigo" entra no lugar do botão clicado: o foco vai para ele (A11Y-002).
  const focarAoAparecer = useRef(false);
  const focarSeVier = (elemento: HTMLElement | null) => {
    if (elemento && focarAoAparecer.current) {
      focarAoAparecer.current = false;
      elemento.focus();
    }
  };

  function virouAmigo(texto: string) {
    focarAoAparecer.current = true;
    setRelacao({ tipo: "amigo" });
    anunciar(texto, pessoa.id);
  }

  function pedir() {
    if (indo || relacao.tipo !== "nenhuma") return;
    setErro(null);
    setRelacao({ tipo: "pedido_enviado" });
    iniciar(async () => {
      const resultado = await pedirAmizade(pessoa.id);
      if (!resultado.ok) {
        setRelacao({ tipo: "nenhuma" });
        setErro(resultado.erro.mensagem);
      } else if (resultado.dados === "amigos") {
        virouAmigo(`${pessoa.nome} já tinha pedido amizade a você. Agora vocês são amigos.`);
      } else {
        anunciar(`Pedido enviado para ${pessoa.nome}.`, pessoa.id);
      }
    });
  }

  function aceitar(pedidoId: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await aceitarPedido(pedidoId);
      if (resultado.ok) virouAmigo(`Agora você e ${pessoa.nome} são amigos.`);
      else setErro(resultado.erro.mensagem);
    });
  }

  const enviado = relacao.tipo === "pedido_enviado";

  return (
    <>
      {relacao.tipo === "eu" && <span className="text-pequeno text-texto-suave">É você</span>}
      {relacao.tipo === "amigo" && (
        <span ref={focarSeVier} tabIndex={-1} className="text-pequeno text-sucesso">
          Amigo
        </span>
      )}
      {(relacao.tipo === "nenhuma" || enviado) && (
        // O mesmo botão nos dois estados, para o foco ficar nele: depois de
        // pedir ele fica aria-disabled, não disabled (A11Y-002).
        <button
          type="button"
          onClick={pedir}
          aria-disabled={enviado || indo ? true : undefined}
          aria-label={enviado ? undefined : `Pedir amizade a ${pessoa.nome}`}
          className={enviado ? `${botaoSecundario} cursor-default opacity-60` : botaoPrincipal}
        >
          {enviado ? "Pedido enviado" : "Pedir amizade"}
        </button>
      )}
      {relacao.tipo === "pedido_recebido" && (
        <button
          type="button"
          disabled={indo}
          onClick={() => aceitar(relacao.pedidoId)}
          aria-label={`Aceitar pedido de ${pessoa.nome}`}
          className={botaoPrincipal}
        >
          Aceitar pedido
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
