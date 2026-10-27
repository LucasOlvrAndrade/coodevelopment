"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ITENS = [
  { href: "/inicio", rotulo: "Jams" },
  { href: "/amigos", rotulo: "Amigos" },
] as const;

type Props = { pedidosRecebidos: number; posicao: "topo" | "baixo" };

// Uma contagem por troca de página, dividida entre a barra de cima e a de baixo
// (as duas ficam montadas; o CSS mostra uma). Falha de rede deixa o número que já estava.
let ultimaContagem: { caminho: string; total: Promise<number | null> } | null = null;

function contagemPara(caminho: string): Promise<number | null> {
  if (ultimaContagem?.caminho !== caminho) {
    ultimaContagem = {
      caminho,
      total: fetch("/api/amigos/pedidos-recebidos", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ total?: unknown }>) : null))
        .then((dados) => (typeof dados?.total === "number" ? dados.total : null))
        .catch(() => null),
    };
  }
  return ultimaContagem.total;
}

// Navegação principal (front-end spec): no computador fica na barra de cima;
// no celular, "Jams" e "Amigos" viram uma barra inferior. "Amigos" mostra
// quantos pedidos esperam resposta.
export function NavegacaoApp({ pedidosRecebidos, posicao }: Props) {
  const caminho = usePathname();
  const noTopo = posicao === "topo";

  // O layout não volta do servidor na navegação sem recarregar: ao trocar de
  // página, a barra pede a contagem de novo (gate da 1.3, REL-003). Quando o
  // layout volta (depois de uma ação), vale o número dele.
  const [pedidos, setPedidos] = useState(pedidosRecebidos);
  const [vindo, setVindo] = useState(pedidosRecebidos);
  if (vindo !== pedidosRecebidos) {
    setVindo(pedidosRecebidos);
    setPedidos(pedidosRecebidos);
  }
  const caminhoAnterior = useRef(caminho);
  useEffect(() => {
    if (caminhoAnterior.current === caminho) return;
    caminhoAnterior.current = caminho;
    let valendo = true;
    contagemPara(caminho).then((total) => {
      if (valendo && total !== null) setPedidos(total);
    });
    return () => {
      valendo = false;
    };
  }, [caminho]);

  return (
    <nav
      aria-label="Principal"
      className={
        noTopo
          ? "hidden items-center gap-1 md:flex"
          : "fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 border-t border-divisoria bg-fundo md:hidden"
      }
    >
      {ITENS.map((item) => {
        const atual = caminho === item.href || caminho.startsWith(`${item.href}/`);
        const contador = item.href === "/amigos" && pedidos > 0 ? pedidos : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={atual ? "page" : undefined}
            className={`inline-flex items-center justify-center gap-2 text-corpo transition-colors ${
              noTopo ? "rounded-controle px-3 py-2" : "min-h-14 px-3 py-3"
            } ${atual ? "font-medium text-texto" + (noTopo ? " bg-superficie" : "") : "text-texto-suave hover:text-texto"}`}
          >
            {item.rotulo}
            {contador > 0 && (
              <>
                <span aria-hidden className="min-w-5 rounded-full bg-primaria px-1.5 text-center text-pequeno font-medium text-sobre-primaria">
                  {contador}
                </span>
                <span className="sr-only">, {contador === 1 ? "1 pedido recebido" : `${contador} pedidos recebidos`}</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
