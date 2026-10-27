"use client";

import { useState } from "react";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { AcaoPessoa } from "./AcaoPessoa";
import { LinhaPessoa } from "./LinhaPessoa";

// Mútuos do GitHub que usam o app (Story 1.4, D12). Pedir amizade é o mesmo
// botão da busca; nada vira amizade sem o aceite do outro.
export function Sugestoes({ sugestoes }: { sugestoes: Pessoa[] }) {
  const [aviso, setAviso] = useState("");

  return (
    <div className="flex flex-col gap-2">
      {sugestoes.length === 0 ? (
        <p className="text-texto-suave">Nenhum dos seus mútuos do GitHub usa o Coodevelopment ainda. Busque pelo usuário abaixo.</p>
      ) : (
        <ul aria-label="Sugestões do GitHub" className="divide-y divide-divisoria">
          {sugestoes.map((pessoa) => (
            <li key={pessoa.id}>
              <LinhaPessoa nome={pessoa.nome} login={pessoa.login} foto={pessoa.foto}>
                <AcaoPessoa pessoa={pessoa} relacaoInicial={{ tipo: "nenhuma" }} anunciar={setAviso} />
              </LinhaPessoa>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="text-corpo">
        {aviso}
      </p>
    </div>
  );
}
