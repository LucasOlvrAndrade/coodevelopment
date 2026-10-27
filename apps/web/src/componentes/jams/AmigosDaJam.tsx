"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Avatar } from "@/componentes/ui/Avatar";
import type { Pessoa } from "@/servidor/dominio/amizade";

const MAXIMO = 2;

type Escolha = { escolhidos: string[]; alternar: (id: string) => void };
const Contexto = createContext<Escolha>({ escolhidos: [], alternar: () => {} });

// Amigos escolhidos na nova jam (Story 2.3), lidos pelos dois jeitos de criar
// (importar e criar repositório) na hora de chamar depois que a jam existe.
export function AmigosDaJam({ children }: { children: ReactNode }) {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  function alternar(id: string) {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.length < MAXIMO ? [...atual, id] : atual));
  }
  return <Contexto.Provider value={{ escolhidos, alternar }}>{children}</Contexto.Provider>;
}

export function useAmigosEscolhidos() {
  return useContext(Contexto).escolhidos;
}

// Só amigos aparecem, no máximo 2 (FR5, FR6), com o contador "0 de 2" (front-end spec).
export function EscolherAmigos({ amigos }: { amigos: Pessoa[] }) {
  const { escolhidos, alternar } = useContext(Contexto);
  if (amigos.length === 0) {
    return <p className="text-texto-suave">Você ainda não tem amigos aqui. Dá para criar a jam sozinho e chamar depois.</p>;
  }
  const cheio = escolhidos.length >= MAXIMO;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-corpo font-medium">
        Chamar amigos <span className="font-normal text-texto-suave">(opcional, {escolhidos.length} de {MAXIMO})</span>
      </legend>
      <ul className="flex flex-col gap-1">
        {amigos.map((amigo) => {
          const marcado = escolhidos.includes(amigo.id);
          return (
            <li key={amigo.id}>
              <label className={`flex items-center gap-3 rounded-controle px-2 py-2 ${!marcado && cheio ? "opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={!marcado && cheio}
                  onChange={() => alternar(amigo.id)}
                  className="accent-primaria"
                />
                <Avatar nome={amigo.nome} foto={amigo.foto} tamanho={24} />
                <span>{amigo.nome}</span>
                <span className="font-mono text-pequeno text-texto-suave">@{amigo.login}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {cheio && <p className="text-pequeno text-texto-suave">Uma jam tem até 3 pessoas, contando você.</p>}
    </fieldset>
  );
}
