"use client";

import { useRef, useState } from "react";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { AcaoPessoa } from "./AcaoPessoa";
import { LinhaPessoa } from "./LinhaPessoa";
import { useFocarQuandoSair } from "./use-focar-quando-sair";

// Mútuos do GitHub que usam o app (Story 1.4, D12). Pedir amizade é o mesmo
// botão da busca; nada vira amizade sem o aceite do outro. Depois do pedido a
// pessoa sai das sugestões, e o foco vai para o aviso.
export function Sugestoes({ sugestoes }: { sugestoes: Pessoa[] }) {
  const [aviso, setAviso] = useState("");
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const focarQuandoSair = useFocarQuandoSair(
    sugestoes.map((p) => p.id),
    avisoRef,
  );

  function anunciar(texto: string, pessoaId: string) {
    focarQuandoSair(pessoaId);
    setAviso(texto);
  }

  return (
    <div className="flex flex-col gap-2">
      {sugestoes.length === 0 ? (
        <p className="text-texto-suave">Nenhum dos seus mútuos do GitHub usa o Coodevelopment ainda. Busque pelo usuário abaixo.</p>
      ) : (
        <ul aria-label="Sugestões do GitHub" className="divide-y divide-divisoria">
          {sugestoes.map((pessoa) => (
            <li key={pessoa.id}>
              <LinhaPessoa nome={pessoa.nome} login={pessoa.login} foto={pessoa.foto}>
                <AcaoPessoa pessoa={pessoa} relacaoInicial={{ tipo: "nenhuma" }} anunciar={anunciar} />
              </LinhaPessoa>
            </li>
          ))}
        </ul>
      )}
      <p ref={avisoRef} tabIndex={-1} role="status" className="text-corpo outline-none">
        {aviso}
      </p>
    </div>
  );
}
