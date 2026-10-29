"use client";

import { useEffect, useRef, useState } from "react";
import { botaoSecundarioPequeno } from "./estilo";

type Estado = "normal" | "copiado" | "falhou";

// Bloco de copiar (front-end spec, Story 3.2): comando de uma linha ou prompt
// de várias, em fonte mono, com botão "Copiar" escrito. "Copiado" fica 2 s e
// é anunciado ao leitor de tela. Se a área de transferência falhar (sem
// permissão, página fora de https), avisa e o texto continua selecionável.
export function BlocoCopiar({ texto, rotulo, variante = "comando" }: { texto: string; rotulo: string; variante?: "comando" | "prompt" }) {
  const [estado, setEstado] = useState<Estado>("normal");
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    clearTimeout(relogio.current);
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      relogio.current = setTimeout(() => setEstado("normal"), 2000);
    } catch {
      setEstado("falhou");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 rounded-xl bg-fundo/60 p-3 ring-1 ring-divisoria">
        <pre
          aria-label={rotulo}
          tabIndex={0}
          className={`min-w-0 flex-1 font-mono text-pequeno text-texto select-all ${variante === "prompt" ? "whitespace-pre-wrap" : "overflow-x-auto"}`}
        >
          {texto}
        </pre>
        {/* O nome diz o que copia; o "Copiado" é anunciado pela região de status. */}
        <button type="button" onClick={copiar} aria-label={`Copiar ${rotulo}`} className={`${botaoSecundarioPequeno} shrink-0`}>
          {estado === "copiado" ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p role="status" className="text-pequeno text-texto-suave">
        {estado === "copiado" ? "Copiado para a área de transferência." : estado === "falhou" ? "Não deu para copiar. Selecione o texto e copie com Ctrl+C." : ""}
      </p>
    </div>
  );
}
