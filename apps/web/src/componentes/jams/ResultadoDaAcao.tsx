"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Resultado = { aviso?: string; problemas?: string[] };
type Anunciar = (resultado: Resultado, gatilho: HTMLElement | null) => void;

const Contexto = createContext<Anunciar | null>(null);

// Resultado das ações da jam (chamar amigos, tentar de novo) numa região que
// não sai da tela quando a página volta do servidor (gate da 2.4, A11Y-001):
// o botão que disparou a ação pode sumir, porque o amigo entrou ou a jam
// completou. Quando ele some, o foco vem para a mensagem.
export function ResultadoDaAcao({ children }: { children: ReactNode }) {
  const [resultado, setResultado] = useState<Resultado>({});
  const regiao = useRef<HTMLDivElement>(null);
  const gatilhoAtual = useRef<HTMLElement | null>(null);

  const anunciar = useCallback<Anunciar>((novo, gatilho) => {
    gatilhoAtual.current = gatilho;
    setResultado(novo);
  }, []);

  // Depois de cada render, inclusive o da volta do servidor.
  useEffect(() => {
    if (gatilhoAtual.current && !gatilhoAtual.current.isConnected) {
      gatilhoAtual.current = null;
      regiao.current?.focus();
    }
  });

  return (
    <Contexto.Provider value={anunciar}>
      {children}
      <div ref={regiao} tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <div role="alert">
          {resultado.problemas && resultado.problemas.length > 0 && (
            <ul className="list-disc pl-5 text-pequeno text-erro">
              {resultado.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <p role="status" className="text-corpo">
          {resultado.aviso}
        </p>
      </div>
    </Contexto.Provider>
  );
}

// Sem a região por perto (fora da página da jam e do Início), devolve null e
// quem chamou mostra o resultado ali mesmo.
export function useResultadoDaAcao() {
  return useContext(Contexto);
}
